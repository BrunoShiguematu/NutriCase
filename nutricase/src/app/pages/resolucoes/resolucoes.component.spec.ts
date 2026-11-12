import { formatDate } from '@angular/common';
import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatDialogHarness } from '@angular/material/dialog/testing';
import { MatSnackBarHarness } from '@angular/material/snack-bar/testing';
import { provideRouter, Router } from '@angular/router';
import { CASOS_EXEMPLO } from '../../core/data/casos-exemplo';
import { Alimento, TipoEtapa } from '../../core/models';
import { AlimentoService, CARREGADOR_TACO } from '../../core/services/alimento.service';
import { CasoService } from '../../core/services/caso.service';
import { ResolucaoService } from '../../core/services/resolucao.service';
import { ResolucoesComponent } from './resolucoes.component';
import { ResolucoesModule } from './resolucoes.module';

const CASO = CASOS_EXEMPLO[0]; // Carlos
const OUTRO_CASO = CASOS_EXEMPLO[1];

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

/** Caso 1: TMB, GET e PTN certas; CHO em mg (erro de fato); LIP divergente (1,3 g/kg com 91 g). Dá 3 corretas, 1 divergente, 1 com erro. */
const MISTAS: Respostas = { ...CERTAS, CHO: [6, 420000], LIP: [1.3, 91] };

/** Caso 1: só a TMB certa; GET com conta errada, CHO em mg e PTN fora da faixa (3 erros); LIP divergente. Dá 1 correta, 1 divergente, 3 com erro. */
const MUITOS_ERROS: Respostas = { ...CERTAS, GET: [1.8, 2000], CHO: [6, 420000], PTN: [3, 210], LIP: [1.3, 91] };

