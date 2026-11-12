import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatExpansionPanelHarness } from '@angular/material/expansion/testing';
import { MatStepperHarness } from '@angular/material/stepper/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { EQUACOES_TMB } from '../../../core/avaliacao/formulas';
import { ATLETAS_EXEMPLO, CASOS_EXEMPLO } from '../../../core/data/casos-exemplo';
import { Alimento } from '../../../core/models';
import { CARREGADOR_TACO } from '../../../core/services/alimento.service';
import { CasoService } from '../../../core/services/caso.service';
import { ResolucaoService } from '../../../core/services/resolucao.service';
import { ResolucoesModule } from '../resolucoes.module';
import { ResolverComponent } from './resolver.component';

const CASO = CASOS_EXEMPLO[0]; // Maratonista em fase de base; atleta Carlos Menezes
const ATLETA = ATLETAS_EXEMPLO[0];

// Um alimento só, para poder submeter uma tentativa de verdade.
const ALIMENTOS: Alimento[] = [
  { id: 'a1', nome: 'Alimento de teste', grupo: 'Teste', kcal: 100, carboidrato: 14, proteina: 3.7, gordura: 2.3, origem: 'TACO' },
];

describe('ResolverComponent', () => {
  let fixture: ComponentFixture<ResolverComponent>;
  let loader: HarnessLoader;
  let service: ResolucaoService;
  let casos: CasoService;
  let navegar: ReturnType<typeof vi.spyOn>;
  let parametros: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(() => {
    localStorage.clear();
    parametros = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({
      // Importa o módulo (e não só declara o componente): o template é compilado com o escopo do módulo.
      imports: [ResolucoesModule],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: parametros } },
        // Sem animação no teste: o stepper e o painel mudam na hora.
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        { provide: CARREGADOR_TACO, useValue: async () => ALIMENTOS.map((a) => ({ ...a })) },
      ],
    });
    service = TestBed.inject(ResolucaoService);
    casos = TestBed.inject(CasoService);
    navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  /** Abre a tela como a rota `/resolucoes/:id` abriria. */
  async function abrir(id: string): Promise<void> {
    parametros.next(convertToParamMap({ id }));
    fixture = TestBed.createComponent(ResolverComponent);
    loader = TestbedHarnessEnvironment.loader(fixture);
    await fixture.whenStable();
  }

  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texto = (seletor: string): string | undefined => raiz().querySelector(seletor)?.textContent?.trim();

  /** Tentativa do caso 1 pronta para submeter: as 5 respostas certas e um item de dieta. */
  function criarCompleta(): string {
    const certas: Record<string, [string | number, number]> = {
      TMB: ['Mifflin-St Jeor', 1671.25],
      GET: [1.8, 3008.25],
      CHO: [6, 420],
      PTN: [1.6, 112],
      LIP: [1, 70],
    };
    const resolucao = service.iniciar(CASO.id)!;
    for (const etapa of casos.listarEtapas(CASO.id)) {
      const [parametro, valor] = certas[etapa.tipo];
      service.salvarResposta(resolucao.id, etapa.id, parametro, valor);
    }
    const refeicao = service.criarRefeicao(resolucao.id, { nome: 'Café', horario: '07:00', marcador: 'nenhum' })!;
    service.criarItem(refeicao.id, { alimentoId: 'a1', quantidadeGramas: 100 });
    return resolucao.id;
  }

  async function criarSubmetida(): Promise<string> {
    const id = criarCompleta();
    expect(await service.submeter(id)).toBeDefined();
    return id;
  }

  describe('tentativa em andamento', () => {
    beforeEach(async () => {
      await abrir(service.iniciar(CASO.id)!.id);
    });

    it('mostra o título do caso, a ficha do atleta e o passo a passo', () => {
      expect(texto('h1.page-title')).toBe(CASO.titulo);
      expect(raiz().querySelector('app-ficha-atleta')).not.toBeNull();
      expect(raiz().querySelector('mat-stepper')).not.toBeNull();
      expect(raiz().querySelector('.mensagem-erro')).toBeNull();
      expect(navegar).not.toHaveBeenCalled();
    });

    it('a ficha mostra o atleta do caso, com a modalidade do caso', () => {
      expect(texto('.ficha-nome dd')).toBe(ATLETA.nome);
      expect(texto('.ficha-peso dd')).toBe('70 kg');
      expect(texto('.ficha-modalidade dd')).toBe(CASO.modalidade);
    });

    it('o stepper tem os passos Etapas, Dieta, Justificativa e Revisar, cada um "em construção"', async () => {
      const stepper = await loader.getHarness(MatStepperHarness);
      const passos = await stepper.getSteps();

      expect(await Promise.all(passos.map((p) => p.getLabel()))).toEqual(['Etapas', 'Dieta', 'Justificativa', 'Revisar']);
      expect(raiz().querySelectorAll('mat-step .em-construcao, .em-construcao').length).toBeGreaterThanOrEqual(4);
    });

    it('não é linear: dá para ir ao último passo sem preencher os anteriores, e voltar', async () => {
      const passos = await (await loader.getHarness(MatStepperHarness)).getSteps();
      expect(await passos[0].isSelected()).toBe(true);

      await passos[3].select();
      expect(await passos[3].isSelected()).toBe(true);

      await passos[1].select();
      expect(await passos[1].isSelected()).toBe(true);
    });

    it('a ficha continua na tela em todos os passos (RF05)', async () => {
      const passos = await (await loader.getHarness(MatStepperHarness)).getSteps();

      for (const passo of passos) {
        await passo.select();
        expect(raiz().querySelector('app-ficha-atleta .ficha-nome dd')?.textContent?.trim(), await passo.getLabel()).toBe(ATLETA.nome);
      }
    });

    it('a ficha fica ao lado do passo a passo, fora do stepper', () => {
      const ficha = raiz().querySelector('app-ficha-atleta');
      const stepper = raiz().querySelector('mat-stepper');

      expect(ficha?.closest('mat-stepper')).toBeNull();
      expect(ficha?.closest('.resolver-lateral')).not.toBeNull();
      expect(stepper?.closest('.resolver-passos')).not.toBeNull();
      expect(ficha?.closest('.resolver-layout')).toBe(stepper?.closest('.resolver-layout'));
    });
  });

  describe('material de referência (RF06)', () => {
    beforeEach(async () => {
      await abrir(service.iniciar(CASO.id)!.id);
    });

    it('é um painel de expansão com o título "Material de referência", fechado no começo', async () => {
      const painel = await loader.getHarness(MatExpansionPanelHarness);

      expect(await painel.getTitle()).toBe('Material de referência');
      expect(await painel.isExpanded()).toBe(false);
      await painel.toggle();
      expect(await painel.isExpanded()).toBe(true);
    });

    it('traz o aviso de valores de exemplo', () => {
      expect(texto('.material-referencia .aviso-exemplo')).toBe('Valores de exemplo, aguardam validação docente.');
    });

    it('traz as três equações da TMB, com a fonte e a fórmula em texto', () => {
      const nomes = Array.from(raiz().querySelectorAll('.material-equacao-nome'), (h) => h.textContent?.replace(/\s+/g, ' ').trim());

      expect(nomes).toEqual([
        'Harris-Benedict revisada (Roza e Shizgal, 1984)',
        'Mifflin-St Jeor (Mifflin e colaboradores, 1990)',
        'Cunningham (Cunningham, 1980)',
      ]);
      expect(EQUACOES_TMB.length).toBe(nomes.length);
      const formulas = texto('.material-equacoes') ?? '';
      expect(formulas).toContain('88,362 + 13,397 × peso + 4,799 × altura − 5,677 × idade');
      expect(formulas).toContain('447,593 + 9,247 × peso + 3,098 × altura − 4,330 × idade');
      expect(formulas).toContain('10 × peso + 6,25 × altura − 5 × idade + 5 (homem) ou − 161 (mulher)');
      expect(formulas).toContain('500 + 22 × massa livre de gordura');
      expect(formulas).toContain('Exige o percentual de gordura');
    });

    it('traz as faixas aceitáveis das etapas numéricas do caso', () => {
      const faixas = Array.from(raiz().querySelectorAll('.material-faixa'), (f) => [
        f.querySelector('dt')?.textContent?.trim(),
        f.querySelector('dd')?.textContent?.trim(),
      ]);

      expect(faixas).toEqual([
        ['Fator de atividade (GET)', '1,4 a 2,2'],
        ['Carboidrato (g/kg/dia)', '4 a 10'],
        ['Proteína (g/kg/dia)', '1,2 a 2,2'],
        ['Gordura (g/kg/dia)', '0,5 a 1,5'],
      ]);
    });

    it('as faixas acompanham as etapas do caso: se o docente mudar a faixa, a tela mostra a nova', async () => {
      casos.atualizarEtapas(
        CASO.id,
        casos.listarEtapas(CASO.id).map((e) => (e.tipo === 'CHO' ? { ...e, faixaAceitavel: { min: 5, max: 9.5 } } : e)),
      );
      await abrir(service.iniciar(CASO.id)!.id);

      expect(raiz().querySelectorAll('.material-faixa dd')[1]?.textContent?.trim()).toBe('5 a 9,5');
    });

    it('não mostra a referência do caso nem o critério (isso só aparece no resultado)', () => {
      const material = texto('.material-referencia') ?? '';

      for (const etapa of casos.listarEtapas(CASO.id)) {
        expect(material, etapa.id).not.toContain(etapa.criterioReferencia);
      }
      // referências do caso 1: GET 1,8 · PTN 1,6 · CHO 6 g/kg · LIP 1 g/kg; as faixas dele não repetem esses números sozinhos
      expect(material).not.toContain('1,8');
      expect(material).not.toContain('1,6');
      expect(material).not.toMatch(/refer[êe]ncia do caso/i);
      expect(material).not.toMatch(/recomendad/i);
    });
  });

  describe('tentativa que não existe', () => {
    it('mostra a mensagem e o link para o catálogo, sem o passo a passo', async () => {
      await abrir('nao-existe');

      expect(texto('.mensagem-erro h1')).toBe('Resolução não encontrada');
      expect(texto('.mensagem-erro p')).toContain('Não existe uma resolução');
      expect(raiz().querySelector('.mensagem-erro')?.getAttribute('role')).toBe('alert');
      const link = raiz().querySelector('.voltar-catalogo') as HTMLAnchorElement;
      expect(link.textContent).toContain('Voltar ao catálogo');
      expect(link.getAttribute('href')).toBe('/casos');
      expect(raiz().querySelector('mat-stepper')).toBeNull();
      expect(raiz().querySelector('app-ficha-atleta')).toBeNull();
      expect(navegar).not.toHaveBeenCalled();
    });

    it('rota sem id também cai na mensagem', async () => {
      parametros.next(convertToParamMap({}));
      fixture = TestBed.createComponent(ResolverComponent);
      await fixture.whenStable();

      expect(texto('.mensagem-erro h1')).toBe('Resolução não encontrada');
    });

    it('caso excluído depois de iniciar: mensagem própria e link para o catálogo', async () => {
      const resolucao = service.iniciar(CASO.id)!;
      casos.excluir(CASO.id);

      await abrir(resolucao.id);

      expect(texto('.mensagem-erro h1')).toBe('Caso não encontrado');
      expect(texto('.mensagem-erro p')).toContain('não existe mais');
      expect((raiz().querySelector('.voltar-catalogo') as HTMLAnchorElement).getAttribute('href')).toBe('/casos');
      expect(raiz().querySelector('mat-stepper')).toBeNull();
    });
  });

  describe('tentativa submetida', () => {
    it('redireciona para o resultado, trocando a entrada do histórico, e não mostra o passo a passo', async () => {
      const id = await criarSubmetida();

      await abrir(id);

      expect(navegar).toHaveBeenCalledWith(['/resolucoes', id, 'resultado'], { replaceUrl: true });
      expect(raiz().querySelector('mat-stepper')).toBeNull();
      expect(raiz().querySelector('app-ficha-atleta')).toBeNull();
      expect(texto('.mensagem-abrindo')).toContain('Abrindo o resultado');
    });

    it('se a tentativa for submetida enquanto a tela está aberta, vai para o resultado', async () => {
      const id = criarCompleta();
      await abrir(id);
      expect(navegar).not.toHaveBeenCalled();

      await service.submeter(id);
      await fixture.whenStable();

      expect(navegar).toHaveBeenCalledWith(['/resolucoes', id, 'resultado'], { replaceUrl: true });
    });
  });

  it('acompanha a rota: se o id mudar com a tela aberta, mostra a outra tentativa', async () => {
    const primeira = service.iniciar(CASO.id)!;
    const segunda = service.iniciar('exemplo-caso-2')!;
    await abrir(primeira.id);
    expect(texto('h1.page-title')).toBe(CASOS_EXEMPLO[0].titulo);

    parametros.next(convertToParamMap({ id: segunda.id }));
    await fixture.whenStable();

    expect(texto('h1.page-title')).toBe(CASOS_EXEMPLO[1].titulo);
    expect(texto('.ficha-nome dd')).toBe(ATLETAS_EXEMPLO[1].nome);
  });
});
