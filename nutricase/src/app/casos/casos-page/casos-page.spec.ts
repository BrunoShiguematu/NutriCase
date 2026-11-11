import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatSelectHarness } from '@angular/material/select/testing';
import { provideRouter } from '@angular/router';
import { CASOS_EXEMPLO } from '../../core/data/casos-exemplo';
import { CasosModule } from '../casos-module';
import { CasosPage } from './casos-page';

describe('CasosPage', () => {
  let fixture: ComponentFixture<CasosPage>;
  let loader: HarnessLoader;

  const titulosNaTela = (): string[] =>
    Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.caso-titulo'),
      (el) => el.textContent?.trim() ?? '',
    );

  const statusDoResultado = (): string =>
    (fixture.nativeElement as HTMLElement).querySelector('.resultado-status')?.textContent?.trim() ?? '';

  const mensagemVazia = (): string | undefined =>
    (fixture.nativeElement as HTMLElement).querySelector('.sem-resultado')?.textContent?.trim();

  const filtro = (classe: 'filtro-nivel' | 'filtro-modalidade'): Promise<MatSelectHarness> =>
    loader.getHarness(MatSelectHarness.with({ selector: `.${classe} mat-select` }));

  async function escolher(classe: 'filtro-nivel' | 'filtro-modalidade', opcao: string): Promise<void> {
    const select = await filtro(classe);
    await select.open();
    await select.clickOptions({ text: opcao });
  }

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      // Importa o CasosModule (e não só declara a página): o template é compilado com o escopo do módulo.
      imports: [CasosModule],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(CasosPage);
    loader = TestbedHarnessEnvironment.loader(fixture);
    await fixture.whenStable();
  });

  afterEach(() => localStorage.clear());

  it('lista os 8 casos de exemplo com título, nível, modalidade e competência', () => {
    expect(titulosNaTela().length).toBe(CASOS_EXEMPLO.length);

    const primeiro = (fixture.nativeElement as HTMLElement).querySelector('.caso-card') as HTMLElement;
    expect(primeiro.querySelector('.caso-titulo')?.textContent).toContain(CASOS_EXEMPLO[0].titulo);
    expect(primeiro.querySelector('.caso-nivel dd')?.textContent).toContain(CASOS_EXEMPLO[0].nivel);
    expect(primeiro.querySelector('.caso-modalidade dd')?.textContent).toContain(CASOS_EXEMPLO[0].modalidade);
    expect(primeiro.querySelector('.caso-competencia dd')?.textContent).toContain(CASOS_EXEMPLO[0].competencia);
    expect(mensagemVazia()).toBeUndefined();
  });

  it('o aria-live fica só no status do resultado, com a contagem, e não na lista de cards', async () => {
    const raiz = fixture.nativeElement as HTMLElement;
    // Só a seção de resultado: o Material põe os seus próprios aria-live dentro dos filtros.
    const regioes = Array.from(raiz.querySelectorAll('.resultado [aria-live]'));

    expect(regioes.length).toBe(1);
    expect(regioes[0].classList).toContain('resultado-status');
    expect(raiz.querySelector('.lista-casos')?.closest('[aria-live]')).toBeNull();
    expect(statusDoResultado()).toBe('8 casos encontrados');

    await escolher('filtro-nivel', 'Avançado');
    await escolher('filtro-modalidade', 'Natação');
    expect(statusDoResultado()).toBe('1 caso encontrado');
  });

  it('tem o botão "Gestão de casos" apontando para /casos/gestao', () => {
    const link = (fixture.nativeElement as HTMLElement).querySelector('.gestao-link') as HTMLAnchorElement;
    expect(link.textContent).toContain('Gestão de casos');
    expect(link.getAttribute('href')).toBe('/casos/gestao');
  });

  it('as opções de modalidade vêm dos casos existentes, depois de "Todos"', async () => {
    const select = await filtro('filtro-modalidade');
    await select.open();
    const textos = await Promise.all((await select.getOptions()).map((o) => o.getText()));

    expect(textos).toEqual(['Todos', 'Ciclismo', 'Corrida', 'Futebol', 'Musculação', 'Natação']);
  });

  it('o filtro de nível mostra só os casos do nível escolhido', async () => {
    await escolher('filtro-nivel', 'Iniciante');

    const esperados = CASOS_EXEMPLO.filter((c) => c.nivel === 'Iniciante').map((c) => c.titulo);
    expect(esperados.length).toBeGreaterThan(0);
    expect(esperados.length).toBeLessThan(CASOS_EXEMPLO.length);
    expect(titulosNaTela()).toEqual(esperados);
  });

  it('o filtro de modalidade mostra só os casos da modalidade escolhida', async () => {
    await escolher('filtro-modalidade', 'Corrida');

    const esperados = CASOS_EXEMPLO.filter((c) => c.modalidade === 'Corrida').map((c) => c.titulo);
    expect(esperados.length).toBeGreaterThan(0);
    expect(titulosNaTela()).toEqual(esperados);
  });

  it('os dois filtros juntos combinam (E)', async () => {
    await escolher('filtro-nivel', 'Intermediário');
    await escolher('filtro-modalidade', 'Corrida');

    expect(titulosNaTela()).toEqual(['Corredor com restrição à lactose']);
  });

  it('"Todos" desfaz o filtro', async () => {
    await escolher('filtro-nivel', 'Avançado');
    expect(titulosNaTela().length).toBeLessThan(CASOS_EXEMPLO.length);

    await escolher('filtro-nivel', 'Todos');

    expect(titulosNaTela().length).toBe(CASOS_EXEMPLO.length);
  });

  it('combinação sem resultado mostra "Nenhum caso encontrado" e mantém os filtros visíveis', async () => {
    await escolher('filtro-nivel', 'Avançado');
    await escolher('filtro-modalidade', 'Corrida');

    expect(titulosNaTela()).toEqual([]);
    expect(mensagemVazia()).toBe('Nenhum caso encontrado');
    expect(statusDoResultado()).toBe('Nenhum caso encontrado');
    expect(await filtro('filtro-nivel')).toBeDefined();
    expect(await (await filtro('filtro-nivel')).getValueText()).toBe('Avançado');
    expect(await (await filtro('filtro-modalidade')).getValueText()).toBe('Corrida');
  });

  it('depois de uma combinação vazia, voltar a "Todos" traz a lista de volta e some a mensagem', async () => {
    await escolher('filtro-nivel', 'Avançado');
    await escolher('filtro-modalidade', 'Corrida');
    expect(mensagemVazia()).toBe('Nenhum caso encontrado');

    await escolher('filtro-modalidade', 'Todos');

    expect(mensagemVazia()).toBeUndefined();
    expect(titulosNaTela().length).toBeGreaterThan(0);
  });
});
