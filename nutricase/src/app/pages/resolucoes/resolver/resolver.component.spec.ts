import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatDialogHarness } from '@angular/material/dialog/testing';
import { MatExpansionPanelHarness } from '@angular/material/expansion/testing';
import { MatInputHarness } from '@angular/material/input/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { MatSnackBarHarness } from '@angular/material/snack-bar/testing';
import { MatStepperHarness } from '@angular/material/stepper/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { EQUACOES_TMB } from '../../../core/avaliacao/formulas';
import { ATLETAS_EXEMPLO, CASOS_EXEMPLO } from '../../../core/data/casos-exemplo';
import { Alimento } from '../../../core/models';
import { CARREGADOR_TACO } from '../../../core/services/alimento.service';
import { CasoService } from '../../../core/services/caso.service';
import { ResolucaoService } from '../../../core/services/resolucao.service';
import { PassoJustificativaComponent } from '../passo-justificativa/passo-justificativa.component';
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

    it('o stepper tem os passos Etapas, Dieta, Justificativa e Revisar, cada um já com o seu conteúdo', async () => {
      const stepper = await loader.getHarness(MatStepperHarness);
      const passos = await stepper.getSteps();

      expect(await Promise.all(passos.map((p) => p.getLabel()))).toEqual(['Etapas', 'Dieta', 'Justificativa', 'Revisar']);
      expect(raiz().querySelectorAll('app-passo-etapas').length).toBe(1);
      expect(raiz().querySelectorAll('app-passo-dieta').length).toBe(1);
      expect(raiz().querySelectorAll('app-passo-justificativa').length).toBe(1);
      expect(raiz().querySelectorAll('app-passo-revisar').length).toBe(1);
      expect(raiz().querySelectorAll('.em-construcao').length).toBe(0); // nenhum passo em construção
    });

    it('o passo Dieta recebe a mesma tentativa: começa sem refeições', () => {
      expect(texto('app-passo-dieta .sem-refeicoes')).toBe('Nenhuma refeição ainda. Adicione a primeira acima.');
      expect(texto('app-passo-dieta .secao-titulo')).toBe('Nova refeição');
    });

    it('o passo Etapas começa na etapa 1 de 5 da tentativa', () => {
      expect(texto('app-passo-etapas .etapa-numero')).toBe('Etapa 1 de 5');
      expect(texto('app-passo-etapas .etapa-titulo')).toBe('Taxa metabólica basal (TMB)');
    });

    it('ao sair do passo Etapas pelo cabeçalho do stepper, salva a etapa que estava na tela', async () => {
      const [tmbEtapa] = casos.listarEtapas(CASO.id);
      const resolucaoId = service.listar()[0].id;
      const select = await loader.getHarness(MatSelectHarness);
      await select.open();
      await select.clickOptions({ text: 'Mifflin-St Jeor' });
      await (await loader.getHarness(MatInputHarness.with({ selector: '[formControlName="valor"]' }))).setValue('1671.25');
      expect(service.listarRespostas(resolucaoId)).toEqual([]); // ainda não saiu do passo

      await (await (await loader.getHarness(MatStepperHarness)).getSteps())[1].select();

      expect(service.listarRespostas(resolucaoId)).toEqual([
        expect.objectContaining({ etapaId: tmbEtapa.id, parametro: 'Mifflin-St Jeor', valor: 1671.25 }),
      ]);
    });

    it('sair do passo com a etapa inválida não salva', async () => {
      const resolucaoId = service.listar()[0].id;
      await (await loader.getHarness(MatInputHarness.with({ selector: '[formControlName="valor"]' }))).setValue('0');

      await (await (await loader.getHarness(MatStepperHarness)).getSteps())[2].select();

      expect(service.listarRespostas(resolucaoId)).toEqual([]);
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

  describe('passos Justificativa e Revisar', () => {
    let resolucaoId: string;

    beforeEach(async () => {
      resolucaoId = service.listar().length > 0 ? service.listar()[0].id : service.iniciar(CASO.id)!.id;
      await abrir(resolucaoId);
    });

    const passos = async () => (await loader.getHarness(MatStepperHarness)).getSteps();
    const justificativa = () => loader.getHarness(MatInputHarness.with({ selector: 'app-passo-justificativa textarea' }));
    const botao = async (seletor: string, indice = 0) => (await loader.getAllHarnesses(MatButtonHarness.with({ selector: seletor })))[indice];

    it('o passo Justificativa mostra o campo e o aviso de que não há avaliação automática', async () => {
      await (await passos())[2].select();

      expect(texto('app-passo-justificativa .aviso-justificativa')).toBe('A justificativa não recebe avaliação automática.');
      expect(raiz().querySelectorAll('app-passo-justificativa textarea').length).toBe(1);
    });

    it('ao sair do passo Justificativa pelo cabeçalho do stepper, salva o texto digitado', async () => {
      const todos = await passos();
      await todos[2].select();
      await (await justificativa()).setValue('Escolhas feitas pelo volume de treino.');
      expect(service.buscar(resolucaoId)!.justificativa).toBe('');

      await todos[3].select();

      expect(service.buscar(resolucaoId)!.justificativa).toBe('Escolhas feitas pelo volume de treino.');
      expect(texto('app-passo-revisar .justificativa-texto')).toBe('Escolhas feitas pelo volume de treino.');
    });

    it('o resolver salva a justificativa ao sair do passo mesmo sem o campo ter perdido o foco (ligação do selectionChange)', async () => {
      const todos = await passos();
      await todos[2].select();
      // altera o controle direto, sem passar pelo (blur) do campo: só o resolver pode salvar aqui
      const passo = fixture.debugElement.query(By.directive(PassoJustificativaComponent)).componentInstance as PassoJustificativaComponent;
      const controle = (passo as unknown as { formulario(): { controls: { texto: { setValue(v: string): void; markAsDirty(): void } } } }).formulario().controls.texto;
      controle.setValue('Salvo pelo resolver');
      controle.markAsDirty();
      expect(service.buscar(resolucaoId)!.justificativa).toBe('');

      await todos[3].select();

      expect(service.buscar(resolucaoId)!.justificativa).toBe('Salvo pelo resolver');
    });

    it('"Próxima" no passo Justificativa vai para Revisar, salvando o texto; "Anterior" volta', async () => {
      const todos = await passos();
      await todos[2].select();
      await (await justificativa()).setValue('Texto');

      await (await botao('.passo-proximo')).click();

      expect(await todos[3].isSelected()).toBe(true);
      expect(service.buscar(resolucaoId)!.justificativa).toBe('Texto');

      await (await botao('.passo-anterior', 1)).click(); // o Anterior do passo Revisar
      expect(await todos[2].isSelected()).toBe(true);
    });

    it('"Anterior" no passo Justificativa volta para a Dieta', async () => {
      const todos = await passos();
      await todos[2].select();

      await (await botao('.passo-anterior', 0)).click();

      expect(await todos[1].isSelected()).toBe(true);
    });

    it('o passo Revisar lista as pendências, e cada botão leva ao passo certo (etapas = 1º, dieta = 2º)', async () => {
      const todos = await passos();
      await todos[3].select();
      expect(raiz().querySelectorAll('app-passo-revisar .pendencia-texto').length).toBe(6);

      await (await botao('.pendencia-ir', 5)).click(); // a dieta
      expect(await todos[1].isSelected()).toBe(true);

      await todos[3].select();
      await (await botao('.pendencia-ir', 0)).click(); // a etapa 1
      expect(await todos[0].isSelected()).toBe(true);
    });

    it('a pendência de uma etapa leva direto a ela: o passo Etapas abre na etapa certa', async () => {
      const todos = await passos();
      await todos[3].select();

      await (await botao('.pendencia-ir', 3)).click(); // "Etapa 4 (PTN) sem resposta."

      expect(await todos[0].isSelected()).toBe(true);
      expect(texto('app-passo-etapas .etapa-numero')).toBe('Etapa 4 de 5');
      expect(texto('app-passo-etapas .campo-parametro mat-label')).toBe('Proteína');
    });

    it('cada pendência de etapa abre a sua etapa, da primeira à última', async () => {
      const todos = await passos();
      for (const n of [5, 2, 1, 3]) {
        await todos[3].select();
        await (await botao('.pendencia-ir', n - 1)).click();

        expect(texto('app-passo-etapas .etapa-numero'), `pendência da etapa ${n}`).toBe(`Etapa ${n} de 5`);
      }
    });

    it('a pendência da dieta leva ao passo Dieta, sem mexer na etapa aberta', async () => {
      const todos = await passos();
      await todos[3].select();

      await (await botao('.pendencia-ir', 5)).click();

      expect(await todos[1].isSelected()).toBe(true);
      expect(texto('app-passo-etapas .etapa-numero')).toBe('Etapa 1 de 5');
    });

    it('sair do passo Etapas pelo cabeçalho com um valor inválido avisa que a resposta não foi salva', async () => {
      const todos = await passos();
      const valor = await loader.getHarness(MatInputHarness.with({ selector: 'app-passo-etapas input[formControlName="valor"]' }));
      await valor.setValue('0');

      await todos[1].select();

      const avisos = await Promise.all(
        (await TestbedHarnessEnvironment.documentRootLoader(fixture).getAllHarnesses(MatSnackBarHarness)).map((a) => a.getMessage()),
      );
      expect(avisos).toEqual(['A etapa 1 não foi salva: há valores inválidos. Volte ao passo Etapas para corrigir.']);
    });

    it('sair pelo cabeçalho sem ter mexido na etapa não avisa nada', async () => {
      await (await passos())[1].select();

      const avisos = await TestbedHarnessEnvironment.documentRootLoader(fixture).getAllHarnesses(MatSnackBarHarness);
      expect(avisos.length).toBe(0);
    });

    it('com pendências, o Submeter fica desativado no passo Revisar', async () => {
      await (await passos())[3].select();

      expect(await (await botao('.revisar-submeter')).isDisabled()).toBe(true);
      expect(texto('app-passo-revisar .submeter-explicacao')).toContain('resolva as 6 pendências');
    });
  });

  describe('submeter pela tela do resolver', () => {
    const dialogoDoDoc = () => TestbedHarnessEnvironment.documentRootLoader(fixture).getHarness(MatDialogHarness);

    it('tentativa completa: Revisar → Submeter → confirmar leva ao resultado', async () => {
      const id = criarCompleta();
      service.salvarJustificativa(id, 'Justificativa de teste.');
      await abrir(id);
      await (await (await loader.getHarness(MatStepperHarness)).getSteps())[3].select();
      const submeter = await loader.getHarness(MatButtonHarness.with({ selector: '.revisar-submeter' }));
      expect(await submeter.isDisabled()).toBe(false);

      await submeter.click();
      await (await (await dialogoDoDoc()).getHarness(MatButtonHarness.with({ selector: '.confirmar-submeter' }))).click();
      await fixture.whenStable();

      expect(service.buscar(id)!.status).toBe('submetida');
      expect(navegar).toHaveBeenCalledWith(['/resolucoes', id, 'resultado'], { replaceUrl: true });
    });

    it('cancelar no diálogo deixa a tentativa em andamento e na tela', async () => {
      const id = criarCompleta();
      await abrir(id);
      await (await (await loader.getHarness(MatStepperHarness)).getSteps())[3].select();
      await (await loader.getHarness(MatButtonHarness.with({ selector: '.revisar-submeter' }))).click();

      await (await (await dialogoDoDoc()).getHarness(MatButtonHarness.with({ selector: '.confirmar-cancelar' }))).click();
      await fixture.whenStable();

      expect(service.buscar(id)!.status).toBe('em andamento');
      expect(navegar).not.toHaveBeenCalled();
      expect(raiz().querySelector('mat-stepper')).not.toBeNull();
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
