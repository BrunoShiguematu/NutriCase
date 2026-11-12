import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CASOS_EXEMPLO } from '../../core/data/casos-exemplo';
import { Kpis } from '../../core/kpis/kpis';
import { Alimento, TIPOS_ERRO, TipoEtapa } from '../../core/models';
import { AlimentoService, CARREGADOR_TACO } from '../../core/services/alimento.service';
import { CasoService } from '../../core/services/caso.service';
import { KpiService } from '../../core/services/kpi.service';
import { ResolucaoService } from '../../core/services/resolucao.service';
import { DashboardComponent } from './dashboard.component';
import { DashboardModule } from './dashboard.module';

const CASO = CASOS_EXEMPLO[0]; // Carlos

const ALIMENTOS: Alimento[] = ['a1', 'a2', 'a3', 'a4', 'a5'].map((id) => ({
  id,
  nome: `Alimento ${id}`,
  grupo: 'Teste',
  kcal: 100,
  carboidrato: 14,
  proteina: 3.7,
  gordura: 2.3,
  origem: 'TACO',
}));

type Respostas = Record<TipoEtapa, [string | number, number]>;

/** Caso 1, tudo certo: 5 corretas. */
const CERTAS: Respostas = {
  TMB: ['Mifflin-St Jeor', 1671.25],
  GET: [1.8, 3008.25],
  CHO: [6, 420],
  PTN: [1.6, 112],
  LIP: [1, 70],
};

/** Caso 1: CHO em mg (erro de conversão de unidade) e LIP divergente. Dá 3 corretas, 1 divergente, 1 com erro. */
const MISTAS: Respostas = { ...CERTAS, CHO: [6, 420000], LIP: [1.3, 91] };

