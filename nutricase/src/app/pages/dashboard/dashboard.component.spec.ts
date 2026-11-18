import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { KpiService } from '../../core/services/kpi.service';
import { DashboardComponent } from './dashboard.component';
import { DashboardModule } from './dashboard.module';

interface Tela {
  trocarPeriodo(periodo: 'hoje' | '7' | '30' | 'especifico'): void;
  trocarTipo(tipo: 'calculos' | 'dieta'): void;
  escolherInicio(data: Date | null): void;
  escolherFim(data: Date | null): void;
}

describe('DashboardComponent: filtros', () => {
  function abrir() {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [DashboardModule], providers: [provideRouter([])] });
    const service = TestBed.inject(KpiService);
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    return { service, tela: fixture.componentInstance as unknown as Tela };
  }
  const duracaoEmDias = (s: KpiService) => Math.round((s.filtro().fim.getTime() - s.filtro().inicio.getTime()) / 86_400_000);

  afterEach(() => localStorage.clear());

  it('abre no padrão do serviço: cálculos, 7 dias', () => {
    const { service } = abrir();

    expect(service.filtro().tipo).toBe('calculos');
    expect(duracaoEmDias(service)).toBe(7);
  });

  it('trocar o tipo e o período muda o filtro do serviço', () => {
    const { service, tela } = abrir();

    tela.trocarTipo('dieta');
    tela.trocarPeriodo('30');

    expect(service.filtro().tipo).toBe('dieta');
    expect(duracaoEmDias(service)).toBe(30);
    tela.trocarPeriodo('hoje');
    expect(duracaoEmDias(service)).toBe(1);
  });

  it('Período específico: valido aplica; invertido e mais de 1 ano não mudam o filtro; incompleto também não', () => {
    const { service, tela } = abrir();
    tela.trocarPeriodo('especifico');
    const antes = service.filtro();

    tela.escolherInicio(new Date(2026, 10, 10));
    expect(service.filtro()).toBe(antes);

    tela.escolherFim(new Date(2026, 10, 5));
    expect(service.filtro()).toBe(antes);

    tela.escolherFim(new Date(2028, 0, 1));
    expect(service.filtro()).toBe(antes);

    tela.escolherFim(new Date(2026, 10, 12));
    expect(service.filtro().inicio).toEqual(new Date(2026, 10, 10, 0, 0, 0, 0));
    expect(service.filtro().fim).toEqual(new Date(2026, 10, 12, 23, 59, 59, 999));
  });

  it('sair do Período específico e voltar zera as datas: sem datas antigas valendo em silêncio', () => {
    const { service, tela } = abrir();
    tela.trocarPeriodo('especifico');
    tela.escolherInicio(new Date(2026, 10, 10));
    tela.escolherFim(new Date(2026, 10, 12));
    const doEspecifico = service.filtro();

    tela.trocarPeriodo('7');
    expect(service.filtro()).not.toBe(doEspecifico);
    tela.trocarPeriodo('especifico');

    expect(service.filtro().fim.getTime()).toBeGreaterThan(doEspecifico.fim.getTime());
    tela.escolherFim(new Date(2026, 10, 13));
    expect(duracaoEmDias(service)).toBe(7);
  });
});

