import { PontoDaSerie } from '../../core/kpis/kpis';
import { indicesComRotulo, maximoArredondado, montarGrafico } from './grafico-evolucao';

const ponto = (rotulo: string, percentual: number | null, casos = 0): PontoDaSerie => ({ rotulo, percentual, casos });

describe('maximoArredondado', () => {
  it.each([
    [0, 2],
    [1, 2],
    [2, 2],
    [3, 4],
    [7, 8],
    [8, 8],
    [13, 14],
  ])('máximo %i vira %i (par, no mínimo 2)', (maximo, esperado) => {
    expect(maximoArredondado(maximo)).toBe(esperado);
  });
});

describe('montarGrafico', () => {
  it('modo %: marcas 0%, 50% e 100%, com 100% no topo e 0% na base', () => {
    const g = montarGrafico([ponto('a', 50), ponto('b', 100)], 'percentual', 'Dias');

    expect(g.marcasY.map((m) => m.rotulo)).toEqual(['0%', '50%', '100%']);
    expect(g.marcasY[0].y).toBe(g.base);
    expect(g.marcasY[2].y).toBe(g.topo);
    expect(g.marcasY[1].y).toBe((g.base + g.topo) / 2);
    expect(g.pontos.map((p) => p.texto)).toEqual(['50%', '100%']);
    expect(g.pontos[1].y).toBe(g.topo);
  });

  it('modo Nº de casos: de 0 ao máximo arredondado, e o valor escrito é o número', () => {
    const g = montarGrafico([ponto('a', 80, 3), ponto('b', null, 7), ponto('c', 0, 0)], 'casos', 'Dias');

    expect(g.marcasY.map((m) => m.rotulo)).toEqual(['0', '4', '8']);
    expect(g.pontos.map((p) => p.texto)).toEqual(['3', '7', '0']);
    expect(g.pontos[2].y).toBe(g.base); // 0 casos é um valor: fica na base, com ponto
    expect(g.trechos).toHaveLength(1); // no modo Nº todos têm valor: uma linha só
  });

  it('ponto sem dado (percentual null) não desenha e corta a linha', () => {
    const g = montarGrafico([ponto('a', 80), ponto('b', null), ponto('c', 60), ponto('d', 70), ponto('e', null)], 'percentual', 'Dias');

    expect(g.pontos.map((p) => p.y !== null)).toEqual([true, false, true, true, false]);
    expect(g.pontos[1].texto).toBeNull();
    expect(g.trechos).toHaveLength(1); // só c-d; o 'a' é um ponto solto, sem linha
    expect(g.trechos[0]).toBe(`M${g.pontos[2].x} ${g.pontos[2].y} L${g.pontos[3].x} ${g.pontos[3].y}`);
  });

  it('sem nenhum dado: sem pontos desenhados nem linha, mas o eixo e os rótulos continuam', () => {
    const g = montarGrafico([ponto('a', null), ponto('b', null)], 'percentual', 'Dias');

    expect(g.trechos).toEqual([]);
    expect(g.pontos.every((p) => p.y === null)).toBe(true);
    expect(g.pontos.map((p) => p.rotulo)).toEqual(['a', 'b']);
  });

  it('os pontos ficam em ordem, dentro da área e com a mesma distância; um ponto só vai para o meio', () => {
    const g = montarGrafico([ponto('a', 10), ponto('b', 20), ponto('c', 30), ponto('d', 40)], 'percentual', 'Dias');
    const xs = g.pontos.map((p) => p.x);

    expect(xs[0]).toBeGreaterThan(g.esquerda);
    expect(xs[3]).toBeLessThan(g.direita);
    expect(xs[1] - xs[0]).toBeCloseTo(xs[2] - xs[1]);
    expect(montarGrafico([ponto('hoje', 50)], 'percentual', 'Dias').pontos[0].x).toBe((g.esquerda + g.direita) / 2);
  });

  it('a descrição para leitor de tela diz o modo e a unidade, com rótulo e valor de cada ponto e "sem dados" onde falta', () => {
    expect(montarGrafico([ponto('12/11', 80), ponto('13/11', null)], 'percentual', 'Dias').descricao).toBe(
      'Evolução do aproveitamento, em %, por dias. 12/11: 80%; 13/11: sem dados',
    );
    expect(montarGrafico([ponto('14/11', 80, 2), ponto('15/11', null, 1), ponto('16/11', null, 0)], 'casos', 'Dias').descricao).toBe(
      'Evolução do aproveitamento, em número de casos, por dias. 14/11: 2 casos; 15/11: 1 caso; 16/11: 0 casos',
    );
    expect(montarGrafico([ponto('a', 50)], 'percentual', 'Semanas').descricao).toMatch(/, por semanas\. /);
  });
});

describe('rótulos do eixo X em períodos longos', () => {
  const semanas = (n: number): PontoDaSerie[] => Array.from({ length: n }, (_, i) => ponto(`S${i + 1}`, i % 2 ? null : 50, 1));
  const visiveis = (n: number, unidade: 'Dias' | 'Semanas') => [...indicesComRotulo(n, unidade)];

  it('até o que cabe, todos os rótulos aparecem: 14 dias e 5 semanas', () => {
    expect(visiveis(14, 'Dias')).toHaveLength(14);
    expect(visiveis(5, 'Semanas')).toHaveLength(5);
    expect(visiveis(1, 'Dias')).toEqual([0]);
    expect(visiveis(0, 'Dias')).toEqual([]);
  });

  it('com 53 semanas (1 ano): de k em k, com o primeiro e o último, e nunca dois colados', () => {
    const indices = visiveis(53, 'Semanas');

    expect(indices[0]).toBe(0);
    expect(indices.at(-1)).toBe(52);
    expect(indices).toEqual([0, 11, 22, 33, 52]); // passo 11; o 44 sai porque o 52 (o último) ficaria a 8 dele
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i] - indices[i - 1], `${indices[i - 1]} e ${indices[i]}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('o último que cairia colado no anterior toma o lugar dele, e o primeiro nunca sai', () => {
    expect(visiveis(8, 'Semanas')).toEqual([0, 2, 4, 7]); // passo 2: o 6 sai e entra o 7
    expect(visiveis(7, 'Semanas')).toEqual([0, 2, 4, 6]);
    expect(visiveis(2, 'Semanas')).toEqual([0, 1]);
  });

  it('montarGrafico com 53 pontos: rótulos só nos escolhidos, valores escondidos, e a descrição ainda tem os 53', () => {
    const g = montarGrafico(semanas(53), 'percentual', 'Semanas');

    expect(g.pontos.filter((p) => p.mostrarRotulo).map((p) => p.rotulo)).toEqual(visiveis(53, 'Semanas').map((i) => `S${i + 1}`));
    expect(g.pontos.some((p) => p.mostrarValor)).toBe(false);
    expect(g.descricao.split('; ')).toHaveLength(53);
    expect(g.pontos[0].texto).toBe('50%'); // o texto existe; só não é desenhado
  });

  it('com até 20 pontos o valor aparece; com 21, não', () => {
    expect(montarGrafico(semanas(20), 'percentual', 'Semanas').pontos.every((p) => p.mostrarValor)).toBe(true);
    expect(montarGrafico(semanas(21), 'percentual', 'Semanas').pontos.some((p) => p.mostrarValor)).toBe(false);
  });
});
