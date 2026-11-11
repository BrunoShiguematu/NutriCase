import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatInputHarness } from '@angular/material/input/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { MatSnackBarHarness } from '@angular/material/snack-bar/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CASOS_EXEMPLO } from '../../core/data/casos-exemplo';
import { CasoService } from '../../core/services/caso.service';
import { StorageService } from '../../core/services/storage.service';
import { CasosModule } from '../casos-module';
import { CasoForm } from './caso-form';

const CHAVE = 'nutricase.casos';
const CASO_COM_RESTRICAO = CASOS_EXEMPLO[4];

describe('CasoForm', () => {
  let fixture: ComponentFixture<CasoForm>;
  let loader: HarnessLoader;
  let raiz: HarnessLoader;
  let service: CasoService;
  let navegar: ReturnType<typeof vi.spyOn>;

  /** Monta o formulário como se a rota tivesse (ou não) o parâmetro `:id`. */
  async function montar(id?: string): Promise<void> {
    TestBed.configureTestingModule({
      // Importa o CasosModule (e não só declara o componente): o template é compilado com o escopo do módulo.
      imports: [CasosModule],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap(id ? { id } : {})) } },
        // Sem animação no teste: o snackbar fecha na hora.
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    });
    service = TestBed.inject(CasoService);
    // Espiona antes de criar o componente: o id inexistente navega já no construtor.
    navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(CasoForm);
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

    it('números precisam ser maiores que zero', async () => {
      await escrever('idade', '0');
      await escrever('peso', '-5');
      await escrever('altura', '170');
      await salvar();

      expect(erros()).toContain('Informe um número maior que zero');
      expect(erros().filter((e) => e === 'Informe um número maior que zero').length).toBe(2);
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

  describe('id inexistente', () => {
    it('avisa o erro e volta para a gestão sem alterar nada', async () => {
      await montar('nao-existe');
      const antes = service.listar().length;

      expect(await avisos()).toEqual(['Caso não encontrado']);
      expect(navegar).toHaveBeenCalledWith(['/casos/gestao']);
      expect(service.listar().length).toBe(antes);
    });
  });
});
