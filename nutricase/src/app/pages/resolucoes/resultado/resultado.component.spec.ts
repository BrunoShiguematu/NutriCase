import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatSnackBarHarness } from '@angular/material/snack-bar/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { CASOS_EXEMPLO } from '../../../core/data/casos-exemplo';
import { Alimento, TipoEtapa } from '../../../core/models';
import { AlimentoService, CarregadorTaco, CARREGADOR_TACO } from '../../../core/services/alimento.service';
import { CasoService } from '../../../core/services/caso.service';
import { ResolucaoService } from '../../../core/services/resolucao.service';
import { ResolucoesModule } from '../resolucoes.module';
import { ResultadoComponent } from './resultado.component';

const CASO = CASOS_EXEMPLO[0]; // Carlos: 70 kg; referências GET 1,8 · CHO 6 · PTN 1,6 · LIP 1; tolerância da dieta 10 %

// Cinco alimentos iguais (por 100 g: 100 kcal, 14 g CHO, 3,7 g PTN, 2,3 g LIP): 3000 g dão 3000 kcal, 420 g CHO, 111 g PTN, 69 g LIP.
const ALIMENTOS: Alimento[] = ['a1', 'a2', 'a3', 'a4', 'a5'].map((id) => ({
  id,
  nome: `Alimento ${id}`,
  grupo: 'Teste',
  kcal: 100,
  carboidrato: 14,
  proteina: 3.7,
  gordura: 2.3,
  origem: 'TACO',
}));

type Respostas = Record<TipoEtapa, [string | number, number]>;

/** Tudo certo para o caso 1 (Mifflin 1671,25; GET 1,8 → 3008,25; CHO 6 → 420; PTN 1,6 → 112; LIP 1 → 70). */
const CERTAS: Respostas = {
  TMB: ['Mifflin-St Jeor', 1671.25],
  GET: [1.8, 3008.25],
  CHO: [6, 420],
  PTN: [1.6, 112],
  LIP: [1, 70],
};

/**
 * Um erro de cada tipo e uma etapa divergente (o caso só aceita Mifflin na TMB, ver `restringirEquacoes`):
 *  TMB: Harris-Benedict (fora das aceitas) → escolha de equação; esperado 1716,619
 *       (88,362 + 13,397×70 + 4,799×177 − 5,677×28 = 88,362 + 937,79 + 849,423 − 158,956)
 *  GET: fator 1,8 com valor 2000 (esperado 1716,619 × 1,8 = 3089,91) → aritmética
 *  CHO: 6 g/kg com 420 000 (esperado 420 g) → conversão de unidade
 *  PTN: 3 g/kg (faixa 1,2–2,2) → meta fora de faixa
 *  LIP: 1,3 g/kg (na faixa, a 30 % da referência 1) com 91 g (1,3 × 70) → divergente
 */
const COM_ERROS: Respostas = {
  TMB: ['Harris-Benedict revisada', 1716.619],
  GET: [1.8, 2000],
  CHO: [6, 420000],
  PTN: [3, 210],
  LIP: [1.3, 91],
};

