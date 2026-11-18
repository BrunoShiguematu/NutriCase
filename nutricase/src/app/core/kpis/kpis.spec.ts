import { Classificacao, Resolucao, RespostaEtapa, ResumoErros, TIPOS_ERRO, TipoErro } from '../models';
import { calcularKpis, EntradaKpis, FiltroKpis, Kpis, TIPOS_ERRO_CALCULO, ultimosDias } from './kpis';

let contador = 0;
const DIA_10 = '2026-11-10T15:00:00.000Z';

/** Um período largo que contém o dia 10: o recorte não atrapalha os testes que não são sobre ele. */
const NOVEMBRO: Pick<FiltroKpis, 'inicio' | 'fim'> = { inicio: new Date('2026-11-01T00:00:00.000Z'), fim: new Date('2026-11-30T23:59:59.999Z') };
const CALCULOS: FiltroKpis = { tipo: 'calculos', ...NOVEMBRO };
const DIETA: FiltroKpis = { tipo: 'dieta', ...NOVEMBRO };

function resolucao(casoId: string, status: Resolucao['status'] = 'submetida', submetidaEm = DIA_10): Resolucao {
  contador += 1;
  return {
    id: `r${contador}`,
    casoId,
    data: '2026-11-10T14:30:00.000Z',
    status,
    justificativa: '',
    ...(status === 'submetida' ? { submetidaEm } : {}),
  };
}

function resposta(r: Resolucao, classificacao: Classificacao | undefined): RespostaEtapa {
  contador += 1;
  return { id: `x${contador}`, resolucaoId: r.id, etapaId: `e${contador}`, parametro: 1, valor: 1, classificacao };
}

function respostas(r: Resolucao, ...classificacoes: (Classificacao | undefined)[]): RespostaEtapa[] {
  return classificacoes.map((c) => resposta(r, c));
}

function resumo(parcial: Partial<ResumoErros> = {}): ResumoErros {
  return Object.fromEntries(TIPOS_ERRO.map((t) => [t, parcial[t] ?? 0])) as ResumoErros;
}

function entrada(parcial: Partial<EntradaKpis> = {}): EntradaKpis {
  return { resolucoes: [], respostas: [], resumosErros: new Map(), ...parcial };
}

/** Os 4 números do cartão de aproveitamento, ou `null` quando ele mostra "—". */
const aproveitamento = (k: Kpis) =>
  k.aproveitamento === null ? null : { percentual: k.aproveitamento, corretas: k.corretas, aceitaveis: k.aceitaveis, total: k.total, errosDeFato: k.errosDeFato };

const SEM_DADOS = { aproveitamento: null, corretas: null, total: null, aceitaveis: null, errosDeFato: null };

