import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatDialogHarness } from '@angular/material/dialog/testing';
import { MatSnackBarHarness } from '@angular/material/snack-bar/testing';
import { MatTableHarness } from '@angular/material/table/testing';
import { provideRouter } from '@angular/router';
import { CASOS_EXEMPLO } from '../../core/data/casos-exemplo';
import { Caso } from '../../core/models';
import { CasoService } from '../../core/services/caso.service';
import { StorageService } from '../../core/services/storage.service';
import { CasosModule } from '../casos-module';
import { GestaoCasos } from './gestao-casos';

const CHAVE = 'nutricase.casos';
const PRIMEIRO = CASOS_EXEMPLO[0];

describe('GestaoCasos', () => {
  let fixture: ComponentFixture<GestaoCasos>;
  let loader: HarnessLoader;
  let raiz: HarnessLoader;
  let service: CasoService;

  const casosNoNavegador = (): Caso[] =>
    (JSON.parse(localStorage.getItem(CHAVE) ?? '{"casos":[]}') as { casos: Caso[] }).casos;

  const linhas = async (): Promise<number> =>
    (await (await loader.getHarness(MatTableHarness)).getRows()).length;

  const botaoExcluir = (titulo: string): Promise<MatButtonHarness> =>
    loader.getHarness(MatButtonHarness.with({ selector: `[aria-label="Excluir ${titulo}"]` }));

  const dialogo = (): Promise<MatDialogHarness> => raiz.getHarness(MatDialogHarness);
  const dialogoAberto = async (): Promise<boolean> =>
    (await raiz.getAllHarnesses(MatDialogHarness)).length > 0;
  const snackBars = (): Promise<MatSnackBarHarness[]> => raiz.getAllHarnesses(MatSnackBarHarness);

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      // Importa o CasosModule (e não só declara o componente): o template é compilado com o escopo do módulo.
      imports: [CasosModule],
      providers: [
        provideRouter([]),
        // Sem animação no teste: o diálogo e o snackbar fecham na hora, sem esperar o fim da animação.
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    }).compileComponents();

    service = TestBed.inject(CasoService);
    fixture = TestBed.createComponent(GestaoCasos);
    loader = TestbedHarnessEnvironment.loader(fixture);
    raiz = TestbedHarnessEnvironment.documentRootLoader(fixture);
    await fixture.whenStable();
  });

  afterEach(async () => {
    for (const aberto of await raiz.getAllHarnesses(MatDialogHarness)) {
      await aberto.close();
    }
    localStorage.clear();
  });

  it('lista os casos em uma mat-table com título, nível, modalidade e ações', async () => {
    const tabela = await loader.getHarness(MatTableHarness);
    const cabecalho = await (await tabela.getHeaderRows())[0].getCellTextByColumnName();
    expect(Object.values(cabecalho)).toEqual(['Título', 'Nível', 'Modalidade', 'Ações']);

    const primeira = (await tabela.getRows())[0];
    const celulas = await primeira.getCellTextByColumnName();
    expect(celulas['titulo']).toBe(PRIMEIRO.titulo);
    expect(celulas['nivel']).toBe(PRIMEIRO.nivel);
    expect(celulas['modalidade']).toBe(PRIMEIRO.modalidade);

    expect(await linhas()).toBe(CASOS_EXEMPLO.length);
  });

  it('os botões de ação têm aria-label com o título do caso', async () => {
    const editar = await loader.getHarness(
      MatButtonHarness.with({ selector: `[aria-label="Editar ${PRIMEIRO.titulo}"]` }),
    );
    const excluir = await botaoExcluir(PRIMEIRO.titulo);

    expect(await editar.getText()).toBe('Editar');
    expect(await excluir.getText()).toBe('Excluir');
  });

  it('"Novo caso" e "Editar" apontam para as rotas do formulário', async () => {
    const raizDom = fixture.nativeElement as HTMLElement;
    expect(raizDom.querySelector('.novo-caso')?.getAttribute('href')).toBe('/casos/gestao/novo');
    expect(raizDom.querySelector('.acao-editar')?.getAttribute('href')).toBe(
      `/casos/gestao/${PRIMEIRO.id}/editar`,
    );
  });

  it('excluir abre um diálogo de confirmação com o título do caso e os botões Cancelar e Excluir', async () => {
    await (await botaoExcluir(PRIMEIRO.titulo)).click();

    const aberto = await dialogo();
    expect(await aberto.getText()).toContain(PRIMEIRO.titulo);
    expect(await (await aberto.getHarness(MatButtonHarness.with({ text: 'Cancelar' }))).getText()).toBe('Cancelar');
    expect(await (await aberto.getHarness(MatButtonHarness.with({ text: 'Excluir' }))).getText()).toBe('Excluir');
    expect(await linhas()).toBe(CASOS_EXEMPLO.length);
  });

  it('confirmar exclui o caso e o atleta, atualiza a tabela, guarda no navegador e mostra o snackbar', async () => {
    const atletaId = PRIMEIRO.atletaId;
    await (await botaoExcluir(PRIMEIRO.titulo)).click();
    await (await (await dialogo()).getHarness(MatButtonHarness.with({ text: 'Excluir' }))).click();

    expect(service.buscarPorId(PRIMEIRO.id)).toBeUndefined();
    expect(service.listar().length).toBe(CASOS_EXEMPLO.length - 1);
    expect(await linhas()).toBe(CASOS_EXEMPLO.length - 1);

    const noNavegador = casosNoNavegador();
    expect(noNavegador.some((c) => c.id === PRIMEIRO.id)).toBe(false);
    expect(noNavegador.length).toBe(CASOS_EXEMPLO.length - 1);
    const atletas = (JSON.parse(localStorage.getItem(CHAVE) as string) as { atletas: { id: string }[] }).atletas;
    expect(atletas.some((a) => a.id === atletaId)).toBe(false);

    const avisos = await snackBars();
    expect(avisos.length).toBe(1);
    expect(await avisos[0].getMessage()).toBe('Caso excluído');
    expect(await dialogoAberto()).toBe(false);
  });

  it('cancelar não exclui nada e não mostra o snackbar', async () => {
    await (await botaoExcluir(PRIMEIRO.titulo)).click();
    await (await (await dialogo()).getHarness(MatButtonHarness.with({ text: 'Cancelar' }))).click();

    expect(service.buscarPorId(PRIMEIRO.id)).toBeDefined();
    expect(await linhas()).toBe(CASOS_EXEMPLO.length);
    expect(casosNoNavegador().length).toBe(CASOS_EXEMPLO.length);
    expect((await snackBars()).length).toBe(0);
    expect(await dialogoAberto()).toBe(false);
  });

  it('fechar o diálogo com Esc também não exclui', async () => {
    await (await botaoExcluir(PRIMEIRO.titulo)).click();
    await (await dialogo()).close();

    expect(service.buscarPorId(PRIMEIRO.id)).toBeDefined();
    expect(await linhas()).toBe(CASOS_EXEMPLO.length);
    expect((await snackBars()).length).toBe(0);
  });

  it('um caso excluído continua excluído quando o app é aberto de novo', async () => {
    await (await botaoExcluir(PRIMEIRO.titulo)).click();
    await (await (await dialogo()).getHarness(MatButtonHarness.with({ text: 'Excluir' }))).click();

    // Serviço novo com StorageService novo: só enxerga o que está no localStorage.
    const reaberto = new CasoService(new StorageService());
    expect(reaberto.buscarPorId(PRIMEIRO.id)).toBeUndefined();
  });
});
