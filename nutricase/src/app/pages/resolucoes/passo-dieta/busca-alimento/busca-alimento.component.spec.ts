import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatAutocompleteHarness } from '@angular/material/autocomplete/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatInputHarness } from '@angular/material/input/testing';
import { Alimento } from '../../../../core/models';
import { AlimentoService, CARREGADOR_TACO } from '../../../../core/services/alimento.service';
import { ResolucoesModule } from '../../resolucoes.module';
import { BuscaAlimentoComponent, InclusaoDeItem, LIMITE_SUGESTOES } from './busca-alimento.component';

function alimento(id: string, nome: string, grupo = 'Teste'): Alimento {
  return { id, nome, grupo, kcal: 100, carboidrato: 10, proteina: 5, gordura: 2, origem: 'TACO' };
}

// Doze "Arroz N" para provar o limite da lista curta, mais alguns com acento.
const ARROZES = Array.from({ length: 12 }, (_, i) => alimento(`arroz-${i + 1}`, `Arroz tipo ${i + 1}, cozido`, 'Cereais e derivados'));
const BASE: Alimento[] = [
  ...ARROZES,
  alimento('pao-queijo', 'Pão, de queijo, assado', 'Cereais e derivados'),
  alimento('feijao', 'Feijão, carioca, cozido', 'Leguminosas e derivados'),
  alimento('acai', 'Açaí, polpa, congelada', 'Frutas e derivados'),
];