describe('calcularKpis, tipo "calculos"', () => {
  it('sem tentativas: tudo null, casos 0 e os 4 tipos de cálculo zerados', () => {
    const kpis = calcularKpis(entrada(), CALCULOS);

    expect(kpis).toMatchObject({ casosResolvidos: { tentativas: 0, casosDistintos: 0 }, ...SEM_DADOS });
    expect(kpis.errosPorTipo.total).toBe(0);
    expect(kpis.errosPorTipo.tipos.map((t) => t.tipo)).toEqual([...TIPOS_ERRO_CALCULO]);
    expect(TIPOS_ERRO_CALCULO).toEqual(['conversão de unidade', 'escolha de equação', 'aritmética', 'meta fora de faixa']);
  });

  it('conta corretas e aceitáveis como aproveitadas, e o erro de fato não', () => {
    const r = resolucao('caso-1');

    const kpis = calcularKpis(entrada({ resolucoes: [r], respostas: respostas(r, 'correta', 'divergente', 'erro de fato', 'correta', 'erro de fato') }), CALCULOS);

    expect(aproveitamento(kpis)).toEqual({ percentual: 60, corretas: 2, aceitaveis: 1, total: 5, errosDeFato: 2 });
  });

  it('todas com erro: 0%, não null', () => {
    const r = resolucao('caso-1');

    const kpis = calcularKpis(entrada({ resolucoes: [r], respostas: respostas(r, 'erro de fato', 'erro de fato') }), CALCULOS);

    expect(aproveitamento(kpis)).toEqual({ percentual: 0, corretas: 0, aceitaveis: 0, total: 2, errosDeFato: 2 });
  });

  it('submetida sem resposta avaliada: cartões null, mas a tentativa conta nos casos resolvidos', () => {
    const r = resolucao('caso-1');

    const kpis = calcularKpis(entrada({ resolucoes: [r], respostas: respostas(r, undefined, undefined) }), CALCULOS);

    expect(kpis).toMatchObject({ casosResolvidos: { tentativas: 1, casosDistintos: 1 }, ...SEM_DADOS });
  });

  it('ignora respostas sem classificação e respostas de tentativa fora da lista', () => {
    const r = resolucao('caso-1');
    const solta = resolucao('caso-9');

    const kpis = calcularKpis(entrada({ resolucoes: [r], respostas: [...respostas(r, 'correta', undefined), ...respostas(solta, 'erro de fato')] }), CALCULOS);

    expect(aproveitamento(kpis)).toMatchObject({ total: 1, percentual: 100 });
  });

  it('tentativa em andamento não conta em nenhum KPI, mesmo com respostas e resumo', () => {
    const andamento = resolucao('caso-1', 'em andamento');
    const submetida = resolucao('caso-2');

    const kpis = calcularKpis(
      entrada({
        resolucoes: [andamento, submetida],
        respostas: [...respostas(submetida, 'correta'), ...respostas(andamento, 'erro de fato')],
        resumosErros: new Map([[andamento.id, resumo({ aritmética: 4 })]]),
      }),
      CALCULOS,
    );

    expect(kpis.casosResolvidos).toEqual({ tentativas: 1, casosDistintos: 1 });
    expect(aproveitamento(kpis)).toMatchObject({ total: 1 });
    expect(kpis.errosPorTipo.total).toBe(0);
  });

  it('várias tentativas do mesmo caso: todas contam, o caso uma vez, e as respostas se somam', () => {
    const a = resolucao('caso-1');
    const b = resolucao('caso-1');
    const c = resolucao('caso-2');

    const kpis = calcularKpis(
      entrada({ resolucoes: [a, b, c], respostas: [...respostas(a, 'erro de fato', 'correta'), ...respostas(b, 'correta', 'divergente')] }),
      CALCULOS,
    );

    expect(kpis.casosResolvidos).toEqual({ tentativas: 3, casosDistintos: 2 });
    expect(aproveitamento(kpis)).toMatchObject({ corretas: 2, aceitaveis: 1, total: 4, percentual: 75 });
  });

  describe('erros por tipo', () => {
    it.each([...TIPOS_ERRO_CALCULO])('erro só de "%s": os outros 3 ficam em 0', (tipo: TipoErro) => {
      const r = resolucao('caso-1');

      const { errosPorTipo } = calcularKpis(entrada({ resolucoes: [r], resumosErros: new Map([[r.id, resumo({ [tipo]: 2 })]]) }), CALCULOS);

      expect(errosPorTipo.total).toBe(2);
      expect(errosPorTipo.tipos.map((t) => [t.tipo, t.quantidade])).toEqual(TIPOS_ERRO_CALCULO.map((t) => [t, t === tipo ? 2 : 0]));
    });

    it('soma várias tentativas e deixa a dieta fora do tipo "calculos"', () => {
      const a = resolucao('caso-1');
      const b = resolucao('caso-2');

      const { errosPorTipo } = calcularKpis(
        entrada({
          resolucoes: [a, b],
          resumosErros: new Map([
            [a.id, resumo({ aritmética: 1, 'dieta fora das metas': 1 })],
            [b.id, resumo({ aritmética: 2, 'conversão de unidade': 1 })],
          ]),
        }),
        CALCULOS,
      );

      expect(errosPorTipo.tipos.map((t) => t.quantidade)).toEqual([1, 0, 3, 0]);
      expect(errosPorTipo.total).toBe(4);
    });

    it('submetida sem resumo (dado inconsistente): não quebra e conta como 0', () => {
      expect(calcularKpis(entrada({ resolucoes: [resolucao('caso-1')] }), CALCULOS).errosPorTipo.total).toBe(0);
    });
  });

  describe('arredondamento do percentual', () => {
    function percentual(corretas: number, total: number): number | null {
      const r = resolucao('caso-1');
      const classificacoes: Classificacao[] = Array.from({ length: total }, (_, i) => (i < corretas ? 'correta' : 'erro de fato'));
      return calcularKpis(entrada({ resolucoes: [r], respostas: respostas(r, ...classificacoes) }), CALCULOS).aproveitamento;
    }

    it.each([
      [1, 3, 33],
      [2, 3, 67],
      [1, 8, 13], // 12,5 sobe
      [3, 8, 38], // 37,5 sobe
      [5, 5, 100],
      [0, 5, 0],
      [1, 200, 1], // 0,5 sobe
      [1, 201, 0],
    ])('%i de %i etapas: %i%', (corretas, total, esperado) => {
      expect(percentual(corretas, total)).toBe(esperado);
    });
  });
});

