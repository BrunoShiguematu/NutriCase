import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatInputHarness } from '@angular/material/input/testing';
import { MatPaginatorHarness } from '@angular/material/paginator/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { MatTableHarness } from '@angular/material/table/testing';
import { Alimento } from '../../core/models';
import { AlimentoService, CARREGADOR_TACO, CarregadorTaco } from '../../core/services/alimento.service';
import { AlimentosModule } from '../alimentos-module';
import { AlimentosPage } from './alimentos-page';

function alimento(n: number, nome: string, grupo: string, kcal = 100): Alimento {
  return {
    id: `taco-${String(n).padStart(3, '0')}`,
    nome,
    grupo,
    kcal,
    carboidrato: 25.8,
    proteina: 2.5,
    gordura: 0.2,
    origem: 'TACO',
  };
}

/** 4 bananas + 2 feijões + 16 arrozes = 22 itens: dão 3 páginas de 10. */
const ALIMENTOS: Alimento[] = [
  alimento(1, 'Banana, prata, crua', 'Frutas e derivados', 98),
  alimento(2, 'Banana, nanica, crua', 'Frutas e derivados'),
  alimento(3, 'Banana, da terra, crua', 'Frutas e derivados'),
  alimento(4, 'Banana, maçã, crua', 'Frutas e derivados'),
  alimento(5, 'Feijão, carioca, cozido', 'Leguminosas e derivados'),
  alimento(6, 'Feijão, preto, cozido', 'Leguminosas e derivados'),
  ...Array.from({ length: 16 }, (_, i) => alimento(7 + i, `Arroz, variedade ${i + 1}`, 'Cereais e derivados')),
];