describe('DashboardComponent: Minha evolução e conquistas', () => {
  function abrirComCasos(casos: number) {
    localStorage.clear();
    const agora = new Date().toISOString();
    const resolucoes = Array.from({ length: casos }, (_, i) => ({ id: `r${i}`, casoId: `caso-${i}`, data: agora, status: 'submetida', justificativa: '', submetidaEm: agora }));
    localStorage.setItem('nutricase.resolucoes', JSON.stringify({ versao: 1, resolucoes, respostas: [], refeicoes: [], itens: [], submissoes: [] }));
    TestBed.configureTestingModule({ imports: [DashboardModule], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, texto: (seletor: string) => el.querySelector(seletor)?.textContent?.replace(/\s+/g, ' ').trim() };
  }

  afterEach(() => localStorage.clear());

  it.each([
    [0, 'Bronze', 'até o nível Prata', '0 de 3 casos · faltam 3', '0%'],
    [2, 'Bronze', 'até o nível Prata', '2 de 3 casos · faltam 1', '67%'],
    [3, 'Prata', 'até o nível Ouro', '3 de 6 casos · faltam 3', '50%'],
    [5, 'Prata', 'até o nível Ouro', '5 de 6 casos · faltam 1', '83%'],
  ])('%i casos distintos: nível %s, %s, "%s", anel %s', (casos, nome, proximo, frase, percentual) => {
    const { texto } = abrirComCasos(casos);

    expect(texto('.evolucao-nivel')).toBe(`Nível atual: ${nome}`);
    expect(texto('.evolucao-proximo')).toBe(proximo);
    expect(texto('.evolucao-casos')).toBe(frase);
    expect(texto('.evolucao-percentual')).toBe(percentual);
  });

  it('Ouro: nível máximo, só "X casos" e a barra cheia', () => {
    const { texto, el } = abrirComCasos(7);

    expect(texto('.evolucao-nivel')).toBe('Nível atual: Ouro');
    expect(texto('.evolucao-proximo')).toBe('nível máximo');
    expect(texto('.evolucao-casos')).toBe('7 casos');
    expect(el.querySelector('mat-progress-bar')?.getAttribute('aria-valuenow')).toBe('100');
  });

  it('Ver conquistas abre o diálogo com as 4 conquistas (obtidas e não) e Fechar fecha', async () => {
    const { fixture, el } = abrirComCasos(5);
    const botao = el.querySelector<HTMLButtonElement>('.evolucao-conquistas')!;
    botao.focus();

    botao.click();
    await fixture.whenStable();
    const dialogo = document.querySelector('mat-dialog-container')!;
    const itens = [...dialogo.querySelectorAll('.conquista')].map((i) => i.textContent!.replace(/\s+/g, ' ').trim());

    expect(itens).toHaveLength(4);
    expect(itens[0]).toMatch(/Primeiro caso\s*Obtida/);
    expect(itens[1]).toMatch(/5 casos distintos\s*Obtida/);
    expect(itens[2]).toMatch(/Ofensiva de 3 dias\s*Ainda não obtida/);
    expect(itens[3]).toMatch(/100% em um caso\s*Ainda não obtida/);

    dialogo.querySelector<HTMLButtonElement>('.conquistas-fechar')!.click();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 400));

    expect(document.querySelector('mat-dialog-container')).toBeNull();
    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(0);
    expect(document.activeElement).toBe(botao);
  });
});