describe('calcularKpis, tipo "dieta"', () => {
  /** Uma submetida cuja dieta ficou dentro (`false`) ou fora (`true`) das metas. */
  function tentativa(casoId: string, fora: boolean, submetidaEm = DIA_10): [Resolucao, ResumoErros] {
    return [resolucao(casoId, 'submetida', submetidaEm), resumo({ 'dieta fora das metas': fora ? 1 : 0 })];
  }
  const montar = (...tentativas: [Resolucao, ResumoErros][]) =>
    entrada({ resolucoes: tentativas.map(([r]) => r), resumosErros: new Map(tentativas.map(([r, s]) => [r.id, s])) });

  it('sem tentativas: tudo null, aceitáveis null e só o tipo "dieta fora das metas" com 0', () => {
    const kpis = calcularKpis(entrada(), DIETA);

    expect(kpis).toMatchObject({ casosResolvidos: { tentativas: 0, casosDistintos: 0 }, ...SEM_DADOS });
    expect(kpis.errosPorTipo).toEqual({ tipos: [{ tipo: 'dieta fora das metas', quantidade: 0 }], total: 0 });
  });

  it('aproveitamento é a % de tentativas com a dieta dentro das metas; aceitáveis é sempre null', () => {
    const kpis = calcularKpis(montar(tentativa('a', false), tentativa('b', false), tentativa('c', true), tentativa('d', false)), DIETA);

    expect(kpis.aproveitamento).toBe(75);
    expect(kpis.corretas).toBe(3);
    expect(kpis.total).toBe(4);
    expect(kpis.aceitaveis).toBeNull();
    expect(kpis.errosDeFato).toBe(1);
    expect(kpis.errosPorTipo).toEqual({ tipos: [{ tipo: 'dieta fora das metas', quantidade: 1 }], total: 1 });
  });

  it('todas fora das metas: 0%, não null; todas dentro: 100% e 0 erros', () => {
    expect(calcularKpis(montar(tentativa('a', true), tentativa('b', true)), DIETA)).toMatchObject({ aproveitamento: 0, corretas: 0, total: 2, errosDeFato: 2 });
    expect(calcularKpis(montar(tentativa('a', false)), DIETA)).toMatchObject({ aproveitamento: 100, corretas: 1, total: 1, errosDeFato: 0 });
  });

  it('ignora os erros de cálculo do resumo e as respostas das etapas', () => {
    const r = resolucao('a');

    const kpis = calcularKpis(
      entrada({ resolucoes: [r], respostas: respostas(r, 'erro de fato'), resumosErros: new Map([[r.id, resumo({ aritmética: 3 })]]) }),
      DIETA,
    );

    expect(kpis).toMatchObject({ aproveitamento: 100, total: 1, errosDeFato: 0 });
  });

  it('tentativa submetida sem resumo (dado inconsistente) fica fora da conta da dieta, mas conta nos casos resolvidos', () => {
    const kpis = calcularKpis(entrada({ resolucoes: [resolucao('a')] }), DIETA);

    expect(kpis).toMatchObject({ casosResolvidos: { tentativas: 1, casosDistintos: 1 }, ...SEM_DADOS });
  });

  it('em andamento não conta', () => {
    const andamento = resolucao('a', 'em andamento');

    const kpis = calcularKpis(entrada({ resolucoes: [andamento], resumosErros: new Map([[andamento.id, resumo({ 'dieta fora das metas': 1 })]]) }), DIETA);

    expect(kpis).toMatchObject({ casosResolvidos: { tentativas: 0, casosDistintos: 0 }, ...SEM_DADOS });
  });
});

