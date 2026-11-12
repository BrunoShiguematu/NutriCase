import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatAutocompleteHarness } from '@angular/material/autocomplete/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatDialogHarness } from '@angular/material/dialog/testing';
import { MatInputHarness } from '@angular/material/input/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { MatSnackBarHarness } from '@angular/material/snack-bar/testing';
import { CASOS_EXEMPLO } from '../../../core/data/casos-exemplo';
import { Alimento, Resolucao, TipoEtapa } from '../../../core/models';
import { AlimentoService, CarregadorTaco, CARREGADOR_TACO } from '../../../core/services/alimento.service';
import { CasoService } from '../../../core/services/caso.service';
import { ResolucaoService } from '../../../core/services/resolucao.service';
import { ResolucoesModule } from '../resolucoes.module';
import { PassoDietaComponent } from './passo-dieta.component';

const CASO = CASOS_EXEMPLO[0];

function alimento(id: string, nome: string, kcal: number, carboidrato: number, proteina: number, gordura: number): Alimento {
  return { id, nome, grupo: 'Teste', kcal, carboidrato, proteina, gordura, origem: 'TACO' };
}

// Valores por 100 g (kcal, carboidrato, proteína, gordura).
const ALIMENTOS = [
  alimento('a-arroz', 'Arroz, tipo 1, cozido', 128, 28.1, 2.5, 0.2),
  alimento('a-frango', 'Peito de frango, grelhado', 159, 0, 32, 2.5),
  alimento('a-banana', 'Banana, prata', 98, 26, 1.3, 0.1),
  alimento('a-pao', 'Pão, de queijo, assado', 363, 34.2, 5.1, 24.6),
];

// Contas à mão usadas nos testes (arredondadas a 1 casa, como na tela):
//   arroz 200 g   = 256 kcal · 56,2 CHO · 5 PTN · 0,4 LIP
//   frango 100 g  = 159 kcal · 0 CHO · 32 PTN · 2,5 LIP
//   banana 120 g  = 117,6 kcal · 31,2 CHO · 1,56 PTN · 0,12 LIP
//   refeição 1 (arroz 200 + frango 100) = 415 kcal · 56,2 CHO · 37 PTN · 2,9 LIP
//   dia (+ banana 120 g)                = 532,6 kcal · 87,4 CHO · 38,56 PTN · 3,02 LIP