describe('DashboardComponent: Evolução do aproveitamento', () => {
  function abrirComSubmissaoHoje() {
    localStorage.clear();
    const agora = new Date().toISOString();
    const resposta = (i: number, classificacao: string) => ({ id: `x${i}`, resolucaoId: 'r0', etapaId: `e${i}`, parametro: 1, valor: 1, classificacao });
    localStorage.setItem(
      'nutricase.resolucoes',
      JSON.stringify({
        versao: 1,
        resolucoes: [{ id: 'r0', casoId: 'caso-0', data: agora, status: 'submetida', justificativa: '', submetidaEm: agora }],
        respostas: [resposta(0, 'correta'), resposta(1, 'correta'), resposta(2, 'correta'), resposta(3, 'erro de fato')],
        refeicoes: [],
        itens: [],
        submissoes: [],
      }),
    );
    TestBed.configureTestingModule({ imports: [DashboardModule], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const tela = fixture.componentInstance as unknown as { trocarPeriodo(p: string): void; trocarModoGrafico(m: string): void };
    const textos = (seletor: string) => [...el.querySelectorAll(seletor)].map((t) => t.textContent!.trim());
    return { fixture, el, tela, textos };
  }
  afterEach(() => localStorage.clear());

  it('padrão: 7 pontos por dia, título "Dias", eixo em % e o valor de hoje (75%) sobre o último ponto', () => {
    const { el, textos } = abrirComSubmissaoHoje();

    expect(textos('.grafico-titulo-x')).toEqual(['Dias']);
    expect(textos('.grafico-rotulo-x')).toHaveLength(7);
    expect(textos('.grafico-marca-y')).toEqual(['0%', '50%', '100%']);
    expect(textos('.grafico-valor')).toEqual(['75%']);
    expect(el.querySelectorAll('.grafico-ponto')).toHaveLength(1);
    expect(el.querySelectorAll('.grafico-linha')).toHaveLength(0);
    expect(el.querySelector('svg.grafico')?.getAttribute('role')).toBe('img');
    expect(el.querySelector('svg.grafico')?.getAttribute('aria-label')).toMatch(/^Evolução do aproveitamento, em %, por dias\. .*: 75%$/);
  });

  it('Últimos 30 dias: por semana, título "Semanas"; "Nº de casos" troca o eixo e o valor', () => {
    const { fixture, el, tela, textos } = abrirComSubmissaoHoje();

    tela.trocarPeriodo('30');
    fixture.detectChanges();
    expect(textos('.grafico-titulo-x')).toEqual(['Semanas']);
    expect(textos('.grafico-rotulo-x')).toHaveLength(5);

    tela.trocarModoGrafico('casos');
    fixture.detectChanges();
    expect(textos('.grafico-marca-y')).toEqual(['0', '1', '2']);
    expect(textos('.grafico-valor').at(-1)).toBe('1');
    const aria = el.querySelector('svg.grafico')!.getAttribute('aria-label')!;
    expect(aria).toMatch(/^Evolução do aproveitamento, em número de casos, por semanas\. /);
    expect(aria).toMatch(/: 1 caso$/);
  });

  it('a barra de nível diz "Nível máximo" no Ouro', () => {
    localStorage.clear();
    const agora = new Date().toISOString();
    const resolucoes = Array.from({ length: 6 }, (_, i) => ({ id: `r${i}`, casoId: `caso-${i}`, data: agora, status: 'submetida', justificativa: '', submetidaEm: agora }));
    localStorage.setItem('nutricase.resolucoes', JSON.stringify({ versao: 1, resolucoes, respostas: [], refeicoes: [], itens: [], submissoes: [] }));
    TestBed.configureTestingModule({ imports: [DashboardModule], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('mat-progress-bar')?.getAttribute('aria-label')).toBe('Nível máximo');
  });
});

describe('DashboardComponent: data digitada inválida no Período específico', () => {
  function abrir() {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [DashboardModule], providers: [provideRouter([])] });
    const service = TestBed.inject(KpiService);
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const tela = fixture.componentInstance as unknown as { trocarPeriodo(p: string): void };
    tela.trocarPeriodo('especifico');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const digitar = (seletor: string, texto: string) => {
      const campo = el.querySelector<HTMLInputElement>(seletor)!;
      campo.value = texto;
      campo.dispatchEvent(new Event('input', { bubbles: true }));
      campo.dispatchEvent(new Event('change', { bubbles: true }));
      campo.dispatchEvent(new Event('blur', { bubbles: true }));
      fixture.detectChanges();
    };
    const erro = () => el.querySelector('mat-error')?.textContent?.trim() ?? null;
    return { service, tela, digitar, erro, fixture };
  }
  afterEach(() => localStorage.clear());

  it.each(['07/11/26', '2026-11-18', '31/02/2026', 'abc'])('"%s" mostra "Data inválida (use dd/mm/aaaa)" e não muda o filtro', (texto) => {
    const { service, digitar, erro } = abrir();
    const antes = service.filtro();

    digitar('input[matStartDate]', texto);

    expect(erro()).toBe('Data inválida (use dd/mm/aaaa)');
    expect(service.filtro()).toBe(antes);
  });

  it('datas certas porém invertidas: o mat-error não diz "dd/mm/aaaa" (o aviso role=alert já diz) e o filtro não muda', () => {
    const { service, digitar, erro, fixture } = abrir();
    const antes = service.filtro();

    digitar('input[matStartDate]', '10/11/2026');
    digitar('input[matEndDate]', '05/11/2026');

    expect(erro() ?? '').not.toContain('dd/mm/aaaa');
    expect(erro()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.periodo-erro')?.textContent).toContain('A data inicial não pode ser depois da data final.');
    expect(service.filtro()).toBe(antes);
  });

  it('inicial digitada errada e final certa: o mat-error diz "Data inválida"; corrigindo a inicial, some', () => {
    const { digitar, erro } = abrir();

    digitar('input[matStartDate]', '07/11/26');
    digitar('input[matEndDate]', '18/11/2026');
    expect(erro()).toBe('Data inválida (use dd/mm/aaaa)');

    digitar('input[matStartDate]', '07/11/2026');
    expect(erro()).toBeNull();
  });

  it('data certa não mostra erro; trocar de período e voltar limpa o campo e o erro', () => {
    const { digitar, erro, tela, fixture } = abrir();

    digitar('input[matStartDate]', '07/11/2026');
    expect(erro()).toBeNull();

    digitar('input[matStartDate]', '07/11/26');
    expect(erro()).not.toBeNull();

    tela.trocarPeriodo('7');
    fixture.detectChanges();
    tela.trocarPeriodo('especifico');
    fixture.detectChanges();
    expect(erro()).toBeNull();
    expect(fixture.nativeElement.querySelector('input[matStartDate]').value).toBe('');
  });
});