describe('AlimentosPage', () => {
  let fixture: ComponentFixture<AlimentosPage>;
  let loader: HarnessLoader;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const status = (): string => el().querySelector('.resultado-status')?.textContent?.trim() ?? '';

  async function montar(carregarTaco: CarregadorTaco = async () => ALIMENTOS.map((a) => ({ ...a }))): Promise<void> {
    localStorage.clear();
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      // Importa o AlimentosModule (e não só declara a página): o template é compilado com o escopo do módulo.
      imports: [AlimentosModule],
      providers: [{ provide: CARREGADOR_TACO, useValue: carregarTaco }],
    }).compileComponents();
    fixture = TestBed.createComponent(AlimentosPage);
    loader = TestbedHarnessEnvironment.loader(fixture);
    await fixture.whenStable();
  }

  const campoBusca = (): Promise<MatInputHarness> => loader.getHarness(MatInputHarness);
  const tabela = (): Promise<MatTableHarness> => loader.getHarness(MatTableHarness);
  const paginador = (): Promise<MatPaginatorHarness> => loader.getHarness(MatPaginatorHarness);
  const filtroGrupo = (): Promise<MatSelectHarness> => loader.getHarness(MatSelectHarness);

  async function nomesNaTabela(): Promise<string[]> {
    const linhas = await (await tabela()).getRows();
    return Promise.all(
      linhas.map(async (linha) => (await linha.getCellTextByColumnName())['nome']),
    );
  }

  afterEach(() => localStorage.clear());

  describe('quando a base está pronta', () => {
    beforeEach(() => montar());

    it('chama carregar ao abrir e mostra a primeira página com a contagem', async () => {
      expect(TestBed.inject(AlimentoService).estado()).toBe('pronto');
      expect(el().querySelector('.carregando')).toBeNull();
      expect((await nomesNaTabela()).length).toBe(10);
      expect(status()).toBe('22 alimentos encontrados');
    });

    it('mostra nome, grupo, kcal, carboidrato, proteína, gordura e origem, com vírgula decimal', async () => {
      const [primeira] = await (await tabela()).getRows();

      expect(await primeira.getCellTextByColumnName()).toEqual({
        nome: 'Banana, prata, crua',
        grupo: 'Frutas e derivados',
        kcal: '98',
        carboidrato: '25,8',
        proteina: '2,5',
        gordura: '0,2',
        origem: 'TACO',
      });
    });

    it('buscar "banana" filtra a lista', async () => {
      await (await campoBusca()).setValue('banana');

      expect(await nomesNaTabela()).toEqual([
        'Banana, prata, crua',
        'Banana, nanica, crua',
        'Banana, da terra, crua',
        'Banana, maçã, crua',
      ]);
      expect(status()).toBe('4 alimentos encontrados');
    });

    it('busca sem acento: "feijao" acha "Feijão"', async () => {
      await (await campoBusca()).setValue('FEIJAO');

      expect(await nomesNaTabela()).toEqual(['Feijão, carioca, cozido', 'Feijão, preto, cozido']);
    });

    it('o filtro de grupo mostra só o grupo escolhido e "Todos" volta tudo', async () => {
      const select = await filtroGrupo();
      await select.open();
      await select.clickOptions({ text: 'Leguminosas e derivados' });

      expect(await nomesNaTabela()).toEqual(['Feijão, carioca, cozido', 'Feijão, preto, cozido']);
      expect(status()).toBe('2 alimentos encontrados');

      await select.open();
      await select.clickOptions({ text: 'Todos' });
      expect(status()).toBe('22 alimentos encontrados');
    });

    it('lista os grupos existentes no filtro, em ordem alfabética', async () => {
      const select = await filtroGrupo();
      await select.open();

      const opcoes = await select.getOptions();
      expect(await Promise.all(opcoes.map((o) => o.getText()))).toEqual([
        'Todos',
        'Cereais e derivados',
        'Frutas e derivados',
        'Leguminosas e derivados',
      ]);
    });

    it('busca e filtro de grupo funcionam juntos', async () => {
      await (await campoBusca()).setValue('cozido');
      const select = await filtroGrupo();
      await select.open();
      await select.clickOptions({ text: 'Frutas e derivados' });

      expect(status()).toBe('Nenhum alimento encontrado');
    });

    it('a paginação mostra as páginas seguintes e muda o tamanho da página', async () => {
      const pag = await paginador();
      expect(await pag.getRangeLabel()).toBe('1 – 10 de 22');
      const primeira = await nomesNaTabela();

      await pag.goToNextPage();
      expect(await pag.getRangeLabel()).toBe('11 – 20 de 22');
      expect(await nomesNaTabela()).not.toEqual(primeira);

      await pag.goToNextPage();
      expect(await pag.getRangeLabel()).toBe('21 – 22 de 22');
      expect((await nomesNaTabela()).length).toBe(2);

      await pag.setPageSize(25);
      expect((await nomesNaTabela()).length).toBe(22);
    });

    it('trocar o grupo volta para a primeira página', async () => {
      await (await paginador()).goToNextPage();
      await (await paginador()).goToNextPage();

      const select = await filtroGrupo();
      await select.open();
      await select.clickOptions({ text: 'Leguminosas e derivados' });

      expect(await (await paginador()).getRangeLabel()).toBe('1 – 2 de 2');
      expect((await nomesNaTabela()).length).toBe(2);
    });

    it('trocar a busca volta para a primeira página', async () => {
      const pag = await paginador();
      await pag.goToNextPage();

      await (await campoBusca()).setValue('arroz');

      expect(await (await paginador()).getRangeLabel()).toBe('1 – 10 de 16');
    });

    it('busca sem resultado mostra a mensagem, esconde a tabela e a busca continua disponível', async () => {
      const busca = await campoBusca();
      await busca.setValue('pizza de unicórnio');

      expect(status()).toBe('Nenhum alimento encontrado');
      expect(el().querySelector('.sem-resultado')).not.toBeNull();
      expect(el().querySelector('table')).toBeNull();
      expect(el().querySelector('mat-paginator')).toBeNull();

      await busca.setValue('feijao');
      expect(el().querySelector('.sem-resultado')).toBeNull();
      expect((await nomesNaTabela()).length).toBe(2);
    });

    it('o rodapé traz a citação da TACO e o aviso dos 5 alimentos que não estão na base', () => {
      const rodape = el().querySelector('.rodape-taco')?.textContent ?? '';

      expect(rodape).toContain('Tabela Brasileira de Composição de Alimentos (TACO)');
      expect(rodape).toContain('4. ed. rev. e ampl. Campinas: NEPA-UNICAMP, 2011');
      for (const item of ['leite de vaca integral', 'desnatado UHT', 'coco verde', 'iogurte sabor abacaxi', 'aguardente']) {
        expect(rodape).toContain(item);
      }
    });

    it('acessibilidade: tabela com aria-label e aria-live só na linha de status', () => {
      expect(el().querySelector('table')?.getAttribute('aria-label')).toBe('Base de alimentos TACO');
      expect(el().querySelector('.resultado-status')?.getAttribute('aria-live')).toBe('polite');
      // O Material coloca o seu próprio aria-live (ex.: no paginador), então só vale o que é nosso.
      expect(el().querySelectorAll('.resultado > [aria-live]').length).toBe(1);
      expect(el().querySelector('h1.page-title')?.textContent).toContain('Base de alimentos');
    });
  });

  describe('estados de carregamento', () => {
    it('enquanto carrega, mostra a barra de progresso e não mostra busca nem "nenhum alimento"', async () => {
      let liberar: () => void = () => undefined;
      await montar(() => new Promise((resolve) => (liberar = () => resolve(ALIMENTOS))));

      expect(el().querySelector('mat-progress-bar.carregando')).not.toBeNull();
      expect(el().querySelector('mat-progress-bar')?.getAttribute('aria-label')).toBe('Carregando a base de alimentos');
      expect(el().querySelector('.filtros')).toBeNull();
      expect(el().querySelector('.resultado-status')).toBeNull();

      liberar();
      await TestBed.inject(AlimentoService).carregar();
      await fixture.whenStable();
      expect(el().querySelector('mat-progress-bar')).toBeNull();
      expect(status()).toBe('22 alimentos encontrados');
    });

    it('na falha, mostra mensagem de erro e "Tentar de novo" carrega a base', async () => {
      const carregarTaco = vi
        .fn<CarregadorTaco>()
        .mockRejectedValueOnce(new Error('chunk não veio'))
        .mockImplementation(async () => ALIMENTOS.map((a) => ({ ...a })));
      await montar(carregarTaco);

      expect(el().querySelector('.mensagem-erro')?.textContent).toContain('Não foi possível carregar');
      expect(el().querySelector('[role="alert"]')).not.toBeNull();
      expect(el().querySelector('.filtros')).toBeNull();
      expect(el().textContent).not.toContain('Nenhum alimento encontrado');

      await (await loader.getHarness(MatButtonHarness.with({ text: 'Tentar de novo' }))).click();
      await fixture.whenStable();

      expect(document.activeElement).toBe(el().querySelector('h1.page-title'));

      expect(el().querySelector('.mensagem-erro')).toBeNull();
      expect(status()).toBe('22 alimentos encontrados');
      expect(carregarTaco).toHaveBeenCalledTimes(2);
    });
  });
});
