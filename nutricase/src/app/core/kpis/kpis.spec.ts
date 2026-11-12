import { Classificacao, Resolucao, RespostaEtapa, ResumoErros, TIPOS_ERRO, TipoErro } from '../models';
import { calcularKpis, EntradaKpis } from './kpis';

let contador = 0;

function resolucao(casoId: string, status: Resolucao['status'] = 'submetida'): Resolucao {
  contador += 1;
  return {
    id: `r${contador}`,
    casoId,
    data: '2026-11-10T14:30:00.000Z',
    status,
    justificativa: '',
    ...(status === 'submetida' ? { submetidaEm: '2026-11-10T15:00:00.000Z' } : {}),
  };
}

function resposta(r: Resolucao, classificacao: Classificacao | undefined, tipoErro?: TipoErro): RespostaEtapa {
  contador += 1;
  return { id: `x${contador}`, resolucaoId: r.id, etapaId: `e${contador}`, parametro: 1, valor: 1, classificacao, tipoErro };
}

/** Cinco respostas com as classificações dadas, na ordem. */
function respostas(r: Resolucao, ...classificacoes: (Classificacao | undefined)[]): RespostaEtapa[] {
  return classificacoes.map((c) => resposta(r, c));
}

function resumo(parcial: Partial<ResumoErros> = {}): ResumoErros {
  return Object.fromEntries(TIPOS_ERRO.map((t) => [t, parcial[t] ?? 0])) as ResumoErros;
}

function entrada(parcial: Partial<EntradaKpis> = {}): EntradaKpis {
  return { resolucoes: [], respostas: [], resumosErros: new Map(), ...parcial };
}

