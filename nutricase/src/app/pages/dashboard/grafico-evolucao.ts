import { PontoDaSerie } from '../../core/kpis/kpis';

/** O que o eixo Y mede: o aproveitamento em % ou o número de casos (tentativas submetidas) de cada ponto. */
export type ModoGrafico = 'percentual' | 'casos';

export interface PontoGrafico {
  rotulo: string;
  x: number;
  /** `null` quando o ponto não tem dado: não se desenha nem se liga à linha. */
  y: number | null;
  /** O valor escrito sobre o ponto ("78%" ou "3"); `null` junto com `y`. */
  texto: string | null;
  /** O rótulo do eixo X só aparece de tantos em tantos pontos quando há muitos, sempre com o primeiro e o último. */
  mostrarRotulo: boolean;
  /** O valor sobre o ponto some quando há pontos demais para ler (o `descricao` continua com todos). */
  mostrarValor: boolean;
}

export interface MarcaDoEixo {
  rotulo: string;
  y: number;
}

/** Tudo o que o SVG precisa, em coordenadas do `viewBox`: o template só desenha. */
export interface Grafico {
  largura: number;
  altura: number;
  esquerda: number;
  direita: number;
  topo: number;
  base: number;
  marcasY: MarcaDoEixo[];
  pontos: PontoGrafico[];
  /** Um `d` de path por trecho contínuo de 2 ou mais pontos com dado; um buraco corta a linha. */
  trechos: string[];
  /**
   * O `aria-label` do SVG, com tudo o que o desenho mostra: "Evolução do aproveitamento, em %, por dias. 04/11: 80%;
   * 05/11: sem dados; …" (ou "em número de casos" e "2 casos").
   */
  descricao: string;
}

const LARGURA = 640;
const ALTURA = 280;
const MARGEM = { esquerda: 56, direita: 24, topo: 32, base: 64 };
/** Folga entre as pontas do eixo X e o primeiro e o último ponto, para o texto não encostar na borda. */
const FOLGA_X = 32;

/** Quantos rótulos do eixo X cabem de forma legível, por unidade; e a partir de quantos pontos o valor sobre o ponto some. */
const ROTULOS_POR_UNIDADE = { Dias: 14, Semanas: 5 } as const; // o rótulo de semana é longo ("19/11 – 25/11"): 6 já se encostam
const MAXIMO_DE_PONTOS_COM_VALOR = 20;

/**
 * Quais pontos levam rótulo no eixo X: de `k` em `k` (k = n / quantos cabem, para cima), sempre o primeiro e o último.
 * Se o último cai colado no anterior, ele toma o lugar dele (o primeiro nunca sai).
 */
export function indicesComRotulo(total: number, unidade: 'Dias' | 'Semanas'): Set<number> {
  if (total === 0) {
    return new Set();
  }
  const passo = Math.max(1, Math.ceil(total / ROTULOS_POR_UNIDADE[unidade]));
  const indices = Array.from({ length: Math.ceil(total / passo) }, (_, i) => i * passo);
  const ultimo = total - 1;
  const anterior = indices.at(-1)!;
  if (ultimo > anterior) {
    if (ultimo - anterior < passo && anterior !== 0) {
      indices.pop();
    }
    indices.push(ultimo);
  }
  return new Set(indices);
}

/** 0 até o máximo, arredondado para cima para um número par (a marca do meio fica inteira): 7 vira 8, 1 vira 2. */
export function maximoArredondado(maximo: number): number {
  return Math.max(2, Math.ceil(maximo / 2) * 2);
}

export function montarGrafico(serie: readonly PontoDaSerie[], modo: ModoGrafico, unidade: 'Dias' | 'Semanas'): Grafico {
  const valorDe = (p: PontoDaSerie): number | null => (modo === 'percentual' ? p.percentual : p.casos);
  const teto = modo === 'percentual' ? 100 : maximoArredondado(Math.max(0, ...serie.map((p) => p.casos)));
  const formatar = (v: number): string => (modo === 'percentual' ? `${v}%` : String(v));

  const esquerda = MARGEM.esquerda;
  const direita = LARGURA - MARGEM.direita;
  const topo = MARGEM.topo;
  const base = ALTURA - MARGEM.base;
  const yDe = (valor: number): number => base - ((base - topo) * valor) / teto;
  const xDe = (i: number): number =>
    serie.length === 1 ? (esquerda + direita) / 2 : esquerda + FOLGA_X + (i * (direita - esquerda - 2 * FOLGA_X)) / (serie.length - 1);

  const comRotulo = indicesComRotulo(serie.length, unidade);
  const pontos = serie.map((p, i): PontoGrafico => {
    const valor = valorDe(p);
    return {
      rotulo: p.rotulo,
      x: xDe(i),
      y: valor === null ? null : yDe(valor),
      texto: valor === null ? null : formatar(valor),
      mostrarRotulo: comRotulo.has(i),
      mostrarValor: serie.length <= MAXIMO_DE_PONTOS_COM_VALOR,
    };
  });
  const dito = (p: PontoDaSerie): string => {
    const valor = valorDe(p);
    if (valor === null) {
      return 'sem dados';
    }
    return modo === 'percentual' ? `${valor}%` : `${valor} ${valor === 1 ? 'caso' : 'casos'}`;
  };

  const trechos: string[] = [];
  let atual: PontoGrafico[] = [];
  const fechar = (): void => {
    if (atual.length >= 2) {
      trechos.push(atual.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' '));
    }
    atual = [];
  };
  for (const ponto of pontos) {
    if (ponto.y === null) {
      fechar();
    } else {
      atual.push(ponto);
    }
  }
  fechar();

  return {
    largura: LARGURA,
    altura: ALTURA,
    esquerda,
    direita,
    topo,
    base,
    marcasY: [0, teto / 2, teto].map((v) => ({ rotulo: formatar(v), y: yDe(v) })),
    pontos,
    trechos,
    descricao:
      `Evolução do aproveitamento, ${modo === 'percentual' ? 'em %' : 'em número de casos'}, por ${unidade.toLowerCase()}. ` +
      serie.map((p) => `${p.rotulo}: ${dito(p)}`).join('; '),
  };
}
