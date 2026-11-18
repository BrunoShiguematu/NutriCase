import { Classificacao, Resolucao, RespostaEtapa, ResumoErros, TIPOS_ERRO, TipoErro } from '../models';
import { calcularKpis, conquistas, EntradaKpis, FiltroKpis, Kpis, maiorOfensiva, MENSAGEM_PERIODO_INVERTIDO, MENSAGEM_PERIODO_LONGO, nivel, ofensiva, periodoEntreDatas, serieAproveitamento, TIPOS_ERRO_CALCULO, ultimosDias, unidadeDaSerie, validarPeriodo } from './kpis';

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

// ---------- D4: ofensiva, nível, conquistas e série ----------

/** Um instante no horário LOCAL (o fuso da máquina que roda o teste), como texto ISO, que é o que a submissão guarda. */
const em = (ano: number, mes: number, dia: number, hora = 12, min = 0, seg = 0, ms = 0): string =>
  new Date(ano, mes - 1, dia, hora, min, seg, ms).toISOString();

/** Uma tentativa submetida em cada instante dado. */
const submetidasEm = (...instantes: string[]): Resolucao[] => instantes.map((i) => resolucao(`caso-${i}`, 'submetida', i));

describe('ofensiva', () => {
  const hoje = new Date(2026, 10, 18, 15, 0); // 18/11/2026

  it('sem submissões: 0', () => {
    expect(ofensiva(hoje, [])).toBe(0);
  });

  it('hoje, ontem e anteontem: 3', () => {
    expect(ofensiva(hoje, submetidasEm(em(2026, 11, 18), em(2026, 11, 17), em(2026, 11, 16)))).toBe(3);
  });

  it('sem submissão hoje, a conta começa de ontem e a sequência ainda vale', () => {
    expect(ofensiva(hoje, submetidasEm(em(2026, 11, 17), em(2026, 11, 16)))).toBe(2);
  });

  it('sem submissão hoje nem ontem: 0, mesmo com sequência antiga', () => {
    expect(ofensiva(hoje, submetidasEm(em(2026, 11, 15), em(2026, 11, 14), em(2026, 11, 13)))).toBe(0);
  });

  it('um buraco de 1 dia corta a sequência: conta só o trecho de hoje para trás', () => {
    expect(ofensiva(hoje, submetidasEm(em(2026, 11, 18), em(2026, 11, 17), em(2026, 11, 15), em(2026, 11, 14)))).toBe(2);
  });

  it('várias submissões no mesmo dia contam 1 dia; em andamento não conta', () => {
    const resolucoes = [...submetidasEm(em(2026, 11, 18, 8), em(2026, 11, 18, 20), em(2026, 11, 17)), resolucao('x', 'em andamento')];

    expect(ofensiva(hoje, resolucoes)).toBe(2);
  });

  it('a virada do dia é a meia-noite LOCAL: 23:59:59.999 e 00:00:00.000 são dias diferentes', () => {
    const viradas = submetidasEm(em(2026, 11, 17, 23, 59, 59, 999), em(2026, 11, 18, 0, 0, 0, 0));

    expect(ofensiva(new Date(2026, 10, 18, 0, 0, 0, 0), viradas)).toBe(2);
    expect(ofensiva(hoje, submetidasEm(em(2026, 11, 17, 23, 58), em(2026, 11, 17, 23, 59, 59, 999)))).toBe(1);
  });

  it('atravessa a virada de mês e de ano', () => {
    expect(ofensiva(new Date(2027, 0, 2, 10), submetidasEm(em(2027, 1, 2), em(2027, 1, 1), em(2026, 12, 31)))).toBe(3);
  });
});

describe('maiorOfensiva', () => {
  it('é a maior sequência que já houve, mesmo depois de quebrada', () => {
    const resolucoes = submetidasEm(em(2026, 10, 1), em(2026, 10, 2), em(2026, 10, 3), em(2026, 10, 10), em(2026, 10, 11));

    expect(maiorOfensiva(resolucoes)).toBe(3);
    expect(maiorOfensiva([])).toBe(0);
  });
});