describe('período do filtro (por submetidaEm)', () => {
  const inicio = new Date('2026-11-10T00:00:00.000Z');
  const fim = new Date('2026-11-12T23:59:59.999Z');

  /** Uma submetida em `quando`, toda correta, com a dieta dentro das metas. */
  function submetidaEm(quando: string) {
    const r = resolucao(`caso-${quando}`, 'submetida', quando);
    return { r, respostas: respostas(r, 'correta'), resumo: [r.id, resumo()] as [string, ResumoErros] };
  }
  const montar = (...datas: string[]) => {
    const feitas = datas.map(submetidaEm);
    return entrada({ resolucoes: feitas.map((f) => f.r), respostas: feitas.flatMap((f) => f.respostas), resumosErros: new Map(feitas.map((f) => f.resumo)) });
  };

  it.each([
    ['o instante exato do início', '2026-11-10T00:00:00.000Z', 1],
    ['o instante exato do fim', '2026-11-12T23:59:59.999Z', 1],
    ['1 ms antes do início', '2026-11-09T23:59:59.999Z', 0],
    ['1 ms depois do fim', '2026-11-13T00:00:00.000Z', 0],
    ['no meio do período', '2026-11-11T12:00:00.000Z', 1],
  ])('%s: %i tentativa(s) entram', (_nome, quando, esperado) => {
    for (const tipo of ['calculos', 'dieta'] as const) {
      const kpis = calcularKpis(montar(quando), { tipo, inicio, fim });

      expect(kpis.casosResolvidos.tentativas, tipo).toBe(esperado);
      expect(kpis.total === null, tipo).toBe(esperado === 0);
    }
  });

  it('só o que está no período entra nas contas, em todos os campos', () => {
    const entradaMista = montar('2026-11-08T10:00:00.000Z', '2026-11-11T10:00:00.000Z', '2026-11-20T10:00:00.000Z');

    const kpis = calcularKpis(entradaMista, { tipo: 'calculos', inicio, fim });

    expect(kpis.casosResolvidos).toEqual({ tentativas: 1, casosDistintos: 1 });
    expect(kpis.total).toBe(1);
  });

  it('submetida sem submetidaEm (dado inconsistente) fica fora de qualquer período', () => {
    const r: Resolucao = { id: 'sem-data', casoId: 'c', data: DIA_10, status: 'submetida', justificativa: '' };

    expect(calcularKpis(entrada({ resolucoes: [r] }), CALCULOS).casosResolvidos.tentativas).toBe(0);
  });
});

describe('ultimosDias', () => {
  it('7 dias: do começo do dia 6 dias atrás ao último instante de hoje, no horário local', () => {
    const agora = new Date(2026, 10, 18, 15, 30);

    const { inicio, fim } = ultimosDias(7, agora);

    expect(inicio).toEqual(new Date(2026, 10, 12, 0, 0, 0, 0));
    expect(fim).toEqual(new Date(2026, 10, 18, 23, 59, 59, 999));
  });

  it('1 dia é só hoje', () => {
    const { inicio, fim } = ultimosDias(1, new Date(2026, 10, 18, 9));

    expect(inicio).toEqual(new Date(2026, 10, 18, 0, 0, 0, 0));
    expect(fim.getDate()).toBe(18);
  });
});

it('calcularKpis não altera os dados recebidos', () => {
  const r = resolucao('caso-1');
  const original = entrada({ resolucoes: [r], respostas: respostas(r, 'correta', 'erro de fato'), resumosErros: new Map([[r.id, resumo({ aritmética: 1 })]]) });
  const copia = structuredClone({ ...original, resumosErros: [...original.resumosErros] });

  calcularKpis(original, CALCULOS);
  calcularKpis(original, DIETA);

  expect({ ...original, resumosErros: [...original.resumosErros] }).toEqual(copia);
});