describe('BuscaAlimentoComponent', () => {
  let fixture: ComponentFixture<BuscaAlimentoComponent>;
  let loader: HarnessLoader;
  let emitidos: InclusaoDeItem[];

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      // Importa o módulo (e não só declara o componente): o template é compilado com o escopo do módulo.
      imports: [ResolucoesModule],
      providers: [
        // Sem animação no teste: a lista do autocomplete abre e fecha na hora.
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        { provide: CARREGADOR_TACO, useValue: async () => BASE.map((a) => ({ ...a })) },
      ],
    }).compileComponents();
    await TestBed.inject(AlimentoService).carregar();
    fixture = TestBed.createComponent(BuscaAlimentoComponent);
    emitidos = [];
    fixture.componentInstance.incluir.subscribe((e) => emitidos.push(e));
    loader = TestbedHarnessEnvironment.loader(fixture);
    await fixture.whenStable();
  });

  afterEach(() => localStorage.clear());

  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const erros = (): string[] => Array.from(raiz().querySelectorAll('mat-error'), (e) => e.textContent?.trim() ?? '');
  const autocomplete = (): Promise<MatAutocompleteHarness> => loader.getHarness(MatAutocompleteHarness);
  const quantidade = (): Promise<MatInputHarness> => loader.getHarness(MatInputHarness.with({ selector: '[formControlName="quantidade"]' }));
  const incluir = async (): Promise<void> => (await loader.getHarness(MatButtonHarness.with({ selector: '.busca-incluir' }))).click();
  /**
   * O Material abre o painel do autocomplete depois de um `delay(0)` (um timer). O harness não espera timers
   * num app sem zone, então o teste espera um tick antes de olhar a lista. No navegador isso é imperceptível.
   */
  const aguardarPainel = async (): Promise<void> => {
    await new Promise((resolver) => setTimeout(resolver, 0));
    await fixture.whenStable();
  };
  /** Digita no campo e espera o painel; a lista vem vazia se o painel não abriu (sem sugestões). */
  const digitar = async (texto: string): Promise<MatAutocompleteHarness> => {
    const auto = await autocomplete();
    await auto.clear();
    await auto.enterText(texto);
    await aguardarPainel();
    return auto;
  };
  const sugestoes = async (texto: string): Promise<string[]> => {
    const auto = await digitar(texto);
    return (await auto.isOpen()) ? Promise.all((await auto.getOptions()).map((o) => o.getText())) : [];
  };
  /** Digita, espera o painel e escolhe a sugestão que bate com o texto. */
  const escolher = async (texto: string, opcao: RegExp): Promise<MatAutocompleteHarness> => {
    const auto = await digitar(texto);
    await auto.selectOption({ text: opcao });
    return auto;
  };

  describe('busca por nome (RF13)', () => {
    it('mostra uma lista curta de sugestões, no máximo 8', async () => {
      const lista = await sugestoes('arroz');

      expect(LIMITE_SUGESTOES).toBe(8);
      expect(lista.length).toBe(8); // há 12 arrozes na base
      expect(lista.every((t) => t.startsWith('Arroz tipo'))).toBe(true);
    });

    it('cada sugestão mostra o nome e o grupo', async () => {
      const lista = await sugestoes('feijão');

      expect(lista).toEqual(['Feijão, carioca, cozido (Leguminosas e derivados)']);
    });

    it('não diferencia acento nem maiúsculas: "pao" acha "Pão", "ACAI" acha "Açaí"', async () => {
      expect(await sugestoes('pao')).toEqual(['Pão, de queijo, assado (Cereais e derivados)']);
      expect(await sugestoes('ACAI')).toEqual(['Açaí, polpa, congelada (Frutas e derivados)']);
    });

    it('várias palavras, em qualquer ordem: "cozido arroz tipo 3"', async () => {
      expect(await sugestoes('cozido arroz tipo 3')).toEqual(['Arroz tipo 3, cozido (Cereais e derivados)']);
    });

    it('com uma letra só ainda não busca (precisa de 2)', async () => {
      expect(await sugestoes('a')).toEqual([]);
    });

    it('sem resultado, avisa "Nenhum alimento encontrado"', async () => {
      expect(await sugestoes('zzzz')).toEqual(['Nenhum alimento encontrado']);
      expect(raiz().querySelector('.sem-resultado')).toBeNull(); // a opção fica no painel, fora do componente
    });
  });

  describe('incluir (RF14)', () => {
    it('com o alimento escolhido e a quantidade válida, emite os dois e limpa o campo', async () => {
      const auto = await escolher('feij', /Feijão/);
      expect(await auto.getValue()).toBe('Feijão, carioca, cozido');
      await (await quantidade()).setValue('150');

      await incluir();

      expect(emitidos).toEqual([{ alimentoId: 'feijao', quantidadeGramas: 150 }]);
      expect(await (await autocomplete()).getValue()).toBe('');
      expect(await (await quantidade()).getValue()).toBe('');
      expect(erros()).toEqual([]);
    });

    it('depois de incluir, dá para incluir outro (o campo está limpo e sem erro)', async () => {
      await escolher('feij', /Feijão/);
      await (await quantidade()).setValue('100');
      await incluir();

      await escolher('acai', /Açaí/);
      await (await quantidade()).setValue('50');
      await incluir();

      expect(emitidos.map((e) => [e.alimentoId, e.quantidadeGramas])).toEqual([['feijao', 100], ['acai', 50]]);
    });

    it('texto digitado sem escolher da lista não vale: "Escolha um alimento da lista"', async () => {
      await digitar('feijão');
      await (await quantidade()).setValue('100');

      await incluir();

      expect(emitidos).toEqual([]);
      expect(erros()).toContain('Escolha um alimento da lista');
    });

    it('tudo vazio: pede o alimento e a quantidade, e não emite', async () => {
      await incluir();

      expect(emitidos).toEqual([]);
      expect(erros()).toEqual(['Escolha um alimento da lista', 'Campo obrigatório']);
    });

    it('a quantidade precisa ser maior que zero: 0 e negativo não valem', async () => {
      await escolher('feij', /Feijão/);

      await (await quantidade()).setValue('0');
      await incluir();
      expect(erros()).toEqual(['Informe um número maior que zero']);

      await (await quantidade()).setValue('-20');
      await incluir();
      expect(erros()).toEqual(['Informe um número maior que zero']);
      expect(emitidos).toEqual([]);
    });

    it('apagar o texto depois de escolher desfaz a escolha', async () => {
      const auto = await escolher('feij', /Feijão/);
      await auto.clear();
      await (await quantidade()).setValue('100');

      await incluir();

      expect(emitidos).toEqual([]);
    });

    it('mostra a unidade (g) na quantidade', () => {
      expect(raiz().querySelector('.campo-quantidade [matTextSuffix]')?.textContent?.trim()).toBe('g');
    });
  });
});