describe('nivel', () => {
  it.each([
    [0, 'Bronze', 'Prata', 3, 3, 0],
    [1, 'Bronze', 'Prata', 3, 2, 33],
    [2, 'Bronze', 'Prata', 3, 1, 67],
    [3, 'Prata', 'Ouro', 6, 3, 50],
    [4, 'Prata', 'Ouro', 6, 2, 67],
    [5, 'Prata', 'Ouro', 6, 1, 83],
  ])('%i casos: %s, próximo %s com meta %i, faltam %i, %i%', (casos, nome, proximo, meta, faltam, percentual) => {
    expect(nivel(casos)).toEqual({ nome, proximo, casos, meta, faltam, percentual });
  });

  it.each([6, 7, 20])('%i casos: Ouro, completo (sem próximo, meta null, 100%)', (casos) => {
    expect(nivel(casos)).toEqual({ nome: 'Ouro', proximo: null, casos, meta: null, faltam: 0, percentual: 100 });
  });

  it('número negativo não quebra: vira Bronze com 0', () => {
    expect(nivel(-2)).toMatchObject({ nome: 'Bronze', casos: 0, faltam: 3 });
  });
});

describe('conquistas', () => {
  const obtidas = (...args: Parameters<typeof conquistas>) => conquistas(...args).filter((c) => c.obtida).map((c) => c.id);

  it('sem nada: as 4, na ordem, nenhuma obtida', () => {
    expect(conquistas({ resolucoes: [], respostas: [] }).map((c) => [c.id, c.obtida])).toEqual([
      ['primeiro-caso', false],
      ['cinco-casos', false],
      ['ofensiva-3', false],
      ['cem-por-cento', false],
    ]);
  });

  it('primeiro caso: uma submetida basta; em andamento não', () => {
    expect(obtidas({ resolucoes: [resolucao('a', 'em andamento')], respostas: [] })).toEqual([]);
    expect(obtidas({ resolucoes: [resolucao('a')], respostas: [] })).toEqual(['primeiro-caso']);
  });

  it('5 casos distintos: 4 casos ou 5 tentativas do mesmo caso não bastam', () => {
    const quatro = ['a', 'b', 'c', 'd'].map((c) => resolucao(c));
    const mesmoCaso = Array.from({ length: 5 }, () => resolucao('a'));

    expect(obtidas({ resolucoes: quatro, respostas: [] })).not.toContain('cinco-casos');
    expect(obtidas({ resolucoes: mesmoCaso, respostas: [] })).not.toContain('cinco-casos');
    expect(obtidas({ resolucoes: [...quatro, resolucao('e')], respostas: [] })).toContain('cinco-casos');
  });

  it('ofensiva de 3 dias vale para sempre, mesmo quebrada; 2 dias não bastam', () => {
    expect(obtidas({ resolucoes: submetidasEm(em(2026, 9, 1), em(2026, 9, 2), em(2026, 9, 3)), respostas: [] })).toContain('ofensiva-3');
    expect(obtidas({ resolucoes: submetidasEm(em(2026, 9, 1), em(2026, 9, 2), em(2026, 9, 4)), respostas: [] })).not.toContain('ofensiva-3');
  });

  it('100% num caso: todas as avaliadas corretas ou aceitáveis, e pelo menos uma', () => {
    const boa = resolucao('a');
    const comErro = resolucao('b');
    const semAvaliada = resolucao('c');

    expect(obtidas({ resolucoes: [boa], respostas: respostas(boa, 'correta', 'divergente', undefined) })).toContain('cem-por-cento');
    expect(obtidas({ resolucoes: [comErro], respostas: respostas(comErro, 'correta', 'erro de fato') })).not.toContain('cem-por-cento');
    expect(obtidas({ resolucoes: [semAvaliada], respostas: respostas(semAvaliada, undefined) })).not.toContain('cem-por-cento');
  });

  it('uma tentativa boa basta, mesmo com outra ruim do mesmo caso; a em andamento não conta', () => {
    const ruim = resolucao('a');
    const boa = resolucao('a');
    const andamento = resolucao('b', 'em andamento');

    expect(obtidas({ resolucoes: [ruim, boa], respostas: [...respostas(ruim, 'erro de fato'), ...respostas(boa, 'correta')] })).toContain('cem-por-cento');
    expect(obtidas({ resolucoes: [andamento], respostas: respostas(andamento, 'correta') })).not.toContain('cem-por-cento');
  });
});