/** KPIs montados à mão, para o cartão de erros com um valor diferente em cada um dos 5 tipos. */
const KPIS_DOS_5_TIPOS: Kpis = {
  casosConcluidos: { tentativas: 4, casosDistintos: 2 },
  aproveitamento: { corretas: 10, divergentes: 2, total: 20, percentual: 60 },
  errosPorTipo: {
    tipos: [
      { tipo: 'conversão de unidade', quantidade: 1 },
      { tipo: 'escolha de equação', quantidade: 2 },
      { tipo: 'aritmética', quantidade: 3 },
      { tipo: 'meta fora de faixa', quantidade: 4 },
      { tipo: 'dieta fora das metas', quantidade: 0 },
    ],
    total: 10,
  },
};

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let service: ResolucaoService;
  let casos: CasoService;

  function configurar(kpisFalsos?: Kpis): void {
    TestBed.configureTestingModule({
      imports: [DashboardModule],
      providers: [
        provideRouter([]),
        { provide: CARREGADOR_TACO, useValue: async () => ALIMENTOS.map((a) => ({ ...a })) },
        ...(kpisFalsos ? [{ provide: KpiService, useValue: { calcular: () => kpisFalsos } }] : []),
      ],
    });
    service = TestBed.inject(ResolucaoService);
    casos = TestBed.inject(CasoService);
  }

  async function submetida(respostas: Respostas = CERTAS): Promise<string> {
    await TestBed.inject(AlimentoService).carregar();
    const id = service.iniciar(CASO.id)!.id;
    for (const etapa of casos.listarEtapas(CASO.id)) {
      const [parametro, valor] = respostas[etapa.tipo];
      service.salvarResposta(id, etapa.id, parametro, valor);
    }
    const refeicao = service.criarRefeicao(id, { nome: 'Almoço', horario: '12:00', marcador: 'nenhum' })!;
    service.criarItem(refeicao.id, { alimentoId: 'a1', quantidadeGramas: 300 });
    expect(await service.submeter(id), 'a tentativa de teste precisa ser submetida').toBeDefined();
    return id;
  }

  async function abrir(): Promise<void> {
    fixture = TestBed.createComponent(DashboardComponent);
    await fixture.whenStable();
  }

  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const limpo = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();
  const texto = (seletor: string): string => limpo(raiz().querySelector(seletor)?.textContent);

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  describe('estrutura', () => {
    beforeEach(async () => {
      configurar();
      await abrir();
    });

    it('mostra o título e 3 mat-card, um por KPI, com título e frase de explicação', () => {
      expect(texto('h1.page-title')).toBe('Dashboard');
      expect(raiz().querySelectorAll('mat-card.kpi').length).toBe(3);
      expect(texto('.kpi-casos .kpi-titulo')).toBe('Casos concluídos');
      expect(texto('.kpi-aproveitamento .kpi-titulo')).toBe('Aproveitamento nos cálculos');
      expect(texto('.kpi-erros .kpi-titulo')).toBe('Erros por tipo');
      expect(Array.from(raiz().querySelectorAll('h2.kpi-titulo'), (h) => limpo(h.textContent))).toEqual([
        'Casos concluídos',
        'Aproveitamento nos cálculos',
        'Erros por tipo',
      ]);
      for (const cartao of ['casos', 'aproveitamento', 'erros']) {
        expect(texto(`.kpi-${cartao} .kpi-explicacao`), cartao).not.toBe('');
      }
    });
  });

  describe('sem nenhuma resolução', () => {
    beforeEach(async () => {
      configurar();
      await abrir();
    });

    it('mostra "—" nos 3 cartões e nenhum 0%', () => {
      for (const cartao of ['casos', 'aproveitamento', 'erros']) {
        expect(texto(`.kpi-${cartao} .kpi-valor`), cartao).toBe('—');
      }
      expect(raiz().textContent).not.toContain('0%');
    });

    it('não mostra a lista dos tipos de erro', () => {
      expect(raiz().querySelector('.lista-erros')).toBeNull();
    });

    it('tem uma frase com link para o catálogo de casos', () => {
      expect(texto('.sem-submissoes')).toContain('Você ainda não submeteu nenhuma resolução');
      const link = raiz().querySelector('.sem-submissoes .ir-catalogo') as HTMLAnchorElement;
      expect(link.getAttribute('href')).toBe('/casos');
    });
  });

  describe('só tentativas em andamento', () => {
    it('continua no estado vazio', async () => {
      configurar();
      service.iniciar(CASO.id);
      await abrir();

      expect(texto('.kpi-casos .kpi-valor')).toBe('—');
      expect(texto('.kpi-aproveitamento .kpi-valor')).toBe('—');
      expect(raiz().querySelector('.sem-submissoes')).not.toBeNull();
    });
  });

  describe('com dados', () => {
    let primeira: string;
    let segunda: string;

    beforeEach(async () => {
      configurar();
      primeira = await submetida(CERTAS);
      segunda = await submetida(MISTAS);
      service.iniciar(CASO.id); // em andamento: não entra
      await abrir();
    });

    it('Casos concluídos: o número de tentativas submetidas e "em N casos"', () => {
      expect(texto('.kpi-casos .kpi-valor')).toBe('2');
      expect(texto('.kpi-casos .kpi-detalhe')).toBe('2 tentativas submetidas, em 1 caso');
    });

    it('Aproveitamento: o % e "X de Y etapas corretas ou divergentes"', () => {
      // 5 certas + (3 corretas + 1 divergente) = 9 de 10 etapas
      expect(texto('.kpi-aproveitamento .kpi-valor')).toBe('90%');
      expect(texto('.kpi-aproveitamento .kpi-detalhe')).toBe('9 de 10 etapas corretas ou divergentes');
    });

    it('Erros por tipo: o total, igual à soma dos resumos da tela de resultado', () => {
      const somados = TIPOS_ERRO.map((t) => service.resumoErros(primeira)![t] + service.resumoErros(segunda)![t]);

      expect(texto('.kpi-erros .kpi-valor')).toBe(String(somados.reduce((a, b) => a + b, 0)));
      expect(Array.from(raiz().querySelectorAll('.erro-quantidade'), (e) => Number(e.textContent))).toEqual(somados);
    });

    it('as barras dividem o total de erros: cada largura é a parte do tipo, e juntas dão 100%', () => {
      const total = Number(texto('.kpi-erros .kpi-valor'));
      const barras = Array.from(raiz().querySelectorAll<HTMLElement>('.erro-tipo'), (i) => ({
        quantidade: Number(i.querySelector('.erro-quantidade')?.textContent),
        largura: parseFloat((i.querySelector('.erro-barra-preenchida') as HTMLElement).style.width),
      }));

      expect(total).toBeGreaterThan(0);
      for (const b of barras) {
        expect(b.largura).toBeCloseTo((b.quantidade * 100) / total, 1);
      }
      expect(barras.reduce((soma, b) => soma + b.largura, 0)).toBeCloseTo(100, 0);
    });

    it('não mostra o estado vazio', () => {
      expect(raiz().querySelector('.sem-submissoes')).toBeNull();
      expect(raiz().textContent).not.toContain('—');
    });

    it('lê os dados ao abrir: uma tela aberta depois enxerga a tentativa nova', async () => {
      await submetida(CERTAS);

      await abrir();

      expect(texto('.kpi-casos .kpi-valor')).toBe('3');
    });
  });

  describe('um caso só, uma tentativa', () => {
    it('usa o singular', async () => {
      configurar();
      await submetida(CERTAS);
      await abrir();

      expect(texto('.kpi-casos .kpi-detalhe')).toBe('1 tentativa submetida, em 1 caso');
    });
  });

  describe('os 5 tipos de erro', () => {
    beforeEach(async () => {
      configurar(KPIS_DOS_5_TIPOS);
      await abrir();
    });

    const itens = (): HTMLElement[] => Array.from(raiz().querySelectorAll<HTMLElement>('.erro-tipo'));

    it('lista os 5 tipos na ordem de TIPOS_ERRO, com a contagem em texto', () => {
      expect(itens().map((i) => [limpo(i.querySelector('.erro-rotulo')?.textContent), limpo(i.querySelector('.erro-quantidade')?.textContent)])).toEqual([
        ['Conversão de unidade', '1'],
        ['Escolha de equação', '2'],
        ['Aritmética', '3'],
        ['Meta fora de faixa', '4'],
        ['Dieta fora das metas', '0'],
      ]);
      expect(itens().map((i) => i.querySelector('.erro-rotulo')?.textContent?.toLowerCase())).toEqual([...TIPOS_ERRO]);
    });

    it('cada barra tem a largura proporcional ao total de erros (10)', () => {
      const larguras = itens().map((i) => (i.querySelector('.erro-barra-preenchida') as HTMLElement).style.width);

      expect(larguras).toEqual(['10%', '20%', '30%', '40%', '0%']);
    });

    it('as barras ficam escondidas dos leitores de tela: o número em texto já informa', () => {
      for (const barra of Array.from(raiz().querySelectorAll('.erro-barra'))) {
        expect(barra.getAttribute('aria-hidden')).toBe('true');
      }
    });

    it('mostra o total e as frases dos outros dois cartões com os números dados', () => {
      expect(texto('.kpi-erros .kpi-valor')).toBe('10');
      expect(texto('.kpi-erros .kpi-detalhe')).toBe('10 erros no total');
      expect(texto('.kpi-casos .kpi-detalhe')).toBe('4 tentativas submetidas, em 2 casos');
      expect(texto('.kpi-aproveitamento .kpi-valor')).toBe('60%');
      expect(texto('.kpi-aproveitamento .kpi-detalhe')).toBe('12 de 20 etapas corretas ou divergentes');
    });
  });

  describe('submetidas sem nenhum erro', () => {
    it('mostra os 5 tipos com 0 e barras vazias', async () => {
      configurar({
        casosConcluidos: { tentativas: 1, casosDistintos: 1 },
        aproveitamento: { corretas: 5, divergentes: 0, total: 5, percentual: 100 },
        errosPorTipo: { tipos: TIPOS_ERRO.map((tipo) => ({ tipo, quantidade: 0 })), total: 0 },
      });
      await abrir();

      expect(raiz().querySelectorAll('.erro-tipo').length).toBe(5);
      expect(texto('.kpi-erros .kpi-valor')).toBe('0');
      expect(Array.from(raiz().querySelectorAll<HTMLElement>('.erro-barra-preenchida'), (b) => b.style.width)).toEqual(['0%', '0%', '0%', '0%', '0%']);
    });
  });

  describe('submetida sem respostas avaliadas', () => {
    it('Aproveitamento mostra "—", sem 0%', async () => {
      configurar({
        casosConcluidos: { tentativas: 1, casosDistintos: 1 },
        aproveitamento: null,
        errosPorTipo: { tipos: TIPOS_ERRO.map((tipo) => ({ tipo, quantidade: 0 })), total: 0 },
      });
      await abrir();

      expect(texto('.kpi-aproveitamento .kpi-valor')).toBe('—');
      expect(texto('.kpi-casos .kpi-valor')).toBe('1');
    });
  });
});
