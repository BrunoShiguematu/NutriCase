import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatDialogHarness } from '@angular/material/dialog/testing';
import { Router } from '@angular/router';
import { CASOS_EXEMPLO } from '../../../core/data/casos-exemplo';
import { Alimento, Resolucao, TipoEtapa } from '../../../core/models';
import { AlimentoService, CarregadorTaco, CARREGADOR_TACO } from '../../../core/services/alimento.service';
import { CasoService } from '../../../core/services/caso.service';
import { ResolucaoService } from '../../../core/services/resolucao.service';
import { ResolucoesModule } from '../resolucoes.module';
import { DestinoDaPendencia, PASSO_DIETA, PASSO_ETAPAS, PassoRevisarComponent } from './passo-revisar.component';

const CASO = CASOS_EXEMPLO[0];

// Um alimento de 100 kcal por 100 g (14 g CHO, 3,7 g PTN, 2,3 g LIP): 200 g dão 200 kcal, 28 CHO, 7,4 PTN e 4,6 LIP.
const ALIMENTOS: Alimento[] = [
  { id: 'a1', nome: 'Alimento de teste', grupo: 'Teste', kcal: 100, carboidrato: 14, proteina: 3.7, gordura: 2.3, origem: 'TACO' },
];

const CERTAS: Record<TipoEtapa, [string | number, number]> = {
  TMB: ['Mifflin-St Jeor', 1671.25],
  GET: [1.8, 3008.25],
  CHO: [6, 420],
  PTN: [1.6, 112],
  LIP: [1, 70],
};