describe('serieAproveitamento', () => {
  /** Uma submetida em `quando`: 2 etapas corretas e 1 com erro de fato (67%), dieta dentro das metas. */
  function com(...instantes: string[]): EntradaKpis {
    const feitas = submetidasEm(...instantes);
    return entrada({
      resolucoes: feitas,
      respostas: feitas.flatMap((r) => respostas(r, 'correta', 'correta', 'erro de fato')),
      resumosErros: new Map(feitas.map((r) => [r.id, resumo()])),
    });
  }
  const periodo = (tipo: FiltroKpis['tipo'], de: Date, ate: Date): FiltroKpis => ({ tipo, inicio: de, fim: ate });

  it('1 dia: 1 ponto', () => {
    const serie = serieAproveitamento(com(em(2026, 11, 18, 10)), periodo('calculos', new Date(2026, 10, 18), new Date(2026, 10, 18, 23, 59, 59, 999)));

    expect(serie).toEqual([{ rotulo: '18/11', percentual: 67, casos: 1 }]);
  });

  it('7 dias: 1 ponto por dia, com null nos dias sem dados', () => {
    const serie = serieAproveitamento(com(em(2026, 11, 14), em(2026, 11, 14, 18), em(2026, 11, 18)), { tipo: 'calculos', ...ultimosDias(7, new Date(2026, 10, 18)) });

    expect(serie.map((p) => p.rotulo)).toEqual(['12/11', '13/11', '14/11', '15/11', '16/11', '17/11', '18/11']);
    expect(serie.map((p) => p.casos)).toEqual([0, 0, 2, 0, 0, 0, 1]);
    expect(serie.map((p) => p.percentual)).toEqual([null, null, 67, null, null, null, 67]);
  });

  it('14 dias ainda é por dia; 15 dias passa a ser por semana', () => {
    const quatorze = serieAproveitamento(com(), { tipo: 'calculos', ...ultimosDias(14, new Date(2026, 10, 18)) });
    const quinze = serieAproveitamento(com(), { tipo: 'calculos', ...ultimosDias(15, new Date(2026, 10, 18)) });

    expect(quatorze).toHaveLength(14);
    expect(quinze.map((p) => p.rotulo)).toEqual(['04/11 – 10/11', '11/11 – 17/11', '18/11 – 18/11']);
  });

  it('30 dias: 5 pontos, 4 semanas de 7 dias e a última com 2', () => {
    const serie = serieAproveitamento(com(em(2026, 11, 1), em(2026, 11, 8), em(2026, 11, 29), em(2026, 11, 30)), {
      tipo: 'calculos',
      ...ultimosDias(30, new Date(2026, 10, 30)),
    });

    expect(serie.map((p) => p.rotulo)).toEqual(['01/11 – 07/11', '08/11 – 14/11', '15/11 – 21/11', '22/11 – 28/11', '29/11 – 30/11']);
    expect(serie.map((p) => p.casos)).toEqual([1, 1, 0, 0, 2]);
  });

  it('as pontas de cada semana entram: 23:59:59.999 do 7º dia fica na semana 1, 00:00 do 8º vai para a 2', () => {
    const serie = serieAproveitamento(com(em(2026, 11, 7, 23, 59, 59, 999), em(2026, 11, 8, 0, 0, 0, 0)), {
      tipo: 'calculos',
      ...ultimosDias(30, new Date(2026, 10, 30)),
    });

    expect(serie.slice(0, 2).map((p) => p.casos)).toEqual([1, 1]);
  });

  it('um período com hora no começo ou no fim respeita a hora nas pontas', () => {
    const entradaDoDia = com(em(2026, 11, 18, 9), em(2026, 11, 18, 15));

    const serie = serieAproveitamento(entradaDoDia, periodo('calculos', new Date(2026, 10, 18, 12), new Date(2026, 10, 18, 18)));

    expect(serie).toEqual([{ rotulo: '18/11', percentual: 67, casos: 1 }]);
  });

  it('respeita o tipo: a dieta usa as tentativas dentro das metas', () => {
    const [a, b] = submetidasEm(em(2026, 11, 18, 9), em(2026, 11, 18, 10));
    const dieta = entrada({ resolucoes: [a, b], resumosErros: new Map([[a.id, resumo()], [b.id, resumo({ 'dieta fora das metas': 1 })]]) });
    const hoje = periodo('dieta', new Date(2026, 10, 18), new Date(2026, 10, 18, 23, 59, 59, 999));

    expect(serieAproveitamento(dieta, hoje)).toEqual([{ rotulo: '18/11', percentual: 50, casos: 2 }]);
    expect(serieAproveitamento(dieta, { ...hoje, tipo: 'calculos' })).toEqual([{ rotulo: '18/11', percentual: null, casos: 2 }]);
  });

  it('fim antes do início: sem pontos', () => {
    expect(serieAproveitamento(com(), periodo('calculos', new Date(2026, 10, 18), new Date(2026, 10, 10)))).toEqual([]);
  });
});