describe('calcularKpis', () => {
  describe('lista vazia', () => {
    it('não tem casos concluídos, não tem aproveitamento e zera os 5 tipos', () => {
      const kpis = calcularKpis(entrada());

      expect(kpis.casosConcluidos).toEqual({ tentativas: 0, casosDistintos: 0 });
      expect(kpis.aproveitamento).toBeNull();
      expect(kpis.errosPorTipo.total).toBe(0);
      expect(kpis.errosPorTipo.tipos.map((t) => t.quantidade)).toEqual([0, 0, 0, 0, 0]);
    });

    it('devolve os 5 tipos na ordem de TIPOS_ERRO', () => {
      const { tipos } = calcularKpis(entrada()).errosPorTipo;

      expect(tipos.map((t) => t.tipo)).toEqual([...TIPOS_ERRO]);
      expect(tipos.map((t) => t.tipo)).toEqual([
        'conversão de unidade',
        'escolha de equação',
        'aritmética',
        'meta fora de faixa',
        'dieta fora das metas',
      ]);
    });
  });

  describe('só tentativas em andamento', () => {
    it('não contam em nenhum KPI, mesmo com respostas e resumo', () => {
      const andamento = resolucao('caso-1', 'em andamento');
      const kpis = calcularKpis(
        entrada({
          resolucoes: [andamento, resolucao('caso-2', 'em andamento')],
          respostas: respostas(andamento, 'correta', 'correta', 'erro de fato', undefined, undefined),
          resumosErros: new Map([[andamento.id, resumo({ aritmética: 3 })]]),
        }),
      );

      expect(kpis.casosConcluidos).toEqual({ tentativas: 0, casosDistintos: 0 });
      expect(kpis.aproveitamento).toBeNull();
      expect(kpis.errosPorTipo.total).toBe(0);
    });

    it('uma em andamento junto de uma submetida: só a submetida conta', () => {
      const submetida = resolucao('caso-1');
      const andamento = resolucao('caso-2', 'em andamento');
      const kpis = calcularKpis(
        entrada({
          resolucoes: [andamento, submetida],
          respostas: [...respostas(submetida, 'correta', 'correta', 'correta', 'correta', 'correta'), ...respostas(andamento, 'erro de fato')],
          resumosErros: new Map([
            [submetida.id, resumo()],
            [andamento.id, resumo({ 'meta fora de faixa': 4 })],
          ]),
        }),
      );

      expect(kpis.casosConcluidos).toEqual({ tentativas: 1, casosDistintos: 1 });
      expect(kpis.aproveitamento).toEqual({ corretas: 5, divergentes: 0, total: 5, percentual: 100 });
      expect(kpis.errosPorTipo.total).toBe(0);
    });
  });

  describe('erro de cada tipo', () => {
    it('soma uma submetida com um erro de cada um dos 5 tipos', () => {
      const r = resolucao('caso-1');
      const tudo = Object.fromEntries(TIPOS_ERRO.map((t) => [t, 1])) as ResumoErros;

      const { errosPorTipo } = calcularKpis(entrada({ resolucoes: [r], resumosErros: new Map([[r.id, tudo]]) }));

      expect(errosPorTipo.total).toBe(5);
      for (const tipo of TIPOS_ERRO) {
        expect(errosPorTipo.tipos.find((t) => t.tipo === tipo)?.quantidade, tipo).toBe(1);
      }
    });

    it.each([...TIPOS_ERRO])('erro só de "%s": os outros 4 ficam em 0', (tipo) => {
      const r = resolucao('caso-1');

      const { errosPorTipo } = calcularKpis(entrada({ resolucoes: [r], resumosErros: new Map([[r.id, resumo({ [tipo]: 2 })]]) }));

      expect(errosPorTipo.total).toBe(2);
      expect(errosPorTipo.tipos.map((t) => [t.tipo, t.quantidade])).toEqual(TIPOS_ERRO.map((t) => [t, t === tipo ? 2 : 0]));
    });

    it('soma os erros de várias tentativas, tipo a tipo', () => {
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
      );

      expect(errosPorTipo.tipos.map((t) => t.quantidade)).toEqual([1, 0, 3, 0, 1]);
      expect(errosPorTipo.total).toBe(5);
    });

    it('submetida sem resumo (dado inconsistente): não quebra e conta como 0', () => {
      const r = resolucao('caso-1');

      const { errosPorTipo } = calcularKpis(entrada({ resolucoes: [r] }));

      expect(errosPorTipo.total).toBe(0);
    });
  });

  describe('várias tentativas do mesmo caso', () => {
    it('conta todas as tentativas, mas o caso uma vez só', () => {
      const resolucoes = [resolucao('caso-1'), resolucao('caso-1'), resolucao('caso-1'), resolucao('caso-2')];

      const { casosConcluidos } = calcularKpis(entrada({ resolucoes }));

      expect(casosConcluidos).toEqual({ tentativas: 4, casosDistintos: 2 });
    });

    it('uma refeita em andamento não aumenta nada', () => {
      const resolucoes = [resolucao('caso-1'), resolucao('caso-1', 'em andamento')];

      expect(calcularKpis(entrada({ resolucoes })).casosConcluidos).toEqual({ tentativas: 1, casosDistintos: 1 });
    });

    it('as respostas das duas tentativas entram no aproveitamento', () => {
      const primeira = resolucao('caso-1');
      const segunda = resolucao('caso-1');

      const { aproveitamento } = calcularKpis(
        entrada({
          resolucoes: [primeira, segunda],
          respostas: [
            ...respostas(primeira, 'erro de fato', 'erro de fato', 'erro de fato', 'correta', 'divergente'),
            ...respostas(segunda, 'correta', 'correta', 'correta', 'correta', 'correta'),
          ],
        }),
      );

      expect(aproveitamento).toEqual({ corretas: 6, divergentes: 1, total: 10, percentual: 70 });
    });
  });

  describe('aproveitamento', () => {
    it('conta corretas e divergentes como aproveitadas, e o erro de fato não', () => {
      const r = resolucao('caso-1');

      const { aproveitamento } = calcularKpis(
        entrada({ resolucoes: [r], respostas: respostas(r, 'correta', 'divergente', 'erro de fato', 'correta', 'erro de fato') }),
      );

      expect(aproveitamento).toEqual({ corretas: 2, divergentes: 1, total: 5, percentual: 60 });
    });

    it('todas com erro: 0%, não null', () => {
      const r = resolucao('caso-1');

      const { aproveitamento } = calcularKpis(entrada({ resolucoes: [r], respostas: respostas(r, 'erro de fato', 'erro de fato') }));

      expect(aproveitamento).toEqual({ corretas: 0, divergentes: 0, total: 2, percentual: 0 });
    });

    it('submetida sem nenhuma resposta: null', () => {
      expect(calcularKpis(entrada({ resolucoes: [resolucao('caso-1')] })).aproveitamento).toBeNull();
    });

    it('ignora respostas sem classificação', () => {
      const r = resolucao('caso-1');

      const { aproveitamento } = calcularKpis(entrada({ resolucoes: [r], respostas: respostas(r, 'correta', undefined, undefined) }));

      expect(aproveitamento).toEqual({ corretas: 1, divergentes: 0, total: 1, percentual: 100 });
    });

    it('ignora respostas de uma tentativa que não está na lista', () => {
      const r = resolucao('caso-1');
      const solta = resolucao('caso-9');

      const { aproveitamento } = calcularKpis(
        entrada({ resolucoes: [r], respostas: [...respostas(r, 'correta'), ...respostas(solta, 'erro de fato')] }),
      );

      expect(aproveitamento?.total).toBe(1);
    });

    describe('arredondamento do percentual', () => {
      // n corretas e o resto com erro, em uma tentativa.
      function percentual(corretas: number, total: number): number | undefined {
        const r = resolucao('caso-1');
        const classificacoes: Classificacao[] = Array.from({ length: total }, (_, i) => (i < corretas ? 'correta' : 'erro de fato'));
        return calcularKpis(entrada({ resolucoes: [r], respostas: respostas(r, ...classificacoes) })).aproveitamento?.percentual;
      }

      it.each([
        [1, 3, 33], // 33,33… para baixo
        [2, 3, 67], // 66,66… para cima
        [1, 8, 13], // 12,5 sobe
        [3, 8, 38], // 37,5 sobe
        [1, 6, 17], // 16,66…
        [4, 5, 80],
        [5, 5, 100],
        [0, 5, 0],
        [1, 200, 1], // 0,5 sobe
        [1, 201, 0], // 0,497… desce
      ])('%i de %i etapas: %i%', (corretas, total, esperado) => {
        expect(percentual(corretas, total)).toBe(esperado);
      });
    });
  });

  it('não altera os dados recebidos', () => {
    const r = resolucao('caso-1');
    const entradaOriginal = entrada({
      resolucoes: [r],
      respostas: respostas(r, 'correta', 'erro de fato'),
      resumosErros: new Map([[r.id, resumo({ aritmética: 1 })]]),
    });
    const copia = structuredClone({ ...entradaOriginal, resumosErros: [...entradaOriginal.resumosErros] });

    calcularKpis(entradaOriginal);

    expect({ ...entradaOriginal, resumosErros: [...entradaOriginal.resumosErros] }).toEqual(copia);
  });
});
