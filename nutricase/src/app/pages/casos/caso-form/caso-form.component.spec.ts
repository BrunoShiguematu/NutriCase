import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatInputHarness } from '@angular/material/input/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { MatSnackBarHarness } from '@angular/material/snack-bar/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { CASOS_EXEMPLO, etapasPadrao } from '../../../core/data/casos-exemplo';
import { TipoEtapa } from '../../../core/models';
import { CasoService } from '../../../core/services/caso.service';
import { StorageService } from '../../../core/services/storage.service';
import { CasosModule } from '../casos.module';
import { CasoFormComponent } from './caso-form.component';

const CHAVE = 'nutricase.casos';
const CASO_COM_RESTRICAO = CASOS_EXEMPLO[4];

describe('CasoFormComponent', () => {
  let fixture: ComponentFixture<CasoFormComponent>;
  let loader: HarnessLoader;
  let raiz: HarnessLoader;
  let service: CasoService;
  let navegar: ReturnType<typeof vi.spyOn>;

  /** Monta o formulário como se a rota tivesse (ou não) o parâmetro `:id`. */
  async function montar(id?: string, parametros = of(convertToParamMap(id ? { id } : {}))): Promise<void> {
    TestBed.configureTestingModule({
      // Importa o CasosModule (e não só declara o componente): o template é compilado com o escopo do módulo.
      imports: [CasosModule],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: parametros } },
        // Sem animação no teste: o snackbar fecha na hora.
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    });
    service = TestBed.inject(CasoService);
    // Espiona antes de criar o componente: o id inexistente navega já no construtor.
    navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(CasoFormComponent);
    loader = TestbedHarnessEnvironment.loader(fixture);
    raiz = TestbedHarnessEnvironment.documentRootLoader(fixture);
    await fixture.whenStable();
  }

  const campo = (nome: string): Promise<MatInputHarness> =>
    loader.getHarness(MatInputHarness.with({ selector: `[formControlName="${nome}"]` }));
  const seletor = (nome: string): Promise<MatSelectHarness> =>
    loader.getHarness(MatSelectHarness.with({ selector: `[formControlName="${nome}"]` }));
  const escrever = async (nome: string, valor: string): Promise<void> => (await campo(nome)).setValue(valor);
  const escolher = async (nome: string, opcao: string): Promise<void> => {
    const select = await seletor(nome);
    await select.open();
    await select.clickOptions({ text: opcao });
  };
  const ehTipo = (tipo: TipoEtapa): string => `.etapa-${tipo.toLowerCase()}`;
  const campoEtapa = (tipo: TipoEtapa, nome: string): Promise<MatInputHarness> =>
    loader.getHarness(MatInputHarness.with({ selector: `${ehTipo(tipo)} [formControlName="${nome}"]` }));
  const seletorEtapa = (tipo: TipoEtapa, nome: string): Promise<MatSelectHarness> =>
    loader.getHarness(MatSelectHarness.with({ selector: `${ehTipo(tipo)} [formControlName="${nome}"]` }));
  const escreverEtapa = async (tipo: TipoEtapa, nome: string, valor: string): Promise<void> =>
    (await campoEtapa(tipo, nome)).setValue(valor);
  const errosDaEtapa = (tipo: TipoEtapa): string[] =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll(`${ehTipo(tipo)} mat-error`), (e) => e.textContent?.trim() ?? '');
  const errosDaDieta = (): string[] =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.grupo-dieta mat-error'), (e) => e.textContent?.trim() ?? '');
  const salvar = async (): Promise<void> =>
    (await loader.getHarness(MatButtonHarness.with({ selector: '.salvar' }))).click();
  const erros = (): string[] =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('mat-error'), (e) => e.textContent?.trim() ?? '');
  const avisos = async (): Promise<string[]> =>
    Promise.all((await raiz.getAllHarnesses(MatSnackBarHarness)).map((s) => s.getMessage()));
  const titulo = (): string => (fixture.nativeElement as HTMLElement).querySelector('.page-title')?.textContent?.trim() ?? '';

  async function preencherTudo(): Promise<void> {
    await escrever('titulo', 'Remador em preparação');
    await escrever('modalidade', 'Remo');
    await escolher('nivel', 'Intermediário');
    await escrever('competencia', 'Gasto energético total');
    await escrever('descricao', 'Treino de remo em duas sessões.');
    await escrever('nome', 'Ana Teste');
    await escrever('idade', '30');
    await escolher('sexo', 'Feminino');
    await escrever('peso', '60');
    await escrever('altura', '165');
    await escrever('volumeTreino', '60 min/dia');
    await escrever('horarioTreino', '07h00');
    await escrever('fasePeriodizacao', 'Base');
    await escrever('objetivo', 'Melhorar o condicionamento');
    await escrever('restricoes', 'Lactose, Glúten ,, ');
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('cadastro', () => {
    beforeEach(() => montar());

    it('mostra o título "Novo caso", as duas seções e os botões Salvar e Cancelar', async () => {
      const dom = fixture.nativeElement as HTMLElement;
      expect(titulo()).toBe('Novo caso');
      expect(dom.querySelector('.secao-caso h2')?.textContent).toContain('Dados do caso');
      expect(dom.querySelector('.secao-atleta h2')?.textContent).toContain('Ficha do atleta');
      expect(dom.querySelector('.cancelar')?.getAttribute('href')).toBe('/casos/gestao');
      expect(await (await loader.getHarness(MatButtonHarness.with({ selector: '.salvar' }))).getText()).toBe('Salvar');
    });

    it('formulário vazio não salva: mostra as mensagens e não cria nem navega', async () => {
      const antes = service.listar().length;

      await salvar();

      expect(service.listar().length).toBe(antes);
      expect(navegar).not.toHaveBeenCalled();
      expect(await avisos()).toEqual([]);
      expect(erros().length).toBeGreaterThan(0);
      expect(erros().every((e) => e === 'Campo obrigatório')).toBe(true);
    });

    it('texto só com espaços não vale como preenchido', async () => {
      await escrever('titulo', '   ');
      await salvar();

      expect(erros()).toContain('Campo obrigatório');
    });

    it('peso e altura precisam ser maiores que zero', async () => {
      await escrever('peso', '-5');
      await escrever('altura', '0');
      await salvar();

      expect(erros().filter((e) => e === 'Informe um número maior que zero').length).toBe(2);
    });

    describe('idade: inteira, de 10 a 100 anos', () => {
      const FAIXA = 'A idade deve estar entre 10 e 100 anos';
      const mensagemDaIdade = (): string =>
        (fixture.nativeElement as HTMLElement).querySelector('.campo-idade mat-error')?.textContent?.trim() ?? '';

      it.each(['0', '-3', '9', '101', '150'])('%s anos: mensagem da faixa e nada é salvo', async (idade) => {
        const antes = service.listar().length;
        await preencherTudo();
        await escrever('idade', idade);

        await salvar();

        expect(mensagemDaIdade()).toBe(FAIXA);
        expect(service.listar().length).toBe(antes);
        expect(navegar).not.toHaveBeenCalled();
      });

      it.each(['10.5', '30.2', '99.9'])('%s anos: pede anos inteiros e nada é salvo', async (idade) => {
        const antes = service.listar().length;
        await preencherTudo();
        await escrever('idade', idade);

        await salvar();

        expect(mensagemDaIdade()).toBe('Informe a idade em anos inteiros');
        expect(service.listar().length).toBe(antes);
      });

      it.each([10, 100])('%i anos, o limite, vale e é guardado', async (idade) => {
        await preencherTudo();
        await escrever('idade', String(idade));

        await salvar();

        expect(navegar).toHaveBeenCalledWith(['/casos/gestao']);
        expect(service.listar().find((c) => c.titulo === 'Remador em preparação')).toBeDefined();
        const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? '{}') as { atletas: { nome: string; idade: number }[] };
        expect(salvo.atletas.find((a) => a.nome === 'Ana Teste')?.idade).toBe(idade);
      });

      it('vazia: campo obrigatório', async () => {
        await salvar();

        expect(mensagemDaIdade()).toBe('Campo obrigatório');
      });

      it('mostra a regra num texto de ajuda e nos limites do campo', async () => {
        const dom = fixture.nativeElement as HTMLElement;
        const campoIdade = dom.querySelector('.campo-idade') as HTMLElement;

        expect(campoIdade.querySelector('mat-hint')?.textContent?.trim()).toBe('Inteiro, de 10 a 100');
        const entrada = campoIdade.querySelector('input') as HTMLInputElement;
        expect([entrada.min, entrada.max, entrada.step]).toEqual(['10', '100', '1']);
      });

      it('corrigir a idade tira a mensagem', async () => {
        await escrever('idade', '5');
        await salvar();
        expect(mensagemDaIdade()).toBe(FAIXA);

        await escrever('idade', '25');

        expect(mensagemDaIdade()).toBe('');
      });
    });

    describe('foco no primeiro campo com erro ao tentar salvar', () => {
      const focado = (): Element | null => document.activeElement;
      /** O harness deixa o foco no último campo digitado; tira o foco antes, para só o componente poder colocá-lo. */
      const tentarSalvar = async (): Promise<void> => {
        (document.activeElement as HTMLElement | null)?.blur();
        await salvar();
      };
      const doCampo = (nome: string): HTMLElement =>
        (fixture.nativeElement as HTMLElement).querySelector(`[formControlName="${nome}"]`) as HTMLElement;

      it('formulário vazio: o foco vai para o Título, o primeiro campo', async () => {
        await tentarSalvar();

        expect(focado()).toBe(doCampo('titulo'));
      });

      it('só um campo da ficha inválido: o foco vai para ele', async () => {
        await preencherTudo();
        await escrever('idade', '5');

        await tentarSalvar();

        expect(focado()).toBe(doCampo('idade'));
      });

      it('vários inválidos: o foco vai para o primeiro da tela, não para o último', async () => {
        await preencherTudo();
        await escrever('altura', '0');
        await escrever('modalidade', '  ');

        await tentarSalvar();

        expect(focado()).toBe(doCampo('modalidade'));
      });

      it('um select obrigatório vazio também recebe o foco', async () => {
        await preencherTudo();
        // o Sexo foi escolhido em preencherTudo; esvazia pelo formulário
        fixture.componentInstance['form'].controls.sexo.setValue('');

        await tentarSalvar();

        expect(focado()).toBe(doCampo('sexo'));
      });

      it('erro numa etapa de cálculo: o foco vai para o campo da etapa', async () => {
        await preencherTudo();
        await escreverEtapa('CHO', 'min', '9');
        await escreverEtapa('CHO', 'max', '5');

        await tentarSalvar();

        const alvo = (fixture.nativeElement as HTMLElement).querySelector(`${ehTipo('CHO')} [formControlName="referencia"]`);
        expect(focado()).toBe(alvo);
      });

      it('um campo de texto longo (textarea) vazio também recebe o foco', async () => {
        await preencherTudo();
        await escrever('descricao', '');

        await tentarSalvar();

        expect(focado()).toBe(doCampo('descricao'));
      });

      it('o critério (textarea) de uma etapa vazio recebe o foco', async () => {
        await preencherTudo();
        await escreverEtapa('PTN', 'criterio', '  ');

        await tentarSalvar();

        expect(focado()).toBe((fixture.nativeElement as HTMLElement).querySelector(`${ehTipo('PTN')} [formControlName="criterio"]`));
      });

      it('um campo antes das etapas inválido vence um erro de etapa', async () => {
        await preencherTudo();
        await escreverEtapa('LIP', 'tolerancia', '0');
        await escrever('nome', '');

        await tentarSalvar();

        expect(focado()).toBe(doCampo('nome'));
      });

      it('tudo válido: salva e não mexe no foco', async () => {
        await preencherTudo();
        const antes = focado();

        await salvar();

        expect(navegar).toHaveBeenCalledWith(['/casos/gestao']);
        expect(focado()).toBe(antes);
      });
    });

    it('com tudo preenchido, mas um número inválido, não salva', async () => {
      const antes = service.listar().length;
      await preencherTudo();
      await escrever('peso', '0');

      await salvar();

      expect(service.listar().length).toBe(antes);
      expect(navegar).not.toHaveBeenCalled();
      expect(await avisos()).toEqual([]);
      expect(erros()).toEqual(['Informe um número maior que zero']);
    });

    it('o percentual de gordura é opcional, mas se vier precisa estar entre 0 e 100', async () => {
      await escrever('percentualGordura', '120');
      await salvar();
      expect(erros()).toContain('O valor máximo é 100');

      await escrever('percentualGordura', '0');
      await salvar();
      expect(erros()).toContain('Informe um número maior que zero');
    });

    it('com tudo válido, cria o caso e o atleta, avisa, volta para a gestão e guarda no navegador', async () => {
      const antes = service.listar().length;
      await preencherTudo();

      await salvar();

      expect(service.listar().length).toBe(antes + 1);
      const criado = service.listar().find((c) => c.titulo === 'Remador em preparação');
      expect(criado).toBeDefined();
      expect(criado?.nivel).toBe('Intermediário');
      expect(criado?.modalidade).toBe('Remo');
      expect(criado?.toleranciaDieta).toBe(10);

      const atleta = service.buscarPorId(criado!.id)?.atleta;
      expect(atleta?.nome).toBe('Ana Teste');
      expect(atleta?.idade).toBe(30);
      expect(atleta?.sexo).toBe('feminino');
      expect(atleta?.peso).toBe(60);
      expect(atleta?.altura).toBe(165);
      expect(atleta?.percentualGordura).toBeUndefined();
      expect(atleta?.restricoes).toEqual(['Lactose', 'Glúten']);
      expect(atleta?.preferencias).toEqual([]);

      expect(await avisos()).toEqual(['Caso criado']);
      expect(navegar).toHaveBeenCalledWith(['/casos/gestao']);

      const reaberto = new CasoService(new StorageService());
      expect(reaberto.listar().some((c) => c.id === criado?.id)).toBe(true);
      expect(localStorage.getItem(CHAVE)).toContain('Remador em preparação');
    });
  });

  describe('edição', () => {
    beforeEach(() => montar(CASO_COM_RESTRICAO.id));

    it('abre preenchido com os dados do caso e da ficha do atleta', async () => {
      expect(titulo()).toBe('Editar caso');
      expect(await (await campo('titulo')).getValue()).toBe(CASO_COM_RESTRICAO.titulo);
      expect(await (await campo('modalidade')).getValue()).toBe(CASO_COM_RESTRICAO.modalidade);
      expect(await (await seletor('nivel')).getValueText()).toBe(CASO_COM_RESTRICAO.nivel);
      expect(await (await campo('nome')).getValue()).toBe('Pedro Nogueira');
      expect(await (await campo('idade')).getValue()).toBe('34');
      expect(await (await seletor('sexo')).getValueText()).toBe('Masculino');
      expect(await (await campo('restricoes')).getValue()).toBe('Intolerância à lactose');
    });

    it('salvar muda os dados mantendo os ids, avisa e volta para a gestão', async () => {
      const antes = service.buscarPorId(CASO_COM_RESTRICAO.id)!;
      const totalAntes = service.listar().length;

      await escrever('titulo', 'Corredor de 10 km atualizado');
      await escolher('nivel', 'Avançado');
      await escrever('peso', '73.5');
      await escrever('restricoes', 'Intolerância à lactose, Alergia a amendoim');
      await salvar();

      const depois = service.buscarPorId(CASO_COM_RESTRICAO.id)!;
      expect(service.listar().length).toBe(totalAntes);
      expect(depois.caso.id).toBe(antes.caso.id);
      expect(depois.atleta.id).toBe(antes.atleta.id);
      expect(depois.caso.titulo).toBe('Corredor de 10 km atualizado');
      expect(depois.caso.nivel).toBe('Avançado');
      expect(depois.atleta.peso).toBe(73.5);
      expect(depois.atleta.restricoes).toEqual(['Intolerância à lactose', 'Alergia a amendoim']);
      expect(depois.atleta.nome).toBe(antes.atleta.nome);
      expect(depois.caso.competencia).toBe(antes.caso.competencia);

      expect(await avisos()).toEqual(['Caso atualizado']);
      expect(navegar).toHaveBeenCalledWith(['/casos/gestao']);
      expect(new CasoService(new StorageService()).buscarPorId(CASO_COM_RESTRICAO.id)?.caso.titulo).toBe(
        'Corredor de 10 km atualizado',
      );
    });

    it('apagar um campo obrigatório impede de salvar e não muda nada', async () => {
      await escrever('titulo', '');
      await salvar();

      expect(service.buscarPorId(CASO_COM_RESTRICAO.id)?.caso.titulo).toBe(CASO_COM_RESTRICAO.titulo);
      expect(erros()).toContain('Campo obrigatório');
      expect(navegar).not.toHaveBeenCalled();
      expect(await avisos()).toEqual([]);
    });

    it('se o caso sumir antes de salvar, mostra erro e volta para a gestão', async () => {
      service.excluir(CASO_COM_RESTRICAO.id);

      await salvar();

      expect(await avisos()).toEqual(['Caso não encontrado']);
      expect(navegar).toHaveBeenCalledWith(['/casos/gestao']);
    });
  });

  describe('etapas de cálculo', () => {
    describe('cadastro', () => {
      beforeEach(() => montar());

      it('tem a seção com o aviso fixo e as 5 etapas na ordem TMB, GET, CHO, PTN, LIP', () => {
        const dom = fixture.nativeElement as HTMLElement;
        expect(dom.querySelector('.secao-etapas h2')?.textContent).toContain('Etapas de cálculo');
        expect(dom.querySelector('.aviso-validacao')?.textContent?.trim()).toBe('Valores de exemplo, aguardam validação docente.');
        const legendas = Array.from(dom.querySelectorAll('.etapa-form legend'), (l) => l.textContent?.trim());
        expect(legendas).toEqual([
          '1. Taxa metabólica basal (TMB)',
          '2. Gasto energético total (GET)',
          '3. Meta de carboidrato',
          '4. Meta de proteína',
          '5. Meta de gordura',
        ]);
      });

      it('a TMB tem equação de referência e equações aceitas, e as outras têm referência e faixa mín/máx', () => {
        const dom = fixture.nativeElement as HTMLElement;
        const controles = (tipo: TipoEtapa) =>
          Array.from(dom.querySelectorAll(`${ehTipo(tipo)} [formControlName]`), (c) => c.getAttribute('formControlName'));
        expect(controles('TMB')).toEqual(['referencia', 'opcoes', 'tolerancia', 'criterio']);
        for (const tipo of ['GET', 'CHO', 'PTN', 'LIP'] as const) {
          expect(controles(tipo), tipo).toEqual(['referencia', 'min', 'max', 'tolerancia', 'criterio']);
        }
      });

      it('começa com as 5 etapas padrão e a tolerância padrão da dieta', async () => {
        expect(await (await campo('toleranciaDieta')).getValue()).toBe('10');
        expect(await (await seletorEtapa('TMB', 'referencia')).getValueText()).toBe('Mifflin-St Jeor');
        expect(await (await seletorEtapa('TMB', 'opcoes')).getValueText()).toBe('Harris-Benedict revisada, Mifflin-St Jeor, Cunningham');
        const padrao = etapasPadrao('novo');
        for (const etapa of padrao.filter((e) => e.tipo !== 'TMB')) {
          expect(await (await campoEtapa(etapa.tipo, 'referencia')).getValue(), etapa.tipo).toBe(String(etapa.parametroReferencia));
          expect(await (await campoEtapa(etapa.tipo, 'min')).getValue(), etapa.tipo).toBe(String(etapa.faixaAceitavel?.min));
          expect(await (await campoEtapa(etapa.tipo, 'max')).getValue(), etapa.tipo).toBe(String(etapa.faixaAceitavel?.max));
        }
        for (const etapa of padrao) {
          expect(await (await campoEtapa(etapa.tipo, 'tolerancia')).getValue(), etapa.tipo).toBe('5');
          expect(await (await campoEtapa(etapa.tipo, 'criterio')).getValue(), etapa.tipo).toBe(etapa.criterioReferencia);
        }
      });

      it('salvar sem mexer nas etapas deixa o caso novo com as 5 padrão', async () => {
        await preencherTudo();
        await salvar();

        const criado = service.listar().find((c) => c.titulo === 'Remador em preparação')!;
        expect(service.listarEtapas(criado.id)).toEqual(etapasPadrao(criado.id));
        expect(criado.toleranciaDieta).toBe(10);
      });

      it('salvar com etapas e tolerância da dieta alteradas guarda tudo no caso novo, também no navegador', async () => {
        await preencherTudo();
        await escrever('toleranciaDieta', '12.5');
        await escreverEtapa('CHO', 'referencia', '7');
        await escreverEtapa('CHO', 'min', '5');
        await escreverEtapa('CHO', 'max', '9');
        await escreverEtapa('CHO', 'tolerancia', '3');
        await escreverEtapa('CHO', 'criterio', '  Carboidrato alto para treino longo.  ');
        const tmbReferencia = await seletorEtapa('TMB', 'referencia');
        await tmbReferencia.open();
        await tmbReferencia.clickOptions({ text: 'Cunningham' });
        const opcoes = await seletorEtapa('TMB', 'opcoes');
        await opcoes.open();
        await opcoes.clickOptions({ text: 'Harris-Benedict revisada' }); // desmarca
        await opcoes.close();

        await salvar();

        const criado = service.listar().find((c) => c.titulo === 'Remador em preparação')!;
        expect(criado.toleranciaDieta).toBe(12.5);
        const etapas = service.listarEtapas(criado.id);
        const padrao = etapasPadrao(criado.id);
        expect(etapas[0]).toMatchObject({ parametroReferencia: 'Cunningham', opcoesAceitaveis: ['Mifflin-St Jeor', 'Cunningham'] });
        expect(etapas[2]).toEqual({
          ...padrao[2],
          parametroReferencia: 7,
          faixaAceitavel: { min: 5, max: 9 },
          tolerancia: 3,
          criterioReferencia: 'Carboidrato alto para treino longo.',
        });
        expect([etapas[1], etapas[3], etapas[4]]).toEqual([padrao[1], padrao[3], padrao[4]]);
        expect(await avisos()).toEqual(['Caso criado']);
        const reaberto = new CasoService(new StorageService());
        expect(reaberto.listarEtapas(criado.id)[2].faixaAceitavel).toEqual({ min: 5, max: 9 });
      });
    });

    describe('validação (cadastro)', () => {
      beforeEach(async () => {
        await montar();
        await preencherTudo();
      });

      async function naoSalva(): Promise<void> {
        const antes = service.listar().length;
        await salvar();
        expect(service.listar().length).toBe(antes);
        expect(navegar).not.toHaveBeenCalled();
        expect(await avisos()).toEqual([]);
      }

      it('referência abaixo do mínimo: mensagem na referência e nada é salvo', async () => {
        await escreverEtapa('GET', 'referencia', '1.2');
        await naoSalva();

        expect(errosDaEtapa('GET')).toEqual(['A referência deve estar entre o mínimo e o máximo']);
        expect(erros()).toEqual(['A referência deve estar entre o mínimo e o máximo']);
      });

      it('referência acima do máximo: mesma mensagem', async () => {
        await escreverEtapa('PTN', 'referencia', '2.5');
        await naoSalva();

        expect(errosDaEtapa('PTN')).toEqual(['A referência deve estar entre o mínimo e o máximo']);
      });

      it('a referência igual ao mínimo ou ao máximo vale', async () => {
        await escreverEtapa('LIP', 'referencia', '0.5'); // mínimo
        await escreverEtapa('CHO', 'referencia', '10'); // máximo
        await salvar();

        expect(erros()).toEqual([]);
        expect(await avisos()).toEqual(['Caso criado']);
      });

      it('mínimo maior que o máximo: mensagem no mínimo e no máximo', async () => {
        await escreverEtapa('CHO', 'min', '9');
        await escreverEtapa('CHO', 'max', '5');
        await naoSalva();

        // A referência (6) também fica fora de uma faixa invertida (de 9 a 5).
        expect(errosDaEtapa('CHO')).toEqual([
          'A referência deve estar entre o mínimo e o máximo',
          'O mínimo não pode ser maior que o máximo',
          'O máximo não pode ser menor que o mínimo',
        ]);
      });

      it('faixa com mínimo igual ao máximo (e à referência) vale', async () => {
        await escreverEtapa('CHO', 'min', '7');
        await escreverEtapa('CHO', 'max', '7');
        await escreverEtapa('CHO', 'referencia', '7');
        await salvar();

        expect(errosDaEtapa('CHO')).toEqual([]);
        const criado = service.listar().find((c) => c.titulo === 'Remador em preparação')!;
        expect(service.listarEtapas(criado.id)[2].faixaAceitavel).toEqual({ min: 7, max: 7 });
      });

      it('corrigir o máximo tira o erro da referência (os campos da faixa se revalidam entre si)', async () => {
        await escreverEtapa('GET', 'max', '1.5'); // referência 1,7 passa do máximo
        await salvar();
        expect(errosDaEtapa('GET')).toEqual(['A referência deve estar entre o mínimo e o máximo']);

        await escreverEtapa('GET', 'max', '2.2');

        expect(errosDaEtapa('GET')).toEqual([]);
      });

      it('corrigir o mínimo tira o erro do máximo e o da referência', async () => {
        await escreverEtapa('GET', 'min', '2.5'); // passa do máximo (2,2) e da referência (1,7)
        await salvar();
        expect(errosDaEtapa('GET').length).toBe(3);

        await escreverEtapa('GET', 'min', '1.4');

        expect(errosDaEtapa('GET')).toEqual([]);
      });

      it('tolerância zero, negativa ou vazia não vale', async () => {
        await escreverEtapa('GET', 'tolerancia', '0');
        await escreverEtapa('CHO', 'tolerancia', '-2');
        await escreverEtapa('PTN', 'tolerancia', '');
        await naoSalva();

        expect(errosDaEtapa('GET')).toEqual(['Informe um número maior que zero']);
        expect(errosDaEtapa('CHO')).toEqual(['Informe um número maior que zero']);
        expect(errosDaEtapa('PTN')).toEqual(['Campo obrigatório']);
        expect(errosDaEtapa('TMB')).toEqual([]);
      });

      it('faixa e referência vazias ou zero não valem', async () => {
        await escreverEtapa('LIP', 'referencia', '');
        await escreverEtapa('LIP', 'min', '0');
        await escreverEtapa('LIP', 'max', '');
        await naoSalva();

        expect(errosDaEtapa('LIP')).toContain('Campo obrigatório');
        expect(errosDaEtapa('LIP')).toContain('Informe um número maior que zero');
      });

      it('TMB sem nenhuma equação aceita não vale', async () => {
        const opcoes = await seletorEtapa('TMB', 'opcoes');
        await opcoes.open();
        for (const opcao of await opcoes.getOptions()) {
          await opcao.click();
        }
        await opcoes.close();
        await naoSalva();

        expect(errosDaEtapa('TMB')).toEqual(['Escolha pelo menos uma equação']);
      });

      it('critério vazio ou só com espaços não vale', async () => {
        await escreverEtapa('TMB', 'criterio', '   ');
        await escreverEtapa('PTN', 'criterio', '');
        await naoSalva();

        expect(errosDaEtapa('TMB')).toEqual(['Campo obrigatório']);
        expect(errosDaEtapa('PTN')).toEqual(['Campo obrigatório']);
      });

      it('tolerância da dieta zero ou vazia não vale', async () => {
        await escrever('toleranciaDieta', '0');
        await naoSalva();
        expect(errosDaDieta()).toEqual(['Informe um número maior que zero']);

        await escrever('toleranciaDieta', '');
        await salvar();
        expect(errosDaDieta()).toEqual(['Campo obrigatório']);
      });

      it('com tudo corrigido, salva', async () => {
        await escreverEtapa('GET', 'referencia', '1.2');
        await salvar();
        expect(navegar).not.toHaveBeenCalled();

        await escreverEtapa('GET', 'referencia', '1.8');
        await salvar();

        expect(navegar).toHaveBeenCalledWith(['/casos/gestao']);
      });
    });

    describe('edição', () => {
      const CASO_7 = 'exemplo-caso-7'; // CHO de referência 8 g/kg

      beforeEach(() => montar(CASO_7));

      it('abre com os critérios e a tolerância da dieta do caso', async () => {
        const salvas = service.listarEtapas(CASO_7);
        const cho = salvas[2];
        expect(await (await campo('toleranciaDieta')).getValue()).toBe(String(service.buscarPorId(CASO_7)!.caso.toleranciaDieta));
        expect(await (await campoEtapa('CHO', 'referencia')).getValue()).toBe('8');
        expect(await (await campoEtapa('CHO', 'min')).getValue()).toBe(String(cho.faixaAceitavel!.min));
        expect(await (await campoEtapa('CHO', 'max')).getValue()).toBe(String(cho.faixaAceitavel!.max));
        expect(await (await campoEtapa('CHO', 'criterio')).getValue()).toBe(cho.criterioReferencia);
        expect(await (await seletorEtapa('TMB', 'referencia')).getValueText()).toBe(String(salvas[0].parametroReferencia));
      });

      it('mudar uma faixa e salvar atualiza só aquela etapa, com os mesmos ids', async () => {
        const antes = service.listarEtapas(CASO_7);

        await escreverEtapa('PTN', 'min', '1.0');
        await escreverEtapa('PTN', 'max', '2.4');
        await salvar();

        const depois = service.listarEtapas(CASO_7);
        expect(depois.map((e) => e.id)).toEqual(antes.map((e) => e.id));
        expect(depois[3].faixaAceitavel).toEqual({ min: 1, max: 2.4 });
        expect([depois[0], depois[1], depois[2], depois[4]]).toEqual([antes[0], antes[1], antes[2], antes[4]]);
        expect(await avisos()).toEqual(['Caso atualizado']);
        expect(new CasoService(new StorageService()).listarEtapas(CASO_7)[3].faixaAceitavel).toEqual({ min: 1, max: 2.4 });
      });

      it('mudar a TMB (equação de referência e aceitas) e salvar', async () => {
        const referencia = await seletorEtapa('TMB', 'referencia');
        await referencia.open();
        await referencia.clickOptions({ text: 'Harris-Benedict revisada' });
        const opcoes = await seletorEtapa('TMB', 'opcoes');
        await opcoes.open();
        await opcoes.clickOptions({ text: 'Cunningham' }); // desmarca
        await opcoes.close();
        await salvar();

        expect(service.listarEtapas(CASO_7)[0]).toMatchObject({
          parametroReferencia: 'Harris-Benedict revisada',
          opcoesAceitaveis: ['Harris-Benedict revisada', 'Mifflin-St Jeor'],
        });
      });

      it('editar só o título não mexe nas etapas nem na tolerância da dieta', async () => {
        const preparo = service.buscarPorId(CASO_7)!;
        const etapasAntes = service.listarEtapas(CASO_7);

        await escrever('titulo', 'Outro título');
        await salvar();

        expect(service.listarEtapas(CASO_7)).toEqual(etapasAntes);
        expect(service.buscarPorId(CASO_7)!.caso.toleranciaDieta).toBe(preparo.caso.toleranciaDieta);
      });

      it('uma etapa inválida impede de salvar e nada muda', async () => {
        const etapasAntes = service.listarEtapas(CASO_7);

        await escreverEtapa('CHO', 'min', '12'); // acima da referência 8 e do máximo
        await salvar();

        expect(errosDaEtapa('CHO').length).toBeGreaterThan(0);
        expect(service.listarEtapas(CASO_7)).toEqual(etapasAntes);
        expect(navegar).not.toHaveBeenCalled();
      });
    });

    describe('tolerância da dieta', () => {
      it('ao editar, mostra e preserva a tolerância que o caso já tem', async () => {
        // O serviço só é criado em montar(); o localStorage limpo no beforeEach faz o CasoService começar com os exemplos.
        const preparo = new CasoService(new StorageService());
        const { caso, atleta } = preparo.buscarPorId(CASO_COM_RESTRICAO.id)!;
        preparo.atualizar(caso.id, { ...caso, toleranciaDieta: 15 }, atleta);

        await montar(CASO_COM_RESTRICAO.id);
        expect(await (await campo('toleranciaDieta')).getValue()).toBe('15');
        await escrever('titulo', 'Título novo');
        await salvar();

        expect(service.buscarPorId(CASO_COM_RESTRICAO.id)?.caso.toleranciaDieta).toBe(15);
      });

      it('mudar o campo e salvar grava a nova tolerância', async () => {
        await montar(CASO_COM_RESTRICAO.id);

        await escrever('toleranciaDieta', '20');
        await salvar();

        expect(service.buscarPorId(CASO_COM_RESTRICAO.id)?.caso.toleranciaDieta).toBe(20);
      });
    });

    describe('dados salvos com texto de equação desconhecido', () => {
      it('a tela abre sem quebrar, só com as equações que conhece marcadas', async () => {
        const preparo = new CasoService(new StorageService());
        const [tmb, ...resto] = preparo.listarEtapas(CASO_COM_RESTRICAO.id);
        preparo.atualizarEtapas(CASO_COM_RESTRICAO.id, [{ ...tmb, opcoesAceitaveis: ['Mifflin-St Jeor', 'Equação inventada'] }, ...resto]);

        await montar(CASO_COM_RESTRICAO.id);

        expect(await (await seletorEtapa('TMB', 'opcoes')).getValueText()).toBe('Mifflin-St Jeor');
      });
    });
  });

  describe('texto de ajuda de "Equações aceitas"', () => {
    it('diz que a equação de referência sempre vale', async () => {
      await montar();

      const dica = (fixture.nativeElement as HTMLElement).querySelector('.etapa-tmb .campo-opcoes mat-hint')?.textContent ?? '';

      expect(dica).toContain('A equação de referência sempre vale');
      expect(dica).toContain('erro de escolha de equação');
    });
  });

  describe('id inexistente', () => {
    it('mostra uma mensagem clara e um link para a gestão, sem formulário, sem aviso e sem redirecionar', async () => {
      await montar('nao-existe');
      const dom = fixture.nativeElement as HTMLElement;
      const antes = service.listar().length;

      expect(titulo()).toBe('Caso não encontrado');
      expect(dom.querySelector('.caso-nao-encontrado')?.textContent).toContain('Não existe um caso com este endereço');
      expect(dom.querySelector('.caso-nao-encontrado')?.getAttribute('role')).toBe('alert');
      const link = dom.querySelector('.caso-nao-encontrado .voltar-gestao') as HTMLAnchorElement;
      expect(link.getAttribute('href')).toBe('/casos/gestao');
      expect(link.textContent?.trim()).toBe('Voltar à gestão de casos');
      expect(dom.querySelector('form')).toBeNull();
      expect(dom.querySelector('.salvar')).toBeNull();
      expect(await avisos()).toEqual([]);
      expect(navegar).not.toHaveBeenCalled();
      expect(service.listar().length).toBe(antes);
    });

    it('trocar o endereço de um id inexistente para um que existe volta a mostrar o formulário', async () => {
      const rota = new BehaviorSubject(convertToParamMap({ id: 'nao-existe' }));
      await montar(undefined, rota);
      expect(titulo()).toBe('Caso não encontrado');

      rota.next(convertToParamMap({ id: CASO_COM_RESTRICAO.id }));
      await fixture.whenStable();

      expect(titulo()).toBe('Editar caso');
      expect((fixture.nativeElement as HTMLElement).querySelector('.caso-nao-encontrado')).toBeNull();
    });

    it('um id que existe continua mostrando o formulário, sem a mensagem', async () => {
      await montar(CASO_COM_RESTRICAO.id);
      const dom = fixture.nativeElement as HTMLElement;

      expect(titulo()).toBe('Editar caso');
      expect(dom.querySelector('form')).not.toBeNull();
      expect(dom.querySelector('.caso-nao-encontrado')).toBeNull();
    });
  });
});