describe('PassoDietaComponent', () => {
  let fixture: ComponentFixture<PassoDietaComponent>;
  let loader: HarnessLoader;
  let raizDoc: HarnessLoader;
  let service: ResolucaoService;
  let alimentos: AlimentoService;
  let casos: CasoService;
  let resolucao: Resolucao;
  let carregador: CarregadorTaco;

  beforeEach(async () => {
    localStorage.clear();
    carregador = async () => ALIMENTOS.map((a) => ({ ...a }));
    await TestBed.configureTestingModule({
      // Importa o módulo (e não só declara o componente): o template é compilado com o escopo do módulo.
      imports: [ResolucoesModule],
      providers: [
        // Sem animação no teste: o diálogo, o snackbar e a lista do autocomplete abrem e fecham na hora.
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        { provide: CARREGADOR_TACO, useValue: () => carregador() },
      ],
    }).compileComponents();
    service = TestBed.inject(ResolucaoService);
    alimentos = TestBed.inject(AlimentoService);
    casos = TestBed.inject(CasoService);
    resolucao = service.iniciar(CASO.id)!;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  async function abrir(esperarBase = true): Promise<void> {
    if (esperarBase) {
      await alimentos.carregar();
    }
    fixture = TestBed.createComponent(PassoDietaComponent);
    fixture.componentRef.setInput('resolucao', resolucao);
    loader = TestbedHarnessEnvironment.loader(fixture);
    raizDoc = TestbedHarnessEnvironment.documentRootLoader(fixture);
    await fixture.whenStable();
  }

  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const limpo = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();
  const texto = (seletor: string): string => limpo(raiz().querySelector(seletor)?.textContent);
  const textos = (seletor: string): string[] => Array.from(raiz().querySelectorAll(seletor), (e) => limpo(e.textContent));
  const cartoes = (): string[] => textos('mat-card.refeicao .refeicao-nome');
  const erros = (seletor = 'mat-error'): string[] => textos(seletor);
  /** Avisos (snackbar) na tela: formato inválido só mostra o erro no campo, sem aviso. */
  const avisos = async (): Promise<string[]> =>
    Promise.all((await raizDoc.getAllHarnesses(MatSnackBarHarness)).map((a) => a.getMessage()));
  const refeicoes = () => service.listarRefeicoes(resolucao.id);
  const itens = () => service.listarItensDaResolucao(resolucao.id);

  // ---------- formulário de refeição ----------

  const campo = (nome: 'nome' | 'horario'): Promise<MatInputHarness> =>
    loader.getHarness(MatInputHarness.with({ selector: `.refeicao-form [formControlName="${nome}"]` }));
  const marcador = (): Promise<MatSelectHarness> => loader.getHarness(MatSelectHarness.with({ selector: '.refeicao-form mat-select' }));
  const salvarRefeicao = async (): Promise<void> => (await loader.getHarness(MatButtonHarness.with({ selector: '.refeicao-salvar' }))).click();

  async function adicionarRefeicao(nome: string, horario: string, escolhaMarcador?: string): Promise<void> {
    await (await campo('nome')).setValue(nome);
    await (await campo('horario')).setValue(horario);
    if (escolhaMarcador) {
      const select = await marcador();
      await select.open();
      await select.clickOptions({ text: escolhaMarcador });
    }
    await salvarRefeicao();
  }

  // ---------- alimentos ----------

  /** O Material abre o painel do autocomplete depois de um `delay(0)`, que o harness não espera num app sem zone. */
  const aguardarPainel = async (): Promise<void> => {
    await new Promise((resolver) => setTimeout(resolver, 0));
    await fixture.whenStable();
  };

  /** Inclui um alimento na refeição de posição `posicao` (1 = a primeira da tela). */
  async function incluirAlimento(posicao: number, busca: string, opcao: RegExp, gramas: string): Promise<void> {
    const cartao = await loader.getChildLoader(`mat-card.refeicao:nth-of-type(${posicao})`);
    const auto = await cartao.getHarness(MatAutocompleteHarness);
    await auto.clear();
    await auto.enterText(busca);
    await aguardarPainel();
    await auto.selectOption({ text: opcao });
    // O campo de quantidade da busca, e não o de um item já incluído (os dois se chamam "quantidade").
    await (await cartao.getHarness(MatInputHarness.with({ selector: 'app-busca-alimento [formControlName="quantidade"]' }))).setValue(gramas);
    await (await cartao.getHarness(MatButtonHarness.with({ selector: '.busca-incluir' }))).click();
  }

  const quantidadeDoItem = (indice = 0): Promise<MatInputHarness> =>
    loader.getAllHarnesses(MatInputHarness.with({ selector: '.item-quantidade input' })).then((todos) => todos[indice]);

  /** Altera a quantidade no lugar: digita e dispara o `change`, como o navegador faz ao sair do campo. */
  async function alterarQuantidade(valor: string, indice = 0): Promise<void> {
    const entrada = await quantidadeDoItem(indice);
    await entrada.setValue(valor);
    await (await entrada.host()).dispatchEvent('change');
  }

  const clicar = async (seletor: string, indice = 0): Promise<void> =>
    (await loader.getAllHarnesses(MatButtonHarness.with({ selector: seletor })))[indice].click();

  /** Duas refeições com itens: Café (07:00, pré-treino) com arroz 200 g e frango 100 g; Lanche (16:00) com banana 120 g. */
  async function montarDieta(): Promise<void> {
    await adicionarRefeicao('Café da manhã', '07:00', 'Pré-treino');
    await adicionarRefeicao('Lanche', '16:00');
    await incluirAlimento(1, 'arroz', /Arroz/, '200');
    await incluirAlimento(1, 'frango', /frango/, '100');
    await incluirAlimento(2, 'banana', /Banana/, '120');
  }

  // ====================================================================================================

  describe('base de alimentos (RF13)', () => {
    it('pede a carga da base ao abrir e mostra "carregando" até ela ficar pronta', async () => {
      let liberar!: () => void;
      carregador = () => new Promise<Alimento[]>((resolver) => (liberar = () => resolver(ALIMENTOS.map((a) => ({ ...a })))));
      await abrir(false);

      expect(texto('.alimentos-carregando')).toBe('Carregando a base de alimentos…');
      expect(raiz().querySelector('.dia')).toBeNull();

      liberar();
      await alimentos.carregar();
      await fixture.whenStable();

      expect(raiz().querySelector('.alimentos-carregando')).toBeNull();
      expect(raiz().querySelector('.dia')).not.toBeNull();
    });

    it('com erro na carga, mostra o aviso e "Tentar de novo"; ao conseguir, o aviso some', async () => {
      let falhar = true;
      carregador = async () => {
        if (falhar) {
          throw new Error('sem TACO');
        }
        return ALIMENTOS.map((a) => ({ ...a }));
      };
      await abrir(false);
      await alimentos.carregar();
      await fixture.whenStable();

      expect(texto('.alimentos-erro')).toContain('Não foi possível carregar a base de alimentos.');
      expect(raiz().querySelector('.alimentos-erro')?.getAttribute('role')).toBe('alert');
      expect(raiz().querySelector('.dia')).toBeNull();

      falhar = false;
      await clicar('.alimentos-tentar');
      await alimentos.carregar();
      await fixture.whenStable();

      expect(raiz().querySelector('.alimentos-erro')).toBeNull();
      expect(alimentos.estado()).toBe('pronto');
    });

    it('enquanto a base não está pronta, dá para montar refeições, mas não há busca nem totais', async () => {
      carregador = () => new Promise<Alimento[]>(() => undefined); // nunca termina
      await abrir(false);

      await adicionarRefeicao('Café', '07:00');

      expect(cartoes()).toEqual(['Café']);
      expect(raiz().querySelector('app-busca-alimento')).toBeNull();
      expect(raiz().querySelector('.refeicao-totais')).toBeNull();
    });
  });

  describe('refeições: criar (RF12, RF18)', () => {
    beforeEach(() => abrir());

    it('começa com o formulário "Nova refeição" e sem refeições', () => {
      expect(texto('.secao-titulo')).toBe('Nova refeição');
      expect(texto('.sem-refeicoes')).toBe('Nenhuma refeição ainda. Adicione a primeira acima.');
      expect(texto('.refeicao-salvar')).toBe('Adicionar refeição');
      expect(raiz().querySelector('.refeicao-cancelar')).toBeNull();
    });

    it('cria a refeição com nome, horário e marcador, salva no serviço e limpa o formulário', async () => {
      await adicionarRefeicao('Café da manhã', '07:30', 'Pré-treino');

      expect(refeicoes()).toEqual([expect.objectContaining({ resolucaoId: resolucao.id, nome: 'Café da manhã', horario: '07:30', marcador: 'pré-treino' })]);
      expect(cartoes()).toEqual(['Café da manhã']);
      expect(texto('.refeicao-horario')).toBe('07:30');
      expect(texto('.refeicao-marcador')).toBe('Pré-treino');
      expect(raiz().querySelector('.sem-refeicoes')).toBeNull();
      expect(await (await campo('nome')).getValue()).toBe('');
      expect(await (await campo('horario')).getValue()).toBe('');
      expect(await (await marcador()).getValueText()).toBe('Nenhum');
      expect(erros()).toEqual([]);
    });

    it('os três marcadores: pré-treino, pós-treino e nenhum (o padrão, que não aparece no cartão)', async () => {
      await adicionarRefeicao('Antes', '06:00', 'Pré-treino');
      await adicionarRefeicao('Depois', '09:00', 'Pós-treino');
      await adicionarRefeicao('Almoço', '12:00');

      expect(refeicoes().map((r) => r.marcador).sort()).toEqual(['nenhum', 'pré-treino', 'pós-treino']);
      expect(textos('.refeicao-marcador')).toEqual(['Pré-treino', 'Pós-treino']);
    });

    it('o select de marcador oferece só Nenhum, Pré-treino e Pós-treino', async () => {
      const select = await marcador();
      await select.open();

      expect(await Promise.all((await select.getOptions()).map((o) => o.getText()))).toEqual(['Nenhum', 'Pré-treino', 'Pós-treino']);
    });

    it('apara o nome (espaços nas pontas)', async () => {
      await adicionarRefeicao('  Jantar  ', '20:00');

      expect(refeicoes()[0].nome).toBe('Jantar');
    });

    it('as refeições aparecem por horário, não pela ordem de criação', async () => {
      await adicionarRefeicao('Jantar', '19:30');
      await adicionarRefeicao('Café', '07:00');
      await adicionarRefeicao('Almoço', '12:15');

      expect(cartoes()).toEqual(['Café', 'Almoço', 'Jantar']);
    });
  });

  describe('refeições: horário e nome validados (HH:mm)', () => {
    beforeEach(() => abrir());

    it('formulário vazio não cria e mostra o que falta', async () => {
      await salvarRefeicao();

      expect(refeicoes()).toEqual([]);
      expect(erros()).toEqual(['Campo obrigatório', 'Campo obrigatório']);
      expect(await avisos()).toEqual([]);
    });

    it('nome só com espaços não vale', async () => {
      await adicionarRefeicao('   ', '07:00');

      expect(refeicoes()).toEqual([]);
      expect(erros()).toEqual(['Campo obrigatório']);
    });

    it('horário fora de HH:mm bloqueia e explica o formato', async () => {
      for (const horario of ['7:30', '25:00', '12:60', '24:00', '12h00', '0730', 'abc', '12:5']) {
        await adicionarRefeicao('Café', horario);

        expect(refeicoes(), horario).toEqual([]);
        expect(erros(), horario).toEqual(['Use o formato HH:mm, de 00:00 a 23:59']);
        expect(await avisos(), horario).toEqual([]);
      }
    });

    it('os limites do dia valem: 00:00 e 23:59', async () => {
      await adicionarRefeicao('Ceia', '23:59');
      await adicionarRefeicao('Madrugada', '00:00');

      expect(refeicoes().map((r) => r.horario).sort()).toEqual(['00:00', '23:59']);
    });

    it('corrigir o horário e salvar de novo cria a refeição, sem restos de erro', async () => {
      await adicionarRefeicao('Café', '7h');
      expect(refeicoes()).toEqual([]);

      await (await campo('horario')).setValue('07:00');
      await salvarRefeicao();

      expect(refeicoes().length).toBe(1);
      expect(erros()).toEqual([]);
    });

    it('se o serviço recusar, avisa e não limpa o formulário', async () => {
      vi.spyOn(service, 'criarRefeicao').mockReturnValue(undefined);
      await adicionarRefeicao('Café', '07:00');

      const avisos = await Promise.all((await raizDoc.getAllHarnesses(MatSnackBarHarness)).map((a) => a.getMessage()));
      expect(avisos).toEqual(['Não foi possível salvar a refeição']);
      expect(await (await campo('nome')).getValue()).toBe('Café');
    });
  });

  describe('refeições: editar (RF15)', () => {
    beforeEach(async () => {
      await abrir();
      await adicionarRefeicao('Café', '07:00', 'Pré-treino');
    });

    it('"Editar" leva os dados ao formulário, que passa a ser de edição', async () => {
      await clicar('.refeicao-editar');

      expect(texto('.secao-titulo')).toBe('Editar refeição');
      expect(texto('.refeicao-salvar')).toBe('Salvar refeição');
      expect(await (await campo('nome')).getValue()).toBe('Café');
      expect(await (await campo('horario')).getValue()).toBe('07:00');
      expect(await (await marcador()).getValueText()).toBe('Pré-treino');
    });

    it('salvar a edição muda a refeição (mesmo id), mantém os itens e volta ao formulário de nova refeição', async () => {
      await incluirAlimento(1, 'arroz', /Arroz/, '100');
      const antes = refeicoes()[0];
      await clicar('.refeicao-editar');

      await (await campo('nome')).setValue('Desjejum');
      await (await campo('horario')).setValue('06:15');
      const select = await marcador();
      await select.open();
      await select.clickOptions({ text: 'Nenhum' });
      await salvarRefeicao();

      expect(refeicoes()).toEqual([{ ...antes, nome: 'Desjejum', horario: '06:15', marcador: 'nenhum' }]);
      expect(itens().length).toBe(1);
      expect(cartoes()).toEqual(['Desjejum']);
      expect(texto('.secao-titulo')).toBe('Nova refeição');
      expect(await (await campo('nome')).getValue()).toBe('');
    });

    it('a edição também valida o horário e não salva com formato errado', async () => {
      await clicar('.refeicao-editar');
      await (await campo('horario')).setValue('25:61');

      await salvarRefeicao();

      expect(refeicoes()[0].horario).toBe('07:00');
      expect(erros()).toEqual(['Use o formato HH:mm, de 00:00 a 23:59']);
      expect(texto('.secao-titulo')).toBe('Editar refeição');
    });

    it('Cancelar descarta a edição e limpa o formulário', async () => {
      await clicar('.refeicao-editar');
      await (await campo('nome')).setValue('Outro nome');

      await clicar('.refeicao-cancelar');

      expect(refeicoes()[0].nome).toBe('Café');
      expect(texto('.secao-titulo')).toBe('Nova refeição');
      expect(await (await campo('nome')).getValue()).toBe('');
      expect(raiz().querySelector('.refeicao-cancelar')).toBeNull();
    });
  });

  describe('refeições: excluir (RF15)', () => {
    beforeEach(() => abrir());

    const textoDoAviso = async (): Promise<string[]> =>
      Promise.all((await raizDoc.getAllHarnesses(MatSnackBarHarness)).map((a) => a.getMessage()));

    it('refeição sem itens sai na hora, com aviso, sem pedir confirmação', async () => {
      await adicionarRefeicao('Café', '07:00');

      await clicar('.refeicao-excluir');

      expect(refeicoes()).toEqual([]);
      expect(await raizDoc.getAllHarnesses(MatDialogHarness)).toEqual([]);
      expect(await textoDoAviso()).toEqual(['Refeição excluída']);
    });

    it('refeição com itens pede confirmação, dizendo o nome e quantos itens vão junto', async () => {
      await adicionarRefeicao('Café', '07:00');
      await incluirAlimento(1, 'arroz', /Arroz/, '100');
      await incluirAlimento(1, 'frango', /frango/, '100');

      await clicar('.refeicao-excluir');

      const dialogo = await raizDoc.getHarness(MatDialogHarness);
      const conteudo = limpo(await dialogo.getText());
      expect(conteudo).toContain('Excluir refeição?');
      expect(conteudo).toContain('Café');
      expect(conteudo).toContain('os 2 itens dela');
      expect(refeicoes().length).toBe(1); // ainda não excluiu
    });

    it('com um item só, o texto fica no singular', async () => {
      await adicionarRefeicao('Café', '07:00');
      await incluirAlimento(1, 'arroz', /Arroz/, '100');

      await clicar('.refeicao-excluir');

      expect(limpo(await (await raizDoc.getHarness(MatDialogHarness)).getText())).toContain('e o item dela');
    });

    it('Cancelar mantém a refeição e os itens', async () => {
      await adicionarRefeicao('Café', '07:00');
      await incluirAlimento(1, 'arroz', /Arroz/, '100');
      await clicar('.refeicao-excluir');

      await (await (await raizDoc.getHarness(MatDialogHarness)).getHarness(MatButtonHarness.with({ selector: '.confirmar-cancelar' }))).click();

      expect(refeicoes().length).toBe(1);
      expect(itens().length).toBe(1);
      expect(await textoDoAviso()).toEqual([]);
    });

    it('Excluir apaga a refeição e os itens dela, e só os dela, e avisa', async () => {
      await adicionarRefeicao('Café', '07:00');
      await adicionarRefeicao('Almoço', '12:00');
      await incluirAlimento(1, 'arroz', /Arroz/, '100');
      await incluirAlimento(2, 'frango', /frango/, '100');
      expect(itens().length).toBe(2);

      await clicar('.refeicao-excluir', 0); // Café
      await (await (await raizDoc.getHarness(MatDialogHarness)).getHarness(MatButtonHarness.with({ selector: '.confirmar-excluir' }))).click();

      expect(refeicoes().map((r) => r.nome)).toEqual(['Almoço']);
      expect(itens().map((i) => i.alimentoId)).toEqual(['a-frango']);
      expect(cartoes()).toEqual(['Almoço']);
      expect(await textoDoAviso()).toEqual(['Refeição excluída']);
    });

    it('excluir a refeição que está sendo editada limpa o formulário de edição', async () => {
      await adicionarRefeicao('Café', '07:00');
      await clicar('.refeicao-editar');
      expect(texto('.secao-titulo')).toBe('Editar refeição');

      await clicar('.refeicao-excluir');

      expect(texto('.secao-titulo')).toBe('Nova refeição');
      expect(await (await campo('nome')).getValue()).toBe('');
    });
  });

  describe('itens: incluir, alterar e excluir (RF13–RF15)', () => {
    beforeEach(async () => {
      await abrir();
      await adicionarRefeicao('Café', '07:00');
    });

    it('cada refeição tem a sua busca de alimento (com a quantidade em gramas)', async () => {
      await adicionarRefeicao('Almoço', '12:00');

      expect(raiz().querySelectorAll('mat-card.refeicao app-busca-alimento').length).toBe(2);
    });

    it('incluir mostra o alimento com a quantidade e salva no serviço', async () => {
      await incluirAlimento(1, 'arroz', /Arroz/, '200');

      expect(itens()).toEqual([expect.objectContaining({ alimentoId: 'a-arroz', quantidadeGramas: 200 })]);
      expect(textos('.item-nome')).toEqual(['Arroz, tipo 1, cozido']);
      expect(await (await quantidadeDoItem()).getValue()).toBe('200');
      expect(raiz().querySelector('.sem-itens')).toBeNull();
    });

    it('a busca acha o alimento sem acento e sem maiúsculas ("PAO" acha "Pão")', async () => {
      await incluirAlimento(1, 'PAO', /Pão/, '50');

      expect(textos('.item-nome')).toEqual(['Pão, de queijo, assado']);
    });

    it('a refeição nova diz que não tem alimentos', () => {
      expect(texto('.sem-itens')).toBe('Sem alimentos nesta refeição.');
    });

    it('alterar a quantidade salva o novo valor', async () => {
      await incluirAlimento(1, 'arroz', /Arroz/, '200');

      await alterarQuantidade('300');

      expect(itens()[0].quantidadeGramas).toBe(300);
    });

    it('quantidade inválida (zero, negativa, vazia) não salva e mostra o erro', async () => {
      await incluirAlimento(1, 'arroz', /Arroz/, '200');

      await alterarQuantidade('0');
      expect(erros('.item-quantidade mat-error')).toEqual(['Informe um número maior que zero']);
      expect(itens()[0].quantidadeGramas).toBe(200);
      expect(await avisos()).toEqual([]); // só o erro no campo, sem aviso de falha do serviço

      await alterarQuantidade('-5');
      expect(itens()[0].quantidadeGramas).toBe(200);

      await alterarQuantidade('');
      expect(erros('.item-quantidade mat-error')).toEqual(['Campo obrigatório']);
      expect(itens()[0].quantidadeGramas).toBe(200);
    });

    it('depois de um valor inválido, corrigir salva e o erro some', async () => {
      await incluirAlimento(1, 'arroz', /Arroz/, '200');
      await alterarQuantidade('0');

      await alterarQuantidade('250');

      expect(itens()[0].quantidadeGramas).toBe(250);
      expect(erros('.item-quantidade mat-error')).toEqual([]);
    });

    it('"Remover" tira só o item', async () => {
      await incluirAlimento(1, 'arroz', /Arroz/, '200');
      await incluirAlimento(1, 'frango', /frango/, '100');

      await clicar('.item-remover', 0);

      expect(itens().map((i) => i.alimentoId)).toEqual(['a-frango']);
      expect(textos('.item-nome')).toEqual(['Peito de frango, grelhado']);
    });

    it('se o serviço recusar a inclusão ou a alteração, avisa', async () => {
      await incluirAlimento(1, 'arroz', /Arroz/, '200');
      vi.spyOn(service, 'atualizarItem').mockReturnValue(undefined);
      vi.spyOn(service, 'criarItem').mockReturnValue(undefined);

      await alterarQuantidade('300');
      await incluirAlimento(1, 'frango', /frango/, '100');

      const avisos = await Promise.all((await raizDoc.getAllHarnesses(MatSnackBarHarness)).map((a) => a.getMessage()));
      expect(avisos.some((a) => a === 'Não foi possível alterar a quantidade' || a === 'Não foi possível incluir o alimento')).toBe(true);
    });

    it('item de alimento que não está na base aparece como "não encontrado" e fica de fora dos totais', async () => {
      const refeicao = refeicoes()[0];
      service.criarItem(refeicao.id, { alimentoId: 'some-da-base', quantidadeGramas: 100 });
      await fixture.whenStable();

      expect(textos('.item-nome')).toEqual(['Alimento não encontrado na base']);
      expect(texto('.item-incompleto')).toBe('Sem dados completos na base: não entra nos totais.');
      expect(texto('.dia-totais')).toContain('0 kcal');
    });
  });

  describe('totais por refeição e do dia (RF16)', () => {
    beforeEach(() => abrir());

    it('sem itens, tudo zero', () => {
      expect(texto('.dia-totais')).toBe('Total do dia: 0 kcal · CHO 0 g · PTN 0 g · LIP 0 g');
    });

    it('o total de cada refeição é lido pelo texto: sem aria-label que o repita ou o substitua', async () => {
      await montarDieta();

      const totais = Array.from(raiz().querySelectorAll('.refeicao-totais'));
      expect(totais.length).toBe(2);
      for (const total of totais) {
        expect(total.hasAttribute('aria-label')).toBe(false);
      }
    });

    it('somam por refeição e no dia, a partir da TACO por 100 g × gramas', async () => {
      await montarDieta();

      expect(textos('.refeicao-totais')).toEqual([
        'Total da refeição: 415 kcal · CHO 56,2 g · PTN 37 g · LIP 2,9 g',
        'Total da refeição: 117,6 kcal · CHO 31,2 g · PTN 1,6 g · LIP 0,1 g',
      ]);
      expect(texto('.dia-totais')).toBe('Total do dia: 532,6 kcal · CHO 87,4 g · PTN 38,6 g · LIP 3 g');
    });

    it('mudam ao alterar a quantidade (arroz de 200 g para 300 g)', async () => {
      await montarDieta();

      await alterarQuantidade('300');

      // arroz 300 g = 384 kcal, 84,3 CHO, 7,5 PTN, 0,6 LIP; com o frango: 543 kcal, 84,3 CHO, 39,5 PTN, 3,1 LIP;
      // no dia (+ banana 120 g): 660,6 kcal, 115,5 CHO, 41,06 PTN, 3,22 LIP
      expect(textos('.refeicao-totais')[0]).toBe('Total da refeição: 543 kcal · CHO 84,3 g · PTN 39,5 g · LIP 3,1 g');
      expect(texto('.dia-totais')).toBe('Total do dia: 660,6 kcal · CHO 115,5 g · PTN 41,1 g · LIP 3,2 g');
    });

    it('mudam ao remover um item e ao excluir uma refeição', async () => {
      await montarDieta();

      await clicar('.item-remover', 1); // o frango
      expect(textos('.refeicao-totais')[0]).toBe('Total da refeição: 256 kcal · CHO 56,2 g · PTN 5 g · LIP 0,4 g');
      expect(texto('.dia-totais')).toBe('Total do dia: 373,6 kcal · CHO 87,4 g · PTN 6,6 g · LIP 0,5 g');

      await clicar('.refeicao-excluir', 1); // o Lanche (com a banana): confirma
      await (await (await raizDoc.getHarness(MatDialogHarness)).getHarness(MatButtonHarness.with({ selector: '.confirmar-excluir' }))).click();
      expect(texto('.dia-totais')).toBe('Total do dia: 256 kcal · CHO 56,2 g · PTN 5 g · LIP 0,4 g');
    });

    it('uma quantidade inválida não mexe nos totais', async () => {
      await montarDieta();
      const antes = texto('.dia-totais');

      await alterarQuantidade('0');

      expect(texto('.dia-totais')).toBe(antes);
    });
  });

  describe('comparativo com as metas do aluno (RF17)', () => {
    const responder = (tipo: TipoEtapa, parametro: number, valor: number): void => {
      const etapa = casos.listarEtapas(CASO.id).find((e) => e.tipo === tipo)!;
      expect(service.salvarResposta(resolucao.id, etapa.id, parametro, valor)).toBeDefined();
    };
    const linha = (nutriente: string): string[] =>
      Array.from(raiz().querySelectorAll(`.comparativo-${nutriente} th, .comparativo-${nutriente} td`), (c) => limpo(c.textContent));

    beforeEach(() => abrir());

    it('mostra os 4 nutrientes, na ordem, com os totais da dieta', async () => {
      await montarDieta();

      expect(textos('.comparativo tbody th')).toEqual(['Energia', 'Carboidrato', 'Proteína', 'Gordura']);
      expect(textos('.comparativo-total')).toEqual(['532,6 kcal', '87,4 g', '38,6 g', '3 g']);
    });

    it('meta não preenchida aparece como "Preencha a etapa N" (GET = etapa 2, CHO = 3, PTN = 4, LIP = 5)', async () => {
      await montarDieta();

      expect(textos('.comparativo-pendente')).toEqual(['Preencha a etapa 2', 'Preencha a etapa 3', 'Preencha a etapa 4', 'Preencha a etapa 5']);
      expect(raiz().querySelector('.comparativo-meta:not(.comparativo-pendente)')).toBeNull();
      expect(raiz().querySelector('.comparativo-diferenca')).toBeNull();
    });

    it('usa as metas que o aluno calculou (GET → kcal; CHO, PTN e LIP → g), com a diferença e o percentual', async () => {
      await montarDieta();
      responder('GET', 1.8, 600);
      responder('CHO', 6, 100);
      responder('PTN', 1.6, 40);
      responder('LIP', 1, 2);
      await fixture.whenStable();

      // dia: 532,6 kcal · 87,4 CHO · 38,56 PTN · 3,02 LIP
      expect(linha('kcal')).toEqual(['Energia', '532,6 kcal', '600 kcal', '−67,4 kcal (−11,2 %)']);
      expect(linha('cho')).toEqual(['Carboidrato', '87,4 g', '100 g', '−12,6 g (−12,6 %)']);
      expect(linha('ptn')).toEqual(['Proteína', '38,6 g', '40 g', '−1,4 g (−3,6 %)']);
      expect(linha('lip')).toEqual(['Gordura', '3 g', '2 g', '+1 g (+51 %)']);
      expect(raiz().querySelector('.comparativo-pendente')).toBeNull();
    });

    it('é contra as metas DO ALUNO, não as de referência do caso: uma meta "errada" dele é a que aparece', async () => {
      await montarDieta();
      // a referência do caso 1 é GET 1,8 (≈ 3008 kcal); o aluno calculou 2325 kcal (cadeia errada, como na T6)
      responder('GET', 1.8, 2325);
      await fixture.whenStable();

      expect(texto('.comparativo-kcal .comparativo-meta')).toBe('2.325 kcal');
      expect(raiz().textContent).not.toContain('3.008');
      expect(raiz().textContent).not.toContain('3008');
    });

    it('meta parcial: só a que foi respondida aparece, as outras pedem a etapa', async () => {
      await montarDieta();
      responder('GET', 1.8, 600);
      await fixture.whenStable();

      expect(texto('.comparativo-kcal .comparativo-meta')).toBe('600 kcal');
      expect(textos('.comparativo-pendente')).toEqual(['Preencha a etapa 3', 'Preencha a etapa 4', 'Preencha a etapa 5']);
    });

    it('acompanha a dieta: alterar uma quantidade muda o total e a diferença', async () => {
      await montarDieta();
      responder('GET', 1.8, 600);
      await fixture.whenStable();
      expect(linha('kcal')[3]).toBe('−67,4 kcal (−11,2 %)');

      await alterarQuantidade('300'); // arroz 200 → 300 g: +128 kcal

      expect(linha('kcal')).toEqual(['Energia', '660,6 kcal', '600 kcal', '+60,6 kcal (+10,1 %)']);
    });

    it('acompanha as etapas: responder uma etapa depois faz a meta aparecer', async () => {
      await montarDieta();
      expect(textos('.comparativo-pendente').length).toBe(4);

      responder('CHO', 6, 90);
      await fixture.whenStable();

      expect(textos('.comparativo-pendente').length).toBe(3);
      expect(linha('cho')[2]).toBe('90 g');
    });

    it('dieta vazia contra uma meta: total zero e diferença de −100 %', async () => {
      responder('GET', 1.8, 600);
      await fixture.whenStable();

      expect(linha('kcal')).toEqual(['Energia', '0 kcal', '600 kcal', '−600 kcal (−100 %)']);
    });
  });

  describe('sem indicação de acerto ou erro (RF09)', () => {
    beforeEach(async () => {
      await abrir();
      await montarDieta();
      const etapa = casos.listarEtapas(CASO.id).find((e) => e.tipo === 'GET')!;
      service.salvarResposta(resolucao.id, etapa.id, 1.8, 600);
      await fixture.whenStable();
    });

    it('não mostra classificação, tolerância, situação da meta nem alertas da dieta', () => {
      const conteudo = raiz().textContent ?? '';

      expect(conteudo).not.toMatch(/correta|divergente|erro de fato|certo|errado|acert|incorret|confere/i);
      expect(conteudo).not.toMatch(/dentro|fora das metas|toler[âa]ncia|na meta/i);
      // a dieta de teste não tem pós-treino, tem só 2 refeições e 3 alimentos: nada disso é avisado aqui
      expect(conteudo).not.toMatch(/falta (pr[ée]|p[óo]s)|poucas refei|pouca variedade|menos de|conflita|restri[çc][ãa]o violada|concentra/i);
    });

    it('não usa ícone, nem classe de status, nem cor de acerto no comparativo', () => {
      const comparativo = raiz().querySelector('.comparativo') as HTMLElement;

      expect(raiz().querySelectorAll('mat-icon').length).toBe(0);
      expect(comparativo.innerHTML).not.toMatch(/class="[^"]*(dentro|fora|correta|erro|sucesso|success|warn|alerta)/i);
      expect(comparativo.querySelectorAll('[style]').length).toBe(0);
    });

    it('o texto do comparativo é só rótulo, total, meta e diferença', () => {
      expect(textos('.comparativo thead th')).toEqual(['Nutriente', 'Total da dieta', 'Sua meta', 'Diferença']);
    });
  });

  it('a tela só reflete o que está salvo: abrir de novo mostra as mesmas refeições, itens e totais', async () => {
    await abrir();
    await montarDieta();
    const totalDoDia = texto('.dia-totais');
    fixture.destroy();

    await abrir();

    expect(cartoes()).toEqual(['Café da manhã', 'Lanche']);
    expect(textos('.item-nome')).toEqual(['Arroz, tipo 1, cozido', 'Peito de frango, grelhado', 'Banana, prata']);
    expect(texto('.dia-totais')).toBe(totalDoDia);
  });
});