describe('período escolhido por datas', () => {
  const dia = (ano: number, mes: number, d: number, hora = 0) => new Date(ano, mes - 1, d, hora);

  it('início igual ao fim vale (1 dia); início depois do fim é recusado', () => {
    expect(validarPeriodo(dia(2026, 11, 18), dia(2026, 11, 18))).toBeNull();
    expect(validarPeriodo(dia(2026, 11, 18, 23), dia(2026, 11, 18, 1))).toBeNull(); // só o dia conta, não a hora
    expect(validarPeriodo(dia(2026, 11, 19), dia(2026, 11, 18))).toBe(MENSAGEM_PERIODO_INVERTIDO);
  });

  it('no máximo 1 ano: até o mesmo dia do ano seguinte vale, o dia depois é recusado', () => {
    expect(validarPeriodo(dia(2026, 11, 18), dia(2027, 11, 18))).toBeNull();
    expect(validarPeriodo(dia(2026, 11, 18), dia(2027, 11, 19))).toBe(MENSAGEM_PERIODO_LONGO);
    expect(validarPeriodo(dia(2027, 1, 1), dia(2028, 1, 1))).toBeNull();
    expect(validarPeriodo(dia(2024, 2, 29), dia(2025, 3, 1))).toBeNull(); // 29/02 + 1 ano cai em 01/03
    expect(validarPeriodo(dia(2024, 2, 29), dia(2025, 3, 2))).toBe(MENSAGEM_PERIODO_LONGO);
  });

  it('periodoEntreDatas vai do começo do primeiro dia ao último instante do segundo', () => {
    expect(periodoEntreDatas(dia(2026, 11, 10, 15), dia(2026, 11, 12, 8))).toEqual({
      inicio: new Date(2026, 10, 10, 0, 0, 0, 0),
      fim: new Date(2026, 10, 12, 23, 59, 59, 999),
    });
  });
});

describe('unidadeDaSerie', () => {
  it('até 14 dias o eixo é por dia; com 15 ou mais, por semana', () => {
    const doze = (dias: number): FiltroKpis => ({ tipo: 'calculos', ...ultimosDias(dias, new Date(2026, 10, 30)) });

    expect(unidadeDaSerie(doze(1))).toBe('Dias');
    expect(unidadeDaSerie(doze(14))).toBe('Dias');
    expect(unidadeDaSerie(doze(15))).toBe('Semanas');
    expect(unidadeDaSerie(doze(30))).toBe('Semanas');
  });
});