describe('ResultadoComponent', () => {
  let fixture: ComponentFixture<ResultadoComponent>;
  let loader: HarnessLoader;
  let service: ResolucaoService;
  let casos: CasoService;
  let alimentos: AlimentoService;
  let navegar: ReturnType<typeof vi.spyOn>;
  let parametros: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let carregador: CarregadorTaco;

  function configurar(): void {
    parametros = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({
      // Importa o módulo (e não só declara o componente): o template é compilado com o escopo do módulo.
      imports: [ResolucoesModule],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: parametros } },
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        { provide: CARREGADOR_TACO, useValue: () => carregador() },
      ],
    });
    service = TestBed.inject(ResolucaoService);
    casos = TestBed.inject(CasoService);
    alimentos = TestBed.inject(AlimentoService);
    navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  }

  beforeEach(() => {
    localStorage.clear();
    carregador = async () => ALIMENTOS.map((a) => ({ ...a }));
    configurar();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  // ---------- montagem das tentativas ----------

  /** O caso passa a aceitar só a Mifflin-St Jeor na TMB, para a escolha de outra equação ser erro. */
  function restringirEquacoes(): void {
    casos.atualizarEtapas(
      CASO.id,
      casos.listarEtapas(CASO.id).map((e) => (e.tipo === 'TMB' ? { ...e, opcoesAceitaveis: ['Mifflin-St Jeor'] } : e)),
    );
  }

  function responder(id: string, respostas: Respostas): void {
    for (const etapa of casos.listarEtapas(CASO.id)) {
      const [parametro, valor] = respostas[etapa.tipo];
      expect(service.salvarResposta(id, etapa.id, parametro, valor), etapa.tipo).toBeDefined();
    }
  }

  /** 4 refeições (pré e pós-treino, 5 alimentos, nenhuma passa de 40 % das kcal): 3000 kcal, sem alertas. */
  function dietaBoa(id: string): void {
    const refeicao = (nome: string, horario: string, marcador: 'pré-treino' | 'pós-treino' | 'nenhum') =>
      service.criarRefeicao(id, { nome, horario, marcador })!;
    const item = (r: { id: string }, alimentoId: string, g: number) => service.criarItem(r.id, { alimentoId, quantidadeGramas: g });
    const cafe = refeicao('Café', '06:30', 'pré-treino');
    const almoco = refeicao('Almoço', '12:00', 'nenhum');
    const lanche = refeicao('Lanche', '16:00', 'pós-treino');
    const jantar = refeicao('Jantar', '19:30', 'nenhum');
    item(cafe, 'a1', 500);
    item(cafe, 'a2', 500);
    item(almoco, 'a3', 600);
    item(almoco, 'a4', 500);
    item(lanche, 'a5', 500);
    item(jantar, 'a1', 400);
  }

  /** Uma refeição de 100 g: dieta fraca (sem pré/pós-treino, 1 refeição, 1 alimento) e longe das metas. */
  function dietaFraca(id: string): void {
    const unica = service.criarRefeicao(id, { nome: 'Único', horario: '12:00', marcador: 'nenhum' })!;
    service.criarItem(unica.id, { alimentoId: 'a1', quantidadeGramas: 100 });
  }

  async function submetida(respostas: Respostas = CERTAS, dieta: 'boa' | 'fraca' = 'boa', justificativa = ''): Promise<string> {
    const id = service.iniciar(CASO.id)!.id;
    responder(id, respostas);
    (dieta === 'boa' ? dietaBoa : dietaFraca)(id);
    if (justificativa) {
      service.salvarJustificativa(id, justificativa);
    }
    expect(await service.submeter(id), 'a tentativa de teste precisa ser submetida').toBeDefined();
    return id;
  }

  /**
   * Abre a tela como a rota `/resolucoes/:id/resultado` abriria. O resultado carrega de forma assíncrona (espera a
   * base de alimentos) e o `whenStable` não espera essas promessas, então, com `esperar`, repete até a tela sair do
   * estado "carregando".
   */
  async function abrir(id: string, esperar = true): Promise<void> {
    parametros.next(convertToParamMap({ id }));
    fixture = TestBed.createComponent(ResultadoComponent);
    loader = TestbedHarnessEnvironment.loader(fixture);
    await fixture.whenStable();
    if (esperar) {
      await aguardarResultado();
    }
  }

  async function aguardarResultado(): Promise<void> {
    for (let tentativa = 0; tentativa < 100 && fixture.nativeElement.querySelector('.mensagem-carregando'); tentativa++) {
      await new Promise((resolver) => setTimeout(resolver, 0));
      await fixture.whenStable();
    }
  }

  // ---------- leitura da tela ----------

  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const limpo = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();
  const texto = (seletor: string): string => limpo(raiz().querySelector(seletor)?.textContent);
  const textos = (seletor: string): string[] => Array.from(raiz().querySelectorAll(seletor), (e) => limpo(e.textContent));
  const linhaEtapa = (n: number): HTMLElement => raiz().querySelectorAll<HTMLElement>('.etapa-linha')[n - 1];
  const celula = (linha: HTMLElement, classe: string): string => limpo(linha.querySelector(`.${classe}`)?.textContent);
  const botao = (classe: string): Promise<MatButtonHarness> => loader.getHarness(MatButtonHarness.with({ selector: `.${classe}` }));

  // ====================================================================================================

  describe('dois blocos com título (RF33)', () => {
    beforeEach(async () => abrir(await submetida()));

    it('"Avaliação" e "Sugestões", cada um com o seu título, nessa ordem', () => {
      const titulos = Array.from(raiz().querySelectorAll('h2.bloco-titulo'), (h) => limpo(h.textContent));
      expect(titulos).toEqual(['Avaliação', 'Sugestões']);
      for (const bloco of Array.from(raiz().querySelectorAll('section.bloco'))) {
        const titulo = bloco.querySelector('h2');
        expect(bloco.getAttribute('aria-labelledby')).toBe(titulo?.id);
      }
      const ordem = Array.from(raiz().querySelectorAll('section.bloco'), (b) => b.className);
      expect(ordem[0]).toContain('bloco-avaliacao');
      expect(ordem[1]).toContain('bloco-sugestoes');
    });

    it('o título da página é o do caso', () => {
      expect(texto('h1.page-title')).toBe(`Resultado: ${CASO.titulo}`);
    });

    it('as Sugestões dizem que estão indisponíveis nesta versão (RF32), sem sugerir nada', () => {
      expect(texto('.bloco-sugestoes .sugestoes-indisponiveis')).toBe('Sugestões indisponíveis nesta versão. A avaliação acima está completa.');
      expect(raiz().querySelectorAll('.bloco-sugestoes li, .bloco-sugestoes table').length).toBe(0);
    });

    it('a Avaliação tem as 5 seções: etapas, dieta, resumo de erros, justificativa e comentário do caso', () => {
      expect(textos('.bloco-avaliacao h3.secao-titulo')).toEqual([
        'Etapas de cálculo',
        'Dieta',
        'Resumo dos erros',
        'Sua justificativa',
        'Comentário de referência do caso',
      ]);
    });
  });

  describe('etapas corrigidas (RF21–RF23)', () => {
    it('tudo certo: as 5 etapas com o parâmetro e o valor do aluno, o esperado e "Correta"', async () => {
      await abrir(await submetida());

      expect(textos('.tabela-etapas thead th')).toEqual([
        'Etapa',
        'Seu parâmetro',
        'Seu valor',
        'Valor esperado a partir das suas respostas',
        'Classificação',
      ]);
      expect(textos('.etapa-linha th')).toEqual([
        'Etapa 1: Taxa metabólica basal (TMB)',
        'Etapa 2: Gasto energético total (GET)',
        'Etapa 3: Meta de carboidrato',
        'Etapa 4: Meta de proteína',
        'Etapa 5: Meta de gordura',
      ]);
      expect(textos('.etapa-parametro')).toEqual(['Mifflin-St Jeor', '1,8', '6 g/kg/dia', '1,6 g/kg/dia', '1 g/kg/dia']);
      expect(textos('.etapa-valor')).toEqual(['1.671,25 kcal/dia', '3.008,25 kcal/dia', '420 g/dia', '112 g/dia', '70 g/dia']);
      expect(textos('.etapa-esperado')).toEqual(['1.671,25 kcal/dia', '3.008,25 kcal/dia', '420 g/dia', '112 g/dia', '70 g/dia']);
      expect(textos('.etapa-classificacao')).toEqual(['Correta', 'Correta', 'Correta', 'Correta', 'Correta']);
      expect(raiz().querySelectorAll('.etapa-detalhe').length).toBe(0); // nada a explicar
    });

    describe('com um erro de cada tipo e uma etapa divergente', () => {
      beforeEach(async () => {
        restringirEquacoes();
        await abrir(await submetida(COM_ERROS, 'fraca'));
      });

      it('mostra a classificação de cada etapa em texto, com o tipo do erro', () => {
        expect(textos('.etapa-classificacao')).toEqual([
          'Erro de fato: escolha de equação',
          'Erro de fato: aritmética',
          'Erro de fato: conversão de unidade',
          'Erro de fato: meta fora de faixa',
          'Divergente',
        ]);
      });

      it('mostra o valor esperado a partir das respostas DO ALUNO (RN04), não da referência', () => {
        // GET: 1716,619 (a TMB que ele informou) × 1,8 = 3089,91; PTN: 3 g/kg × 70 kg = 210 g; LIP: 1,3 × 70 = 91 g
        expect(textos('.etapa-esperado')).toEqual(['1.716,62 kcal/dia', '3.089,91 kcal/dia', '420 g/dia', '210 g/dia', '91 g/dia']);
      });

      it('a etapa divergente mostra o critério de referência do caso e a explicação (RF23)', () => {
        const detalhes = Array.from(raiz().querySelectorAll('.etapa-detalhe'));
        const doLip = detalhes[detalhes.length - 1];

        expect(limpo(doLip.querySelector('.etapa-criterio')?.textContent)).toBe(
          'Critério de referência do caso: Gordura de referência: 1 g/kg/dia. Faixa aceitável: 0,5 a 1,5 g/kg.',
        );
        expect(limpo(doLip.querySelector('.etapa-motivo')?.textContent)).toContain('Explicação: O parâmetro difere da referência do caso (1)');
      });

      it('as etapas com erro de fato mostram a explicação, mas não o critério de referência', () => {
        const detalhes = Array.from(raiz().querySelectorAll('.etapa-detalhe'));

        expect(detalhes.length).toBe(5);
        for (const detalhe of detalhes.slice(0, 4)) {
          expect(detalhe.querySelector('.etapa-motivo')).not.toBeNull();
          expect(detalhe.querySelector('.etapa-criterio')).toBeNull();
        }
        expect(limpo(detalhes[0].querySelector('.etapa-motivo')?.textContent)).toContain('Harris-Benedict revisada');
        expect(limpo(detalhes[2].querySelector('.etapa-motivo')?.textContent)).toContain('provável erro de unidade');
        expect(limpo(detalhes[3].querySelector('.etapa-motivo')?.textContent)).toContain('fora da faixa aceitável');
      });
    });

    it('a classificação é sempre texto, nunca só cor (RNF04): toda linha tem o texto e nada depende de estilo inline', async () => {
      restringirEquacoes();
      await abrir(await submetida(COM_ERROS, 'fraca'));

      for (const linha of Array.from(raiz().querySelectorAll<HTMLElement>('.etapa-linha'))) {
        expect(celula(linha, 'etapa-classificacao').length, linha.className).toBeGreaterThan(5);
      }
      expect(raiz().querySelectorAll('[style]').length).toBe(0);
      expect(raiz().querySelectorAll('mat-icon').length).toBe(0);
      // as classes existem para o estilo (T14), mas o texto basta sozinho
      expect(textos('.etapa-linha').every((t) => /Correta|Divergente|Erro de fato/.test(t))).toBe(true);
    });

    it('o critério mostrado é o que valia na submissão, mesmo que o docente edite as etapas depois', async () => {
      const id = await submetida({ ...CERTAS, LIP: [1.3, 91] });
      casos.atualizarEtapas(
        CASO.id,
        casos.listarEtapas(CASO.id).map((e) => (e.tipo === 'LIP' ? { ...e, criterioReferencia: 'Critério novo, editado depois.' } : e)),
      );

      await abrir(id);

      expect(texto('.etapa-criterio')).toContain('Gordura de referência: 1 g/kg/dia');
      expect(texto('.etapa-criterio')).not.toContain('Critério novo');
    });
  });

  describe('dieta (RF24–RF27)', () => {
    it('comparativo contra as metas do aluno, com total, meta, diferença, percentual e situação em texto', async () => {
      await abrir(await submetida());

      expect(texto('.dieta-tolerancia')).toBe('Tolerância do caso para a dieta: 10 %.');
      expect(textos('.comparativo-linha th')).toEqual(['Energia', 'Carboidrato', 'Proteína', 'Gordura']);
      expect(textos('.comparativo-total')).toEqual(['3.000 kcal', '420 g', '111 g', '69 g']);
      expect(textos('.comparativo-meta')).toEqual(['3.008,25 kcal', '420 g', '112 g', '70 g']);
      // diferenças com 1 casa decimal: 3000 − 3008,25 = −8,25 → −8,3 (−0,27 % → −0,3)
      expect(textos('.comparativo-diferenca')).toEqual([
        '−8,3 kcal (−0,3 %)',
        '0 g (0 %)',
        '−1 g (−0,9 %)',
        '−1 g (−1,4 %)',
      ]);
      expect(textos('.comparativo-situacao')).toEqual(['Dentro da tolerância', 'Dentro da tolerância', 'Dentro da tolerância', 'Dentro da tolerância']);
    });

    it('fora da tolerância aparece em texto ("Fora da tolerância"), contra as metas do aluno', async () => {
      restringirEquacoes();
      await abrir(await submetida(COM_ERROS, 'fraca'));

      // dieta de 100 g (100 kcal, 14 CHO, 3,7 PTN, 2,3 LIP) contra as metas que ele calculou: GET 2000, CHO 420000, PTN 210, LIP 91
      expect(textos('.comparativo-meta')).toEqual(['2.000 kcal', '420.000 g', '210 g', '91 g']);
      expect(textos('.comparativo-situacao')).toEqual(['Fora da tolerância', 'Fora da tolerância', 'Fora da tolerância', 'Fora da tolerância']);
    });

    it('dieta sem problemas: "Nenhum alerta"', async () => {
      await abrir(await submetida());

      expect(texto('.sem-alertas')).toContain('Nenhum alerta');
      expect(raiz().querySelectorAll('.alerta').length).toBe(0);
    });

    it('os alertas da dieta fraca aparecem com o tipo e o texto: pré/pós-treino, distribuição e variedade', async () => {
      await abrir(await submetida(CERTAS, 'fraca'));

      expect(textos('.alerta-tipo')).toEqual([
        'Falta pré-treino:',
        'Falta pós-treino:',
        'Poucas refeições:',
        'Refeição concentra kcal:',
        'Pouca variedade:',
      ]);
      expect(textos('.alerta-texto')).toContain('Falta uma refeição marcada como pré-treino.');
      expect(textos('.alerta-texto').some((t) => t.includes('menos de 3 refeições'))).toBe(true);
      expect(textos('.alerta-texto').some((t) => t.includes('menos de 5 alimentos'))).toBe(true);
    });

    it('o alerta de restrição alimentar aparece quando um alimento da dieta viola a restrição do atleta', async () => {
      // caso 5: Pedro, intolerância à lactose
      const caso5 = CASOS_EXEMPLO[4];
      const id = service.iniciar(caso5.id)!.id;
      const etapas = casos.listarEtapas(caso5.id);
      const certas: Respostas = { TMB: ['Mifflin-St Jeor', 1], GET: [1.6, 1], CHO: [6, 1], PTN: [1.6, 1], LIP: [1, 1] };
      for (const etapa of etapas) {
        service.salvarResposta(id, etapa.id, ...(certas[etapa.tipo] as [string | number, number]));
      }
      const refeicao = service.criarRefeicao(id, { nome: 'Lanche', horario: '10:00', marcador: 'nenhum' })!;
      carregador = async () => [...ALIMENTOS, { ...ALIMENTOS[0], id: 'leite', nome: 'Leite, de vaca, integral' }];
      TestBed.resetTestingModule();
      configurar();
      localStorage.removeItem('nutricase.alimentos');
      service.criarItem(refeicao.id, { alimentoId: 'leite', quantidadeGramas: 200 });
      expect(await service.submeter(id)).toBeDefined();

      await abrir(id);

      expect(textos('.alerta-tipo')).toContain('Restrição violada:');
      expect(textos('.alerta-texto').some((t) => t.includes('Intolerância à lactose'))).toBe(true);
    });

    it('item que não está na base fica de fora dos totais e a tela avisa', async () => {
      const id = service.iniciar(CASO.id)!.id;
      responder(id, CERTAS);
      const refeicao = service.criarRefeicao(id, { nome: 'Café', horario: '07:00', marcador: 'nenhum' })!;
      service.criarItem(refeicao.id, { alimentoId: 'a1', quantidadeGramas: 100 });
      service.criarItem(refeicao.id, { alimentoId: 'some-da-base', quantidadeGramas: 100 });
      await service.submeter(id);

      await abrir(id);

      expect(texto('.dieta-incompleta')).toBe('1 item sem dados completos na base de alimentos não entrou nos totais.');
    });
  });

  describe('resumo dos erros pelos 5 tipos (RF34)', () => {
    it('um erro de cada tipo: cada tipo com a contagem 1', async () => {
      restringirEquacoes();
      await abrir(await submetida(COM_ERROS, 'fraca'));

      const linhas = Array.from(raiz().querySelectorAll('.resumo-linha'), (l) => [limpo(l.querySelector('th')?.textContent), limpo(l.querySelector('td')?.textContent)]);
      expect(linhas).toEqual([
        ['Conversão de unidade', '1'],
        ['Escolha de equação', '1'],
        ['Aritmética', '1'],
        ['Meta fora de faixa', '1'],
        ['Dieta fora das metas', '1'],
      ]);
    });

    it('sem erros: os 5 tipos aparecem, todos com 0', async () => {
      await abrir(await submetida());

      expect(textos('.resumo-linha th')).toEqual(['Conversão de unidade', 'Escolha de equação', 'Aritmética', 'Meta fora de faixa', 'Dieta fora das metas']);
      expect(textos('.resumo-quantidade')).toEqual(['0', '0', '0', '0', '0']);
    });

    it('a divergência não conta como erro de etapa', async () => {
      await abrir(await submetida({ ...CERTAS, LIP: [1.3, 91] }));

      expect(textos('.etapa-classificacao')[4]).toBe('Divergente');
      // os 4 tipos de erro de etapa ficam em 0; "dieta fora das metas" é 1 só porque a meta de gordura dele subiu
      // para 91 g e a dieta (69 g) ficou 24 % abaixo, o que não tem a ver com a divergência
      expect(textos('.resumo-quantidade')).toEqual(['0', '0', '0', '0', '1']);
    });

    it('conta mais de um erro do mesmo tipo', async () => {
      restringirEquacoes();
      // CHO e PTN em mg: duas conversões de unidade
      await abrir(await submetida({ ...CERTAS, CHO: [6, 420000], PTN: [1.6, 112000] }));

      expect(textos('.resumo-quantidade')[0]).toBe('2');
    });
  });

  describe('justificativa e comentário de referência (RF36)', () => {
    it('mostra a justificativa do aluno com o aviso "Não avaliada automaticamente."', async () => {
      await abrir(await submetida(CERTAS, 'boa', 'Escolhi mais carboidrato por causa do treino longo.'));

      expect(texto('.justificativa-aviso')).toBe('Não avaliada automaticamente.');
      expect(texto('.justificativa-texto')).toBe('Escolhi mais carboidrato por causa do treino longo.');
    });

    it('sem justificativa, diz que ela é opcional, e o aviso continua à vista', async () => {
      await abrir(await submetida());

      expect(texto('.sem-justificativa')).toBe('Você não escreveu justificativa (ela é opcional).');
      expect(texto('.justificativa-aviso')).toBe('Não avaliada automaticamente.');
    });

    it('mostra o comentário de referência do caso', async () => {
      await abrir(await submetida());

      expect(texto('.comentario-texto')).toBe(CASO.comentarioReferencia);
    });
  });

  describe('botões', () => {
    beforeEach(async () => abrir(await submetida()));

    it('"Refazer" começa uma nova tentativa do mesmo caso e abre a tela dela (RF35)', async () => {
      const anterior = service.listar()[0];

      await (await botao('resultado-refazer')).click();

      const [nova] = service.listar();
      expect(service.listar().length).toBe(2);
      expect(nova.id).not.toBe(anterior.id);
      expect(nova.casoId).toBe(anterior.casoId);
      expect(nova.status).toBe('em andamento');
      expect(service.listarRespostas(nova.id)).toEqual([]);
      expect(navegar).toHaveBeenCalledWith(['/resolucoes', nova.id]);
      expect(service.buscar(anterior.id)!.status).toBe('submetida'); // a anterior fica como estava
    });

    it('se o caso foi excluído, "Refazer" avisa e não navega', async () => {
      casos.excluir(CASO.id);

      await (await botao('resultado-refazer')).click();

      const avisos = await Promise.all(
        (await TestbedHarnessEnvironment.documentRootLoader(fixture).getAllHarnesses(MatSnackBarHarness)).map((a) => a.getMessage()),
      );
      expect(avisos).toEqual(['Não foi possível refazer: o caso não existe mais']);
      expect(navegar).not.toHaveBeenCalled();
      expect(service.listar().length).toBe(1);
    });

    it('"Voltar às resoluções" leva à lista', () => {
      const link = raiz().querySelector('.resultado-voltar') as HTMLAnchorElement;

      expect(link.textContent?.trim()).toBe('Voltar às resoluções');
      expect(link.getAttribute('href')).toBe('/resolucoes');
    });
  });

  describe('estados', () => {
    it('tentativa que não foi submetida volta para a tela de resolver, trocando a entrada do histórico', async () => {
      const id = service.iniciar(CASO.id)!.id;

      await abrir(id);

      expect(navegar).toHaveBeenCalledWith(['/resolucoes', id], { replaceUrl: true });
      expect(texto('.mensagem-abrindo')).toContain('ainda não foi submetida');
      expect(raiz().querySelector('.bloco')).toBeNull();
    });

    it('endereço que não existe mostra a mensagem e o link para as resoluções', async () => {
      await abrir('nao-existe');

      expect(texto('.mensagem-erro h1')).toBe('Resolução não encontrada');
      expect(raiz().querySelector('.mensagem-erro')?.getAttribute('role')).toBe('alert');
      expect((raiz().querySelector('.voltar-resolucoes') as HTMLAnchorElement).getAttribute('href')).toBe('/resolucoes');
      expect(navegar).not.toHaveBeenCalled();
      expect(raiz().querySelector('.bloco')).toBeNull();
    });

    it('rota sem id também cai na mensagem', async () => {
      parametros.next(convertToParamMap({}));
      fixture = TestBed.createComponent(ResultadoComponent);
      await fixture.whenStable();

      expect(texto('.mensagem-erro h1')).toBe('Resolução não encontrada');
    });

    it('caso excluído depois da submissão: "Resultado indisponível", com o link para as resoluções', async () => {
      const id = await submetida();
      casos.excluir(CASO.id);

      await abrir(id);

      expect(texto('.mensagem-erro h1')).toBe('Resultado indisponível');
      expect(raiz().querySelector('.bloco')).toBeNull();
      expect((raiz().querySelector('.voltar-resolucoes') as HTMLAnchorElement).getAttribute('href')).toBe('/resolucoes');
    });

    it('enquanto a base de alimentos carrega, mostra "Carregando o resultado…" e depois o resultado', async () => {
      const id = await submetida();
      localStorage.removeItem('nutricase.alimentos');
      let liberar!: () => void;
      TestBed.resetTestingModule();
      carregador = () => new Promise<Alimento[]>((resolver) => (liberar = () => resolver(ALIMENTOS.map((a) => ({ ...a })))));
      configurar();

      await abrir(id, false);
      expect(texto('.mensagem-carregando')).toBe('Carregando o resultado…');
      expect(raiz().querySelector('.bloco')).toBeNull();

      liberar();
      await TestBed.inject(AlimentoService).carregar();
      await fixture.whenStable();
      await aguardarResultado();

      expect(raiz().querySelector('.mensagem-carregando')).toBeNull();
      expect(raiz().querySelector('.bloco-avaliacao')).not.toBeNull();
      expect(textos('.comparativo-total').length).toBe(4);
    });

    it('com erro na base de alimentos, as etapas continuam e a dieta avisa, com "Tentar de novo"', async () => {
      const id = await submetida();
      localStorage.removeItem('nutricase.alimentos');
      TestBed.resetTestingModule();
      let falhar = true;
      carregador = async () => {
        if (falhar) {
          throw new Error('sem TACO');
        }
        return ALIMENTOS.map((a) => ({ ...a }));
      };
      configurar();

      await abrir(id);

      expect(textos('.etapa-classificacao')).toEqual(['Correta', 'Correta', 'Correta', 'Correta', 'Correta']);
      expect(texto('.dieta-indisponivel')).toContain('Não foi possível avaliar a dieta agora');
      expect(raiz().querySelector('.dieta-indisponivel')?.getAttribute('role')).toBe('alert');
      expect((raiz().querySelector('.dieta-indisponivel') as HTMLElement).hidden).toBe(false); // à vista, não só no DOM
      expect(raiz().querySelector('.tabela-comparativo')).toBeNull();
      expect(textos('.resumo-quantidade')).toEqual(['0', '0', '0', '0', '0']); // o resumo vem do gravado na submissão

      falhar = false;
      await (await botao('dieta-tentar')).click();
      await fixture.whenStable();
      await aguardarResultado();

      expect(raiz().querySelector('.dieta-indisponivel')).toBeNull();
      expect(textos('.comparativo-total')).toEqual(['3.000 kcal', '420 g', '111 g', '69 g']);
    });

    it('acompanha a rota: se o id mudar com a tela aberta, mostra o resultado da outra tentativa', async () => {
      const primeira = await submetida();
      const segunda = await submetida(CERTAS, 'boa', 'Texto da segunda.');
      await abrir(primeira);
      expect(raiz().querySelector('.justificativa-texto')).toBeNull();

      parametros.next(convertToParamMap({ id: segunda }));
      await fixture.whenStable();
      await aguardarResultado();

      expect(texto('.justificativa-texto')).toBe('Texto da segunda.');
    });
  });
});
