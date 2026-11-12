import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatInputHarness } from '@angular/material/input/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { MatSnackBarHarness } from '@angular/material/snack-bar/testing';
import { EQUACOES_TMB } from '../../../core/avaliacao/formulas';
import { CASOS_EXEMPLO } from '../../../core/data/casos-exemplo';
import { EtapaCalculo, Resolucao } from '../../../core/models';
import { CasoService } from '../../../core/services/caso.service';
import { ResolucaoService } from '../../../core/services/resolucao.service';
import { ResolucoesModule } from '../resolucoes.module';
import { PassoEtapasComponent } from './passo-etapas.component';

const CASO = CASOS_EXEMPLO[0]; // referências do caso 1: GET 1,8 · CHO 6 · PTN 1,6 · LIP 1

describe('PassoEtapasComponent', () => {
  let fixture: ComponentFixture<PassoEtapasComponent>;
  let loader: HarnessLoader;
  let raizDoc: HarnessLoader;
  let service: ResolucaoService;
  let casos: CasoService;
  let resolucao: Resolucao;
  let etapas: EtapaCalculo[];

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      // Importa o módulo (e não só declara o componente): o template é compilado com o escopo do módulo.
      imports: [ResolucoesModule],
      // Sem animação no teste: a lista do select e o snackbar abrem e fecham na hora.
      providers: [{ provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } }],
    }).compileComponents();
    service = TestBed.inject(ResolucaoService);
    casos = TestBed.inject(CasoService);
    etapas = casos.listarEtapas(CASO.id);
    resolucao = service.iniciar(CASO.id)!;
    abrir();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  /** Abre o passo como o resolver abriria; de novo, simula reabrir a tela. */
  function abrir(r: Resolucao = resolucao): void {
    fixture = TestBed.createComponent(PassoEtapasComponent);
    fixture.componentRef.setInput('resolucao', r);
    fixture.componentRef.setInput('etapas', etapas);
    loader = TestbedHarnessEnvironment.loader(fixture);
    raizDoc = TestbedHarnessEnvironment.documentRootLoader(fixture);
  }

  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texto = (seletor: string): string | undefined => raiz().querySelector(seletor)?.textContent?.trim();
  const numero = (): string | undefined => texto('.etapa-numero');
  const erros = (): string[] => Array.from(raiz().querySelectorAll('mat-error'), (e) => e.textContent?.trim() ?? '');

  const campo = (nome: 'parametro' | 'valor'): Promise<MatInputHarness> =>
    loader.getHarness(MatInputHarness.with({ selector: `[formControlName="${nome}"]` }));
  const escrever = async (nome: 'parametro' | 'valor', valor: string): Promise<void> => (await campo(nome)).setValue(valor);
  const equacao = (): Promise<MatSelectHarness> => loader.getHarness(MatSelectHarness);
  const escolherEquacao = async (nome: string): Promise<void> => {
    const select = await equacao();
    await select.open();
    await select.clickOptions({ text: nome });
  };
  const botao = (classe: string): Promise<MatButtonHarness> => loader.getHarness(MatButtonHarness.with({ selector: `.${classe}` }));
  const proxima = async (): Promise<void> => (await botao('etapa-proxima')).click();
  const anterior = async (): Promise<void> => (await botao('etapa-anterior')).click();

  /** Preenche e avança uma etapa numérica. */
  async function responderNumerica(parametro: string, valor: string): Promise<void> {
    await escrever('parametro', parametro);
    await escrever('valor', valor);
    await proxima();
  }

  async function responderTmb(nome = 'Mifflin-St Jeor', valor = '1671.25'): Promise<void> {
    await escolherEquacao(nome);
    await escrever('valor', valor);
    await proxima();
  }

  /** As 5 etapas, até o resumo. */
  async function responderTudo(): Promise<void> {
    await responderTmb();
    await responderNumerica('1.8', '3008.25');
    await responderNumerica('6', '420');
    await responderNumerica('1.6', '112');
    await responderNumerica('1', '70');
  }

  const respostasSalvas = () => service.listarRespostas(resolucao.id);

  describe('uma etapa por vez (RF07)', () => {
    it('começa em "Etapa 1 de 5", na TMB, com Anterior desligado e Próxima ligada', async () => {
      await fixture.whenStable();

      expect(numero()).toBe('Etapa 1 de 5');
      expect(texto('.etapa-titulo')).toBe('Taxa metabólica basal (TMB)');
      expect(await (await botao('etapa-anterior')).isDisabled()).toBe(true);
      expect(await (await botao('etapa-proxima')).isDisabled()).toBe(false);
      expect(raiz().querySelectorAll('form').length).toBe(1);
    });

    it('mostra só os campos da etapa da vez', async () => {
      await fixture.whenStable();

      expect(raiz().querySelectorAll('mat-form-field').length).toBe(2);
      expect(raiz().querySelector('.campo-parametro mat-select')).not.toBeNull();
      expect(raiz().querySelector('.campo-valor input[type="number"]')).not.toBeNull();
    });

    it('avançar leva às etapas 2 a 5, nesta ordem: GET, carboidrato, proteína e gordura', async () => {
      await responderTmb();
      expect([numero(), texto('.etapa-titulo')]).toEqual(['Etapa 2 de 5', 'Gasto energético total (GET)']);
      await responderNumerica('1.8', '3008.25');
      expect([numero(), texto('.etapa-titulo')]).toEqual(['Etapa 3 de 5', 'Meta de carboidrato']);
      await responderNumerica('6', '420');
      expect([numero(), texto('.etapa-titulo')]).toEqual(['Etapa 4 de 5', 'Meta de proteína']);
      await responderNumerica('1.6', '112');
      expect([numero(), texto('.etapa-titulo')]).toEqual(['Etapa 5 de 5', 'Meta de gordura']);
    });
  });

  describe('campos e unidades', () => {
    it('TMB: select com as 3 equações, e o valor em kcal/dia', async () => {
      const select = await equacao();
      await select.open();

      const opcoes = await Promise.all((await select.getOptions()).map((o) => o.getText()));
      expect(opcoes).toEqual([...EQUACOES_TMB]);
      expect(texto('.campo-valor [matTextSuffix]')).toBe('kcal/dia');
      expect(texto('.campo-valor mat-label')).toBe('TMB');
    });

    it('o select oferece as 3 equações mesmo quando o caso só aceita uma', async () => {
      etapas = etapas.map((e) => (e.tipo === 'TMB' ? { ...e, opcoesAceitaveis: ['Mifflin-St Jeor'] } : e));
      abrir();
      const select = await equacao();
      await select.open();

      expect((await select.getOptions()).length).toBe(3);
    });

    it('GET: fator de atividade (sem unidade) e o valor em kcal/dia', async () => {
      await responderTmb();

      expect(texto('.campo-parametro mat-label')).toBe('Fator de atividade');
      expect(texto('.campo-parametro mat-hint')).toBe('Sem unidade');
      expect(texto('.campo-valor mat-label')).toBe('GET');
      expect(texto('.campo-valor [matTextSuffix]')).toBe('kcal/dia');
      expect(raiz().querySelector('.campo-parametro mat-select')).toBeNull();
    });

    it('CHO, PTN e LIP: g/kg/dia no parâmetro e g/dia no valor', async () => {
      await responderTmb();
      await responderNumerica('1.8', '3008.25');

      for (const [rotulo, valor, parametro, total] of [
        ['Carboidrato', 'Carboidrato total', '6', '420'],
        ['Proteína', 'Proteína total', '1.6', '112'],
        ['Gordura', 'Gordura total', '1', '70'],
      ]) {
        expect(texto('.campo-parametro mat-label')).toBe(rotulo);
        expect(texto('.campo-parametro [matTextSuffix]')).toBe('g/kg/dia');
        expect(texto('.campo-valor mat-label')).toBe(valor);
        expect(texto('.campo-valor [matTextSuffix]')).toBe('g/dia');
        await responderNumerica(parametro, total);
      }
    });

    it('não dá a conta pronta nem o valor esperado: nenhuma fórmula, referência ou resultado na tela', async () => {
      const fases = [];
      fases.push(raiz().textContent ?? '');
      await responderTmb();
      fases.push(raiz().textContent ?? '');
      await responderNumerica('1.8', '3008.25');
      fases.push(raiz().textContent ?? '');

      for (const conteudo of fases) {
        expect(conteudo).not.toMatch(/[×÷=]/);
        expect(conteudo).not.toContain('1671');
        expect(conteudo).not.toContain('3008');
        for (const etapa of etapas) {
          expect(conteudo).not.toContain(etapa.criterioReferencia);
        }
      }
      // as referências do caso 1 (GET 1,8; PTN 1,6) também não aparecem como dica
      expect(fases[0]).not.toContain('1,8');
    });
  });

  describe('validação só de formato (RF11)', () => {
    it('Próxima com tudo vazio não avança, não salva e mostra o que falta', async () => {
      await proxima();

      expect(numero()).toBe('Etapa 1 de 5');
      expect(respostasSalvas()).toEqual([]);
      expect(erros()).toEqual(['Escolha uma equação', 'Campo obrigatório']);
    });

    it('etapa numérica vazia: "Campo obrigatório" nos dois campos', async () => {
      await responderTmb();
      await proxima();

      expect(numero()).toBe('Etapa 2 de 5');
      expect(erros()).toEqual(['Campo obrigatório', 'Campo obrigatório']);
      expect(respostasSalvas().length).toBe(1); // só a TMB
    });

    it('zero e negativo não valem: "Informe um número maior que zero"', async () => {
      await escolherEquacao('Mifflin-St Jeor');
      await escrever('valor', '0');
      await proxima();
      expect(erros()).toEqual(['Informe um número maior que zero']);

      await escrever('valor', '-5');
      await proxima();
      expect(erros()).toEqual(['Informe um número maior que zero']);
      expect(numero()).toBe('Etapa 1 de 5');
      expect(respostasSalvas()).toEqual([]);
    });

    it('texto no campo numérico não vira número: vale como vazio', async () => {
      await escolherEquacao('Mifflin-St Jeor');
      await escrever('valor', 'abc');
      await proxima();

      expect(erros()).toEqual(['Campo obrigatório']);
      expect(respostasSalvas()).toEqual([]);
    });

    it('o erro some quando o valor é corrigido, e aí avança e salva', async () => {
      await escolherEquacao('Mifflin-St Jeor');
      await escrever('valor', '0');
      await proxima();
      expect(erros().length).toBe(1);

      await escrever('valor', '1671.25');
      await proxima();

      expect(erros()).toEqual([]);
      expect(numero()).toBe('Etapa 2 de 5');
      expect(respostasSalvas().length).toBe(1);
    });

    it('os erros são do formato, não da resposta: um valor absurdo mas bem formado passa', async () => {
      await escolherEquacao('Cunningham');
      await escrever('valor', '999999');
      await proxima();

      expect(numero()).toBe('Etapa 2 de 5');
      expect(respostasSalvas()[0]).toMatchObject({ parametro: 'Cunningham', valor: 999999 });
    });
  });

  describe('salvar ao avançar e ao sair', () => {
    it('Próxima salva a etapa no serviço, com parâmetro e valor, e sem classificação (RF09)', async () => {
      await responderTmb('Harris-Benedict revisada', '1695.667');

      expect(respostasSalvas()).toEqual([
        expect.objectContaining({ etapaId: etapas[0].id, parametro: 'Harris-Benedict revisada', valor: 1695.667 }),
      ]);
      expect(respostasSalvas()[0].classificacao).toBeUndefined();
      expect(respostasSalvas()[0].tipoErro).toBeUndefined();
    });

    it('cada etapa numérica salva o fator ou o g/kg como parâmetro e o total como valor', async () => {
      await responderTmb();
      await responderNumerica('1.8', '3008.25');
      await responderNumerica('6', '420');

      expect(respostasSalvas().map((r) => [r.parametro, r.valor])).toEqual([['Mifflin-St Jeor', 1671.25], [1.8, 3008.25], [6, 420]]);
    });

    it('Anterior salva a etapa válida em que estava, sem exigir que termine', async () => {
      await responderTmb();
      await escrever('parametro', '1.8');
      await escrever('valor', '3008.25');

      await anterior();

      expect(numero()).toBe('Etapa 1 de 5');
      expect(respostasSalvas().map((r) => r.valor)).toEqual([1671.25, 3008.25]);
    });

    it('Anterior com a etapa inválida volta sem salvar e sem mostrar erro', async () => {
      await responderTmb();
      await escrever('parametro', '1.8');
      await escrever('valor', '0');

      await anterior();

      expect(numero()).toBe('Etapa 1 de 5');
      expect(respostasSalvas().length).toBe(1);
      expect(erros()).toEqual([]);
    });

    it('salvarAtual (chamado pelo resolver ao sair do passo) salva a etapa válida e alterada', async () => {
      await escolherEquacao('Mifflin-St Jeor');
      await escrever('valor', '1671.25');
      expect(respostasSalvas()).toEqual([]);

      fixture.componentInstance.salvarAtual();

      expect(respostasSalvas()).toEqual([expect.objectContaining({ parametro: 'Mifflin-St Jeor', valor: 1671.25 })]);
    });

    it('salvarAtual com a etapa inválida não salva e não mostra erro', async () => {
      await escrever('valor', '0');

      fixture.componentInstance.salvarAtual();

      expect(respostasSalvas()).toEqual([]);
      expect(erros()).toEqual([]);
    });

    it('alterar uma resposta já salva substitui a anterior, sem duplicar', async () => {
      await responderTudo();
      await (await loader.getHarness(MatButtonHarness.with({ selector: '[aria-label="Alterar a etapa 1"]' }))).click();
      await escrever('valor', '1700');
      await proxima();

      expect(numero()).toBe('Etapa 2 de 5');
      expect(respostasSalvas().length).toBe(5);
      expect(respostasSalvas()[0]).toMatchObject({ parametro: 'Mifflin-St Jeor', valor: 1700 });
    });

    it('se o serviço recusar (tentativa já submetida, por exemplo), avisa e não avança', async () => {
      vi.spyOn(service, 'salvarResposta').mockReturnValue(undefined);
      await escolherEquacao('Mifflin-St Jeor');
      await escrever('valor', '1671.25');

      await proxima();

      const avisos = await Promise.all((await raizDoc.getAllHarnesses(MatSnackBarHarness)).map((a) => a.getMessage()));
      expect(avisos).toEqual(['Não foi possível salvar a resposta']);
      expect(numero()).toBe('Etapa 1 de 5');
    });

    it('não grava de novo uma etapa que não mudou (voltar e avançar sem alterar)', async () => {
      await responderTmb();
      const salvar = vi.spyOn(service, 'salvarResposta');
      await anterior();
      await proxima();

      expect(salvar).not.toHaveBeenCalled();
      expect(numero()).toBe('Etapa 2 de 5');
    });
  });

  describe('voltar mostra o que já foi preenchido (RF10)', () => {
    it('Anterior devolve a etapa com a equação e o valor que foram digitados', async () => {
      await responderTmb('Cunningham', '1809');

      await anterior();

      expect(numero()).toBe('Etapa 1 de 5');
      expect(await (await equacao()).getValueText()).toBe('Cunningham');
      expect(await (await campo('valor')).getValue()).toBe('1809');
    });

    it('as etapas numéricas mantêm parâmetro e valor ao voltar', async () => {
      await responderTmb();
      await responderNumerica('1.8', '3008.25');

      await anterior();

      expect(numero()).toBe('Etapa 2 de 5');
      expect(await (await campo('parametro')).getValue()).toBe('1.8');
      expect(await (await campo('valor')).getValue()).toBe('3008.25');
    });

    it('o que foi digitado e ainda não salvo (inválido) também fica ao voltar', async () => {
      await responderTmb();
      await escrever('parametro', '1.8');
      await escrever('valor', '0');
      await anterior();

      await proxima();

      expect(await (await campo('parametro')).getValue()).toBe('1.8');
      expect(await (await campo('valor')).getValue()).toBe('0');
    });

    it('abrir a tentativa de novo mostra o que foi salvo, e continua na etapa 1', async () => {
      await responderTmb('Harris-Benedict revisada', '1695.667');
      await responderNumerica('1.7', '2882.6');
      fixture.destroy();

      abrir();
      await fixture.whenStable();

      expect(numero()).toBe('Etapa 1 de 5');
      expect(await (await equacao()).getValueText()).toBe('Harris-Benedict revisada');
      expect(await (await campo('valor')).getValue()).toBe('1695.667');
      await proxima();
      expect(await (await campo('parametro')).getValue()).toBe('1.7');
      expect(await (await campo('valor')).getValue()).toBe('2882.6');
    });

    it('uma tentativa nova começa vazia, sem herdar a anterior', async () => {
      await responderTmb();
      const outra = service.iniciar(CASO.id)!;

      fixture.componentRef.setInput('resolucao', outra);
      await fixture.whenStable();

      expect(numero()).toBe('Etapa 1 de 5');
      expect(await (await equacao()).getValueText()).toBe('');
      expect(await (await campo('valor')).getValue()).toBe('');
    });

    it('receber um objeto novo da mesma tentativa (a cada gravação) não apaga o que está sendo digitado', async () => {
      await escrever('valor', '16');
      fixture.componentRef.setInput('resolucao', { ...resolucao });
      await fixture.whenStable();

      expect(await (await campo('valor')).getValue()).toBe('16');
    });
  });

  describe('resumo das 5 respostas', () => {
    it('depois da etapa 5, mostra o resumo, com cada resposta e a unidade', async () => {
      await responderTudo();

      expect(numero()).toBe('Resumo das respostas');
      const itens = Array.from(raiz().querySelectorAll('.resumo-item'), (i) => [
        i.querySelector('dt')?.textContent?.trim(),
        i.querySelector('.resumo-parametro')?.textContent?.trim(),
        i.querySelector('.resumo-valor')?.textContent?.trim(),
      ]);
      expect(itens).toEqual([
        ['Etapa 1: Taxa metabólica basal (TMB)', 'Equação: Mifflin-St Jeor', 'TMB: 1.671,25 kcal/dia'],
        ['Etapa 2: Gasto energético total (GET)', 'Fator de atividade: 1,8', 'GET: 3.008,25 kcal/dia'],
        ['Etapa 3: Meta de carboidrato', 'Carboidrato: 6 g/kg/dia', 'Carboidrato total: 420 g/dia'],
        ['Etapa 4: Meta de proteína', 'Proteína: 1,6 g/kg/dia', 'Proteína total: 112 g/dia'],
        ['Etapa 5: Meta de gordura', 'Gordura: 1 g/kg/dia', 'Gordura total: 70 g/dia'],
      ]);
      expect(raiz().querySelector('form')).toBeNull();
    });

    it('etapa sem resposta aparece como "Não respondida" (status, não avaliação)', async () => {
      await responderTmb();
      // chega ao resumo sem responder as outras, pelo próprio estado do componente
      fixture.componentInstance['indice'].set(5);
      await fixture.whenStable();

      const vazios = Array.from(raiz().querySelectorAll('.resumo-vazio'), (v) => v.textContent?.trim());
      expect(vazios).toEqual(['Não respondida', 'Não respondida', 'Não respondida', 'Não respondida']);
      expect(raiz().querySelectorAll('.resumo-valor').length).toBe(1);
    });

    it('Anterior, no resumo, volta à etapa 5 com os valores', async () => {
      await responderTudo();

      await anterior();

      expect(numero()).toBe('Etapa 5 de 5');
      expect(await (await campo('valor')).getValue()).toBe('70');
    });

    it('"Alterar" leva à etapa escolhida, e dali dá para voltar ao resumo', async () => {
      await responderTudo();

      await (await loader.getHarness(MatButtonHarness.with({ selector: '[aria-label="Alterar a etapa 3"]' }))).click();

      expect(numero()).toBe('Etapa 3 de 5');
      expect(texto('.etapa-titulo')).toBe('Meta de carboidrato');
      expect(await (await campo('parametro')).getValue()).toBe('6');
    });

    it('o resumo acompanha uma resposta alterada', async () => {
      await responderTudo();
      await (await loader.getHarness(MatButtonHarness.with({ selector: '[aria-label="Alterar a etapa 3"]' }))).click();
      await escrever('parametro', '7');
      await escrever('valor', '490');
      await proxima(); // etapa 4
      await proxima(); // etapa 5
      await proxima(); // resumo

      expect(numero()).toBe('Resumo das respostas');
      expect(texto('.resumo-item:nth-child(3) .resumo-valor')).toBe('Carboidrato total: 490 g/dia');
    });
  });

  describe('nenhuma indicação de acerto ou erro (RF09)', () => {
    /** Tudo que denunciaria uma avaliação: palavras, ícones, classes de status. */
    function semAvaliacao(): void {
      const html = raiz().innerHTML;
      const conteudo = raiz().textContent ?? '';
      expect(conteudo).not.toMatch(/correta|divergente|erro de fato|certo|errado|acert|incorret|parab[eé]ns|confere/i);
      expect(raiz().querySelectorAll('mat-icon, svg[class*="check"], .mat-icon').length).toBe(0);
      expect(html).not.toMatch(/class="[^"]*(correta|divergente|erro-de-fato|acerto|sucesso|success)/i);
    }

    it('não aparece em nenhuma etapa, nem depois de salvar uma resposta bem formada', async () => {
      semAvaliacao();
      await responderTmb();
      semAvaliacao();
      await responderNumerica('1.8', '3008.25');
      semAvaliacao();
      await responderNumerica('6', '420');
      await responderNumerica('1.6', '112');
      await responderNumerica('1', '70');
      semAvaliacao(); // resumo
    });

    it('as mensagens de erro falam do formato, nunca do conteúdo da resposta', async () => {
      await proxima();
      semAvaliacao();
      for (const mensagem of erros()) {
        expect(['Escolha uma equação', 'Campo obrigatório', 'Informe um número válido', 'Informe um número maior que zero']).toContain(mensagem);
      }
    });

    it('a resposta salva não leva classificação, mesmo depois de editada várias vezes', async () => {
      await responderTudo();
      await (await loader.getHarness(MatButtonHarness.with({ selector: '[aria-label="Alterar a etapa 1"]' }))).click();
      await escolherEquacao('Cunningham');
      await proxima();

      expect(respostasSalvas().every((r) => r.classificacao === undefined && r.tipoErro === undefined)).toBe(true);
    });
  });

  it('o formulário envia com Enter (submit), como o botão Próxima', async () => {
    await escolherEquacao('Mifflin-St Jeor');
    await escrever('valor', '1671.25');

    (raiz().querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(numero()).toBe('Etapa 2 de 5');
  });
});