describe('PassoRevisarComponent', () => {
  let fixture: ComponentFixture<PassoRevisarComponent>;
  let loader: HarnessLoader;
  let raizDoc: HarnessLoader;
  let service: ResolucaoService;
  let casos: CasoService;
  let alimentos: AlimentoService;
  let resolucao: Resolucao;
  let navegar: ReturnType<typeof vi.spyOn>;
  let carregador: CarregadorTaco;
  let pedidosDeSalto: DestinoDaPendencia[];

  beforeEach(async () => {
    localStorage.clear();
    carregador = async () => ALIMENTOS.map((a) => ({ ...a }));
    await TestBed.configureTestingModule({
      // Importa o módulo (e não só declara o componente): o template é compilado com o escopo do módulo.
      imports: [ResolucoesModule],
      providers: [
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        { provide: CARREGADOR_TACO, useValue: () => carregador() },
      ],
    }).compileComponents();
    service = TestBed.inject(ResolucaoService);
    casos = TestBed.inject(CasoService);
    alimentos = TestBed.inject(AlimentoService);
    resolucao = service.iniciar(CASO.id)!;
    navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    pedidosDeSalto = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  async function abrir(): Promise<void> {
    await alimentos.carregar();
    fixture = TestBed.createComponent(PassoRevisarComponent);
    fixture.componentRef.setInput('resolucao', resolucao);
    fixture.componentInstance.irPara.subscribe((indice) => pedidosDeSalto.push(indice));
    loader = TestbedHarnessEnvironment.loader(fixture);
    raizDoc = TestbedHarnessEnvironment.documentRootLoader(fixture);
    await fixture.whenStable();
  }

  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const limpo = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();
  const texto = (seletor: string): string => limpo(raiz().querySelector(seletor)?.textContent);
  const textos = (seletor: string): string[] => Array.from(raiz().querySelectorAll(seletor), (e) => limpo(e.textContent));
  const submeter = (): Promise<MatButtonHarness> => loader.getHarness(MatButtonHarness.with({ selector: '.revisar-submeter' }));
  const dialogos = () => raizDoc.getAllHarnesses(MatDialogHarness);

  function responder(tipos: TipoEtapa[] = ['TMB', 'GET', 'CHO', 'PTN', 'LIP']): void {
    for (const etapa of casos.listarEtapas(CASO.id).filter((e) => tipos.includes(e.tipo))) {
      const [parametro, valor] = CERTAS[etapa.tipo];
      expect(service.salvarResposta(resolucao.id, etapa.id, parametro, valor)).toBeDefined();
    }
  }

  /** Uma refeição (Café, 07:00, pré-treino) com 200 g do alimento de teste. */
  function montarDieta(): void {
    const refeicao = service.criarRefeicao(resolucao.id, { nome: 'Café da manhã', horario: '07:00', marcador: 'pré-treino' })!;
    expect(service.criarItem(refeicao.id, { alimentoId: 'a1', quantidadeGramas: 200 })).toBeDefined();
  }

  function completar(): void {
    responder();
    montarDieta();
  }

  // ====================================================================================================

  describe('pendências (UC06, fluxo 2a)', () => {
    it('tentativa vazia: lista as 5 etapas e a dieta, na ordem', async () => {
      await abrir();

      expect(textos('.pendencia-texto')).toEqual([
        'Etapa 1 (TMB) sem resposta.',
        'Etapa 2 (GET) sem resposta.',
        'Etapa 3 (CHO) sem resposta.',
        'Etapa 4 (PTN) sem resposta.',
        'Etapa 5 (LIP) sem resposta.',
        'A dieta não tem nenhum item.',
      ]);
      expect(raiz().querySelector('.sem-pendencias')).toBeNull();
    });

    it('o botão Submeter fica desativado e explica o porquê', async () => {
      await abrir();

      expect(await (await submeter()).isDisabled()).toBe(true);
      expect(texto('.submeter-explicacao')).toBe('Para submeter, resolva as 6 pendências acima.');
      expect((raiz().querySelector('.submeter-explicacao') as HTMLElement).hidden).toBe(false); // à vista, não só no DOM
      expect(raiz().querySelector('.revisar-submeter')?.getAttribute('aria-describedby')).toBe('submeter-explicacao');
    });

    it('com uma pendência só, o texto fica no singular', async () => {
      responder();
      await abrir();

      expect(texto('.submeter-explicacao')).toBe('Para submeter, resolva a pendência acima.');
    });

    it('cada pendência tem um botão que pede o passo onde ela se resolve: etapas = 0 (com a etapa), dieta = 1', async () => {
      responder(['TMB', 'GET']);
      await abrir();

      const botoes = await loader.getAllHarnesses(MatButtonHarness.with({ selector: '.pendencia-ir' }));
      expect(await Promise.all(botoes.map((b) => b.getText()))).toEqual([
        'Ir para as etapas',
        'Ir para as etapas',
        'Ir para as etapas',
        'Ir para a dieta',
      ]);
      await botoes[0].click();
      await botoes[3].click();

      expect(PASSO_ETAPAS).toBe(0);
      expect(PASSO_DIETA).toBe(1);
      // A pendência de etapa leva o id da etapa (a 3ª, a primeira sem resposta); a da dieta só o passo.
      const etapa3 = casos.listarEtapas(CASO.id).find((e) => e.ordem === 3)!;
      expect(pedidosDeSalto).toEqual([{ passo: 0, etapaId: etapa3.id }, { passo: 1 }]);
    });

    it('os botões das pendências têm nome acessível que diz qual é a pendência', async () => {
      await abrir();

      const nomes = Array.from(raiz().querySelectorAll('.pendencia-ir'), (b) => b.getAttribute('aria-label'));
      expect(nomes[0]).toBe('Ir para as etapas: Etapa 1 (TMB) sem resposta.');
      expect(nomes[5]).toBe('Ir para a dieta: A dieta não tem nenhum item.');
    });

    it('acompanha o que é preenchido: cada resposta e a dieta tiram a pendência', async () => {
      await abrir();
      expect(textos('.pendencia-texto').length).toBe(6);

      responder(['TMB', 'GET']);
      await fixture.whenStable();
      expect(textos('.pendencia-texto')).toEqual(['Etapa 3 (CHO) sem resposta.', 'Etapa 4 (PTN) sem resposta.', 'Etapa 5 (LIP) sem resposta.', 'A dieta não tem nenhum item.']);

      responder(['CHO', 'PTN', 'LIP']);
      montarDieta();
      await fixture.whenStable();
      expect(textos('.pendencia-texto')).toEqual([]);
      expect(texto('.sem-pendencias')).toBe('Nenhuma pendência: tudo está preenchido.');
      expect(raiz().querySelector('.submeter-explicacao')).toBeNull();
      expect(await (await submeter()).isDisabled()).toBe(false);
    });

    it('a justificativa é opcional: sem ela, o botão fica ativo', async () => {
      completar();
      await abrir();

      expect(service.buscar(resolucao.id)!.justificativa).toBe('');
      expect(await (await submeter()).isDisabled()).toBe(false);
      expect(texto('.sem-justificativa')).toBe('Sem justificativa (ela é opcional).');
    });

    it('com pendência, clicar em Submeter não abre o diálogo nem submete', async () => {
      const submeterNoServico = vi.spyOn(service, 'submeter');
      await abrir();

      await (await submeter()).click();

      expect(await dialogos()).toEqual([]);
      expect(submeterNoServico).not.toHaveBeenCalled();
    });
  });

  describe('resumo do que será corrigido', () => {
    it('as 5 respostas, com parâmetro, valor e unidade; as que faltam aparecem como "Não respondida"', async () => {
      responder(['TMB', 'CHO']);
      await abrir();

      const itens = Array.from(raiz().querySelectorAll('.resumo-item'), (i) => [limpo(i.querySelector('dt')?.textContent), limpo(i.querySelector('dd')?.textContent)]);
      expect(itens).toEqual([
        ['Etapa 1: Taxa metabólica basal (TMB)', 'Equação: Mifflin-St Jeor · TMB: 1.671,25 kcal/dia'],
        ['Etapa 2: Gasto energético total (GET)', 'Não respondida'],
        ['Etapa 3: Meta de carboidrato', 'Carboidrato: 6 g/kg/dia · Carboidrato total: 420 g/dia'],
        ['Etapa 4: Meta de proteína', 'Não respondida'],
        ['Etapa 5: Meta de gordura', 'Não respondida'],
      ]);
    });

    it('as refeições, com horário, marcador e alimentos, e o total do dia', async () => {
      montarDieta();
      const lanche = service.criarRefeicao(resolucao.id, { nome: 'Lanche', horario: '16:00', marcador: 'nenhum' })!;
      service.criarItem(lanche.id, { alimentoId: 'a1', quantidadeGramas: 100 });
      await abrir();

      const refeicoes = Array.from(raiz().querySelectorAll('.refeicao'), (r) => [
        limpo(r.querySelector('.refeicao-nome')?.textContent),
        limpo(r.querySelector('.refeicao-detalhe')?.textContent),
        ...Array.from(r.querySelectorAll('.item'), (i) => limpo(i.textContent)),
      ]);
      expect(refeicoes).toEqual([
        ['Café da manhã', '07:00 · Pré-treino', 'Alimento de teste: 200 g'],
        ['Lanche', '16:00', 'Alimento de teste: 100 g'],
      ]);
      // 300 g de 100 kcal/14/3,7/2,3 por 100 g
      expect(texto('.revisar-total-dia')).toBe('Total do dia: 300 kcal · CHO 42 g · PTN 11,1 g · LIP 6,9 g');
    });

    it('as refeições aparecem por horário', async () => {
      service.criarRefeicao(resolucao.id, { nome: 'Jantar', horario: '19:30', marcador: 'nenhum' });
      service.criarRefeicao(resolucao.id, { nome: 'Café', horario: '07:00', marcador: 'nenhum' });
      await abrir();

      expect(textos('.refeicao .refeicao-nome')).toEqual(['Café', 'Jantar']);
    });

    it('sem refeições: "Nenhuma refeição." e total zero', async () => {
      await abrir();

      expect(texto('.sem-refeicoes')).toBe('Nenhuma refeição.');
      expect(texto('.revisar-total-dia')).toBe('Total do dia: 0 kcal · CHO 0 g · PTN 0 g · LIP 0 g');
    });

    it('mostra a justificativa digitada', async () => {
      service.salvarJustificativa(resolucao.id, 'Mais carboidrato por causa do treino longo.');
      await abrir();

      expect(texto('.justificativa-texto')).toBe('Mais carboidrato por causa do treino longo.');
      expect(raiz().querySelector('.sem-justificativa')).toBeNull();
    });

    it('acompanha mudanças feitas nos outros passos (justificativa e dieta)', async () => {
      await abrir();
      expect(texto('.sem-justificativa')).toBe('Sem justificativa (ela é opcional).');

      service.salvarJustificativa(resolucao.id, 'Agora tem texto.');
      montarDieta();
      await fixture.whenStable();

      expect(texto('.justificativa-texto')).toBe('Agora tem texto.');
      expect(textos('.refeicao .refeicao-nome')).toEqual(['Café da manhã']);
      expect(texto('.revisar-total-dia')).toContain('200 kcal');
    });

    it('enquanto a base de alimentos não carrega, avisa; com erro, oferece tentar de novo', async () => {
      let falhar = true;
      carregador = async () => {
        if (falhar) {
          throw new Error('sem TACO');
        }
        return ALIMENTOS.map((a) => ({ ...a }));
      };
      await abrir();

      expect(texto('.alimentos-erro')).toContain('Não foi possível carregar a base de alimentos.');
      expect(raiz().querySelector('.revisar-total-dia')).toBeNull();

      falhar = false;
      await (await loader.getHarness(MatButtonHarness.with({ selector: '.alimentos-tentar' }))).click();
      await alimentos.carregar();
      await fixture.whenStable();

      expect(raiz().querySelector('.alimentos-erro')).toBeNull();
      expect(raiz().querySelector('.revisar-total-dia')).not.toBeNull();
    });

    it('não diz se as respostas estão certas: nada de classificação, comparativo, alerta ou ícone', async () => {
      completar();
      service.salvarJustificativa(resolucao.id, 'Texto.');
      await abrir();

      expect(raiz().textContent).not.toMatch(/correta|divergente|erro de fato|certo|errado|acert|incorret|dentro|fora das metas|toler[âa]ncia|alerta|falta pr|falta p[óo]s/i);
      expect(raiz().querySelectorAll('mat-icon').length).toBe(0);
    });
  });

  describe('submeter (UC06)', () => {
    beforeEach(async () => {
      completar();
      service.salvarJustificativa(resolucao.id, 'Minha justificativa.');
      await abrir();
    });

    const confirmar = async (): Promise<void> =>
      (await (await raizDoc.getHarness(MatDialogHarness)).getHarness(MatButtonHarness.with({ selector: '.confirmar-submeter' }))).click();
    const cancelar = async (): Promise<void> =>
      (await (await raizDoc.getHarness(MatDialogHarness)).getHarness(MatButtonHarness.with({ selector: '.confirmar-cancelar' }))).click();
    const status = () => service.buscar(resolucao.id)!.status;

    it('Submeter pede confirmação, avisando que depois não dá para editar', async () => {
      await (await submeter()).click();

      const dialogo = await raizDoc.getHarness(MatDialogHarness);
      const conteudo = limpo(await dialogo.getText());
      expect(conteudo).toContain('Submeter a resolução?');
      expect(conteudo).toContain('Depois de submeter, não é possível editar');
      expect(status()).toBe('em andamento'); // ainda não submeteu
    });

    it('Cancelar no diálogo não submete nem navega', async () => {
      const submeterNoServico = vi.spyOn(service, 'submeter');
      await (await submeter()).click();

      await cancelar();

      expect(await dialogos()).toEqual([]);
      expect(submeterNoServico).not.toHaveBeenCalled();
      expect(status()).toBe('em andamento');
      expect(navegar).not.toHaveBeenCalled();
      expect(raiz().querySelector('.erro-submissao')).toBeNull();
    });

    it('fechar o diálogo sem escolher (Esc) também não submete', async () => {
      const submeterNoServico = vi.spyOn(service, 'submeter');
      await (await submeter()).click();

      await (await raizDoc.getHarness(MatDialogHarness)).close();

      expect(submeterNoServico).not.toHaveBeenCalled();
      expect(status()).toBe('em andamento');
    });

    it('Confirmar submete a tentativa e abre o resultado, trocando a entrada do histórico', async () => {
      await (await submeter()).click();

      await confirmar();
      await fixture.whenStable();

      expect(status()).toBe('submetida');
      expect(service.buscar(resolucao.id)!.submetidaEm).toBeDefined();
      expect(service.listarRespostas(resolucao.id).every((r) => r.classificacao === 'correta')).toBe(true);
      expect(navegar).toHaveBeenCalledTimes(1);
      expect(navegar).toHaveBeenCalledWith(['/resolucoes', resolucao.id, 'resultado'], { replaceUrl: true });
      expect(raiz().querySelector('.erro-submissao')).toBeNull();
    });

    it('enquanto submete, o botão fica desativado e mostra "Submetendo…", e um segundo clique não abre outro diálogo', async () => {
      let terminar!: (r: Resolucao | undefined) => void;
      vi.spyOn(service, 'submeter').mockReturnValue(new Promise((resolver) => (terminar = resolver)));
      await (await submeter()).click();
      await confirmar();

      expect(await (await submeter()).isDisabled()).toBe(true);
      expect(await (await submeter()).getText()).toBe('Submetendo…');
      await (await submeter()).click();
      expect(await dialogos()).toEqual([]);

      // mesmo chamando o método direto (por exemplo, por um atalho), não abre outro diálogo enquanto submete
      (fixture.componentInstance as unknown as { submeter(): void }).submeter();
      expect(await dialogos()).toEqual([]);

      terminar(service.buscar(resolucao.id));
      await fixture.whenStable();
      expect(await (await submeter()).getText()).toBe('Submeter');
    });

    it('se a submissão falhar sem pendência, mostra uma mensagem própria, não navega e deixa tentar de novo', async () => {
      vi.spyOn(service, 'submeter').mockResolvedValueOnce(undefined);
      await (await submeter()).click();

      await confirmar();
      await fixture.whenStable();

      expect(texto('.erro-submissao')).toContain('Não foi possível submeter agora.');
      expect(raiz().querySelector('.erro-submissao')?.getAttribute('role')).toBe('alert');
      expect(navegar).not.toHaveBeenCalled();
      expect(status()).toBe('em andamento');
      expect(await (await submeter()).isDisabled()).toBe(false);

      // tentar de novo: agora o serviço funciona
      await (await submeter()).click();
      await confirmar();
      await fixture.whenStable();
      expect(status()).toBe('submetida');
      expect(raiz().querySelector('.erro-submissao')).toBeNull();
      expect(navegar).toHaveBeenCalledWith(['/resolucoes', resolucao.id, 'resultado'], { replaceUrl: true });
    });

    it('falha de verdade: a base de alimentos não carrega, então o serviço recusa e a tela avisa', async () => {
      fixture.destroy();
      TestBed.resetTestingModule();
      localStorage.removeItem('nutricase.alimentos');
      await TestBed.configureTestingModule({
        imports: [ResolucoesModule],
        providers: [
          { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
          { provide: CARREGADOR_TACO, useValue: async () => { throw new Error('sem TACO'); } },
        ],
      }).compileComponents();
      service = TestBed.inject(ResolucaoService);
      alimentos = TestBed.inject(AlimentoService);
      navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      expect(service.pendencias(resolucao.id)).toEqual([]);
      await alimentos.carregar();
      fixture = TestBed.createComponent(PassoRevisarComponent);
      fixture.componentRef.setInput('resolucao', resolucao);
      loader = TestbedHarnessEnvironment.loader(fixture);
      raizDoc = TestbedHarnessEnvironment.documentRootLoader(fixture);
      await fixture.whenStable();

      await (await submeter()).click();
      await confirmar();
      await fixture.whenStable();

      expect(alimentos.estado()).toBe('erro');
      expect(texto('.erro-submissao')).toContain('Não foi possível submeter agora.');
      expect(navegar).not.toHaveBeenCalled();
      expect(service.buscar(resolucao.id)!.status).toBe('em andamento');
    });
  });
});
