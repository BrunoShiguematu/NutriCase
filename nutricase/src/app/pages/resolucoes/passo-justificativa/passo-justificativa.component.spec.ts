import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatInputHarness } from '@angular/material/input/testing';
import { MatSnackBarHarness } from '@angular/material/snack-bar/testing';
import { CASOS_EXEMPLO } from '../../../core/data/casos-exemplo';
import { Resolucao } from '../../../core/models';
import { ResolucaoService } from '../../../core/services/resolucao.service';
import { ResolucoesModule } from '../resolucoes.module';
import { PassoJustificativaComponent } from './passo-justificativa.component';

const CASO = CASOS_EXEMPLO[0];

describe('PassoJustificativaComponent', () => {
  let fixture: ComponentFixture<PassoJustificativaComponent>;
  let loader: HarnessLoader;
  let raizDoc: HarnessLoader;
  let service: ResolucaoService;
  let resolucao: Resolucao;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      // Importa o módulo (e não só declara o componente): o template é compilado com o escopo do módulo.
      imports: [ResolucoesModule],
      providers: [{ provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } }],
    }).compileComponents();
    service = TestBed.inject(ResolucaoService);
    resolucao = service.iniciar(CASO.id)!;
    abrir();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  function abrir(r: Resolucao = resolucao): void {
    fixture = TestBed.createComponent(PassoJustificativaComponent);
    fixture.componentRef.setInput('resolucao', r);
    loader = TestbedHarnessEnvironment.loader(fixture);
    raizDoc = TestbedHarnessEnvironment.documentRootLoader(fixture);
  }

  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const campo = (): Promise<MatInputHarness> => loader.getHarness(MatInputHarness.with({ selector: 'textarea' }));
  const salva = (): string => service.buscar(resolucao.id)!.justificativa;

  it('mostra um campo de texto para a justificativa, marcado como opcional', async () => {
    await fixture.whenStable();

    expect(raiz().querySelectorAll('textarea').length).toBe(1);
    expect(raiz().querySelector('mat-label')?.textContent).toContain('Justificativa das suas escolhas (opcional)');
    expect(raiz().querySelector('textarea')?.hasAttribute('required')).toBe(false);
    expect(await (await campo()).getValue()).toBe('');
  });

  it('mostra sempre o aviso de que a justificativa não recebe avaliação automática (RF20)', async () => {
    await fixture.whenStable();

    expect(raiz().querySelector('.aviso-justificativa')?.textContent?.trim()).toBe('A justificativa não recebe avaliação automática.');
    // o Material acrescenta o id da dica do campo; o aviso continua na lista
    expect(raiz().querySelector('textarea')?.getAttribute('aria-describedby')).toContain('aviso-justificativa');
    // e continua à vista depois de digitar
    await (await campo()).setValue('Texto qualquer');
    expect(raiz().querySelector('.aviso-justificativa')).not.toBeNull();
  });

  it('abre com a justificativa que já estava salva', async () => {
    service.salvarJustificativa(resolucao.id, 'Escolhi mais carboidrato por causa do treino longo.');
    fixture.destroy();

    abrir();

    expect(await (await campo()).getValue()).toBe('Escolhi mais carboidrato por causa do treino longo.');
  });

  describe('salvar', () => {
    it('ao sair do campo, salva o texto no serviço', async () => {
      const entrada = await campo();
      await entrada.setValue('Dieta pensada para a fase de base.');
      expect(salva()).toBe(''); // ainda não saiu do campo

      await entrada.blur();

      expect(salva()).toBe('Dieta pensada para a fase de base.');
    });

    it('salvarAtual (chamado pelo resolver ao sair do passo) salva o texto alterado', async () => {
      await (await campo()).setValue('Rascunho');

      fixture.componentInstance.salvarAtual();

      expect(salva()).toBe('Rascunho');
    });

    it('guarda o texto como foi digitado, inclusive várias linhas', async () => {
      const texto = 'Primeira linha.\nSegunda linha.';
      await (await campo()).setValue(texto);
      await (await campo()).blur();

      expect(salva()).toBe(texto);
    });

    it('apagar tudo e sair do campo salva a justificativa vazia (ela é opcional)', async () => {
      service.salvarJustificativa(resolucao.id, 'Algo');
      fixture.destroy();
      abrir();

      await (await campo()).setValue('');
      await (await campo()).blur();

      expect(salva()).toBe('');
    });

    it('não grava de novo quando nada mudou', async () => {
      await (await campo()).setValue('Texto');
      await (await campo()).blur();
      const gravar = vi.spyOn(service, 'salvarJustificativa');

      await (await campo()).blur();
      fixture.componentInstance.salvarAtual();

      expect(gravar).not.toHaveBeenCalled();
    });

    it('se o serviço recusar (tentativa já submetida), avisa e não perde o texto da tela', async () => {
      vi.spyOn(service, 'salvarJustificativa').mockReturnValue(undefined);
      await (await campo()).setValue('Texto');

      await (await campo()).blur();

      const avisos = await Promise.all((await raizDoc.getAllHarnesses(MatSnackBarHarness)).map((a) => a.getMessage()));
      expect(avisos).toEqual(['Não foi possível salvar a justificativa']);
      expect(await (await campo()).getValue()).toBe('Texto');
    });
  });

  it('receber um objeto novo da mesma tentativa (a cada gravação) não apaga o que está sendo digitado', async () => {
    await (await campo()).setValue('Em andamento');

    fixture.componentRef.setInput('resolucao', { ...resolucao });
    await fixture.whenStable();

    expect(await (await campo()).getValue()).toBe('Em andamento');
  });

  it('uma tentativa diferente mostra a justificativa dela, sem herdar a anterior', async () => {
    const outra = service.iniciar(CASO.id)!;
    service.salvarJustificativa(outra.id, 'Justificativa da outra');
    await (await campo()).setValue('Da primeira');

    fixture.componentRef.setInput('resolucao', outra);
    await fixture.whenStable();

    expect(await (await campo()).getValue()).toBe('Justificativa da outra');
  });

  it('não indica acerto nem erro: nenhum texto de avaliação, ícone ou mensagem de erro', async () => {
    await (await campo()).setValue('Qualquer coisa');
    await (await campo()).blur();

    expect(raiz().textContent).not.toMatch(/correta|divergente|erro|certo|errado|acert|nota|pontos/i);
    expect(raiz().querySelectorAll('mat-icon, mat-error').length).toBe(0);
  });
});