describe('ResolucoesComponent (Minhas resoluções)', () => {
  let fixture: ComponentFixture<ResolucoesComponent>;
  let raizDoc: HarnessLoader;
  let service: ResolucaoService;
  let casos: CasoService;
  let navegar: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [ResolucoesModule],
      providers: [
        provideRouter([]),
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        { provide: CARREGADOR_TACO, useValue: async () => ALIMENTOS.map((a) => ({ ...a })) },
      ],
    });
    service = TestBed.inject(ResolucaoService);
    casos = TestBed.inject(CasoService);
    navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await TestBed.inject(AlimentoService).carregar();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  // ---------- montagem das tentativas ----------

  function iniciar(casoId = CASO.id): string {
    return service.iniciar(casoId)!.id;
  }

  async function submetida(respostas: Respostas = CERTAS, casoId = CASO.id): Promise<string> {
    const id = iniciar(casoId);
    for (const etapa of casos.listarEtapas(casoId)) {
      const [parametro, valor] = respostas[etapa.tipo];
      service.salvarResposta(id, etapa.id, parametro, valor);
    }
    const refeicao = service.criarRefeicao(id, { nome: 'Almoço', horario: '12:00', marcador: 'nenhum' })!;
    service.criarItem(refeicao.id, { alimentoId: 'a1', quantidadeGramas: 300 });
    expect(await service.submeter(id), 'a tentativa de teste precisa ser submetida').toBeDefined();
    return id;
  }

  async function abrir(): Promise<void> {
    fixture = TestBed.createComponent(ResolucoesComponent);
    raizDoc = TestbedHarnessEnvironment.documentRootLoader(fixture);
    await fixture.whenStable();
  }

  // ---------- leitura da tela ----------

  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const limpo = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();
  const texto = (seletor: string): string => limpo(raiz().querySelector(seletor)?.textContent);
  const linhas = (): HTMLElement[] => Array.from(raiz().querySelectorAll<HTMLElement>('tr.linha-resolucao'));
  const celula = (linha: HTMLElement, coluna: string): string => limpo(linha.querySelector(`.coluna-${coluna}`)?.textContent);
  const botoes = (linha: HTMLElement): string[] =>
    Array.from(linha.querySelectorAll('.coluna-acoes button'), (b) => limpo(b.textContent));
  const avisos = async (): Promise<string[]> =>
    Promise.all((await raizDoc.getAllHarnesses(MatSnackBarHarness)).map((a) => a.getMessage()));

  async function clicar(linha: number, acao: 'continuar' | 'resultado' | 'refazer' | 'excluir'): Promise<void> {
    const botao = linhas()[linha].querySelector<HTMLButtonElement>(`.acao-${acao}`);
    expect(botao, `botão ${acao} da linha ${linha}`).not.toBeNull();
    botao!.click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function botaoDoDialogo(seletor: '.confirmar-cancelar' | '.confirmar-excluir'): Promise<void> {
    const dialogo = await raizDoc.getHarness(MatDialogHarness);
    await (await dialogo.getHarness(MatButtonHarness.with({ selector: seletor }))).click();
    await fixture.whenStable();
  }

  // ---------- estado vazio ----------

  describe('sem nenhuma resolução', () => {
    beforeEach(abrir);

    it('mostra o título, o estado vazio e nenhuma tabela', () => {
      expect(texto('h1.page-title')).toBe('Minhas resoluções');
      expect(texto('.sem-resolucoes-titulo')).toBe('Você ainda não resolveu nenhum caso');
      expect(raiz().querySelector('table')).toBeNull();
    });

    it('tem um link para o catálogo de casos', () => {
      const link = raiz().querySelector('.ir-catalogo') as HTMLAnchorElement;
      expect(link.textContent).toContain('Ver casos');
      expect(link.getAttribute('href')).toBe('/casos');
    });
  });

  // ---------- tabela ----------

  describe('com resoluções', () => {
    it('lista caso, data, status e etapas, da mais recente para a mais antiga, sem estado vazio', async () => {
      const antiga = await submetida(CERTAS);
      const recente = iniciar(OUTRO_CASO.id);
      await abrir();

      expect(raiz().querySelector('.sem-resolucoes')).toBeNull();
      expect(raiz().querySelector('table')?.getAttribute('aria-label')).toBe('Minhas resoluções');
      expect(Array.from(raiz().querySelectorAll('th'), (th) => limpo(th.textContent))).toEqual([
        'Caso',
        'Data',
        'Status',
        'Etapas',
        'Ações',
      ]);
      const [primeira, segunda] = linhas();
      expect(linhas().length).toBe(2);
      expect(celula(primeira, 'caso')).toBe(OUTRO_CASO.titulo);
      expect(celula(segunda, 'caso')).toBe(CASO.titulo);
      expect(celula(primeira, 'data')).toBe(formatDate(service.buscar(recente)!.data, 'dd/MM/yyyy HH:mm', 'en-US'));
      expect(celula(segunda, 'data')).toBe(formatDate(service.buscar(antiga)!.data, 'dd/MM/yyyy HH:mm', 'en-US'));
      expect(celula(primeira, 'data')).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
    });

    it('em andamento: status em texto, sem classificação (RF09) e só Continuar, Refazer e Excluir', async () => {
      iniciar();
      await abrir();

      const [linha] = linhas();
      expect(celula(linha, 'status')).toBe('Em andamento');
      expect(celula(linha, 'etapas')).toBe('Aguardando submissão');
      expect(linha.querySelector('.etapas-corretas, .etapas-divergentes, .etapas-erro')).toBeNull();
      expect(botoes(linha)).toEqual(['Continuar', 'Refazer', 'Excluir']);
    });

    it('submetida: status em texto, contagem das etapas e só Ver resultado, Refazer e Excluir', async () => {
      await submetida(MISTAS);
      await abrir();

      const [linha] = linhas();
      expect(celula(linha, 'status')).toBe('Submetida');
      expect(celula(linha, 'etapas')).toBe('3 corretas, 1 divergente, 1 com erro');
      expect(botoes(linha)).toEqual(['Ver resultado', 'Refazer', 'Excluir']);
    });

    it('a contagem mostra cada número no seu lugar, com singular e plural', async () => {
      await submetida(MUITOS_ERROS);
      await abrir();

      expect(celula(linhas()[0], 'etapas')).toBe('1 correta, 1 divergente, 3 com erro');
    });

    it('a contagem conta zeros', async () => {
      await submetida(CERTAS);
      await abrir();

      expect(celula(linhas()[0], 'etapas')).toBe('5 corretas, 0 divergentes, 0 com erro');
    });

    it('os botões dizem de qual caso são, para quem usa leitor de tela', async () => {
      iniciar();
      await submetida();
      await abrir();

      const rotulos = (linha: HTMLElement) =>
        Array.from(linha.querySelectorAll('.coluna-acoes button'), (b) => b.getAttribute('aria-label'));
      expect(rotulos(linhas()[0])).toEqual([
        `Ver resultado de ${CASO.titulo}`,
        `Refazer ${CASO.titulo}`,
        `Excluir resolução de ${CASO.titulo}`,
      ]);
      expect(rotulos(linhas()[1])).toEqual([
        `Continuar ${CASO.titulo}`,
        `Refazer ${CASO.titulo}`,
        `Excluir resolução de ${CASO.titulo}`,
      ]);
    });

    it('caso excluído pelo docente aparece como "Caso excluído", e a tentativa continua na lista', async () => {
      await submetida();
      expect(casos.excluir(CASO.id)).toBe(true);
      await abrir();

      expect(celula(linhas()[0], 'caso')).toBe('Caso excluído');
      expect(celula(linhas()[0], 'status')).toBe('Submetida');
    });
  });

  // ---------- ações ----------

  describe('Continuar', () => {
    it('abre a tela de resolver da tentativa em andamento', async () => {
      const id = iniciar();
      await abrir();

      await clicar(0, 'continuar');

      expect(navegar).toHaveBeenCalledTimes(1);
      expect(navegar).toHaveBeenCalledWith(['/resolucoes', id]);
    });
  });

  describe('Ver resultado', () => {
    it('abre o resultado da tentativa submetida', async () => {
      const id = await submetida();
      await abrir();

      await clicar(0, 'resultado');

      expect(navegar).toHaveBeenCalledTimes(1);
      expect(navegar).toHaveBeenCalledWith(['/resolucoes', id, 'resultado']);
    });
  });

  describe('Refazer', () => {
    it('cria uma tentativa nova do mesmo caso, vazia, abre a nova e mantém a submetida intacta', async () => {
      const anterior = await submetida(MISTAS);
      await abrir();

      await clicar(0, 'refazer');

      const todas = service.listar();
      expect(todas.length).toBe(2);
      const nova = todas.find((r) => r.id !== anterior)!;
      expect(nova.casoId).toBe(CASO.id);
      expect(nova.status).toBe('em andamento');
      expect(service.listarRespostas(nova.id)).toEqual([]);
      expect(service.buscar(anterior)!.status).toBe('submetida');
      expect(service.contagemEtapas(anterior)).toEqual({ corretas: 3, divergentes: 1, comErro: 1 });
      expect(navegar).toHaveBeenCalledWith(['/resolucoes', nova.id]);
    });

    it('a tabela passa a mostrar a tentativa nova sem recarregar', async () => {
      iniciar();
      await abrir();

      await clicar(0, 'refazer');

      expect(linhas().length).toBe(2);
      expect(linhas().map((l) => celula(l, 'status'))).toEqual(['Em andamento', 'Em andamento']);
    });

    it('com o caso excluído, avisa e não cria nem navega', async () => {
      iniciar();
      casos.excluir(CASO.id);
      await abrir();

      await clicar(0, 'refazer');

      expect(service.listar().length).toBe(1);
      expect(navegar).not.toHaveBeenCalled();
      expect(await avisos()).toEqual(['Não foi possível refazer: o caso não existe mais']);
    });
  });

  describe('Excluir', () => {
    it('pede confirmação dizendo qual resolução vai, e nada some antes de confirmar', async () => {
      const id = await submetida();
      await abrir();

      await clicar(0, 'excluir');

      const dialogo = await raizDoc.getHarness(MatDialogHarness);
      const conteudo = limpo(await dialogo.getText());
      expect(conteudo).toContain('Excluir resolução?');
      expect(conteudo).toContain('resolução submetida');
      expect(conteudo).toContain(CASO.titulo);
      expect(conteudo).toContain(celula(linhas()[0], 'data'));
      expect(conteudo).toContain('e o resultado');
      expect(service.buscar(id)).toBeDefined();
      expect(linhas().length).toBe(1);
    });

    it('o texto de uma em andamento fala de justificativa, não de resultado', async () => {
      iniciar();
      await abrir();

      await clicar(0, 'excluir');

      const conteudo = limpo(await (await raizDoc.getHarness(MatDialogHarness)).getText());
      expect(conteudo).toContain('resolução em andamento');
      expect(conteudo).toContain('e a justificativa');
      expect(conteudo).not.toContain('e o resultado');
    });

    it('Cancelar mantém a resolução e não avisa', async () => {
      const id = await submetida();
      await abrir();
      await clicar(0, 'excluir');

      await botaoDoDialogo('.confirmar-cancelar');

      expect(service.buscar(id)).toBeDefined();
      expect(linhas().length).toBe(1);
      expect(await raizDoc.getAllHarnesses(MatDialogHarness)).toEqual([]);
      expect(await avisos()).toEqual([]);
    });

    it('Excluir apaga só aquela resolução (com as respostas e a avaliação), atualiza a tabela e avisa', async () => {
      const mantida = await submetida(CERTAS);
      const apagada = await submetida(MISTAS);
      await abrir();
      expect(linhas().length).toBe(2);

      await clicar(0, 'excluir'); // a mais recente: MISTAS
      await botaoDoDialogo('.confirmar-excluir');

      expect(service.buscar(apagada)).toBeUndefined();
      expect(service.listarRespostas(apagada)).toEqual([]);
      expect(service.contagemEtapas(apagada)).toBeUndefined();
      expect(service.buscar(mantida)).toBeDefined();
      expect(service.contagemEtapas(mantida)).toEqual({ corretas: 5, divergentes: 0, comErro: 0 });
      expect(linhas().length).toBe(1);
      expect(celula(linhas()[0], 'etapas')).toBe('5 corretas, 0 divergentes, 0 com erro');
      expect(await raizDoc.getAllHarnesses(MatDialogHarness)).toEqual([]);
      expect(await avisos()).toEqual(['Resolução excluída']);
    });

    it('excluir a última volta ao estado vazio, com o link para o catálogo', async () => {
      iniciar();
      await abrir();

      await clicar(0, 'excluir');
      await botaoDoDialogo('.confirmar-excluir');

      expect(raiz().querySelector('table')).toBeNull();
      expect(raiz().querySelector('.sem-resolucoes')).not.toBeNull();
      expect((raiz().querySelector('.ir-catalogo') as HTMLAnchorElement).getAttribute('href')).toBe('/casos');
    });

    it('se a resolução sumiu enquanto o diálogo estava aberto, avisa que não encontrou', async () => {
      const id = iniciar();
      await abrir();
      await clicar(0, 'excluir');

      service.excluir(id); // outra aba, por exemplo
      await botaoDoDialogo('.confirmar-excluir');

      expect(await avisos()).toEqual(['Não foi possível excluir: resolução não encontrada']);
    });
  });
});
