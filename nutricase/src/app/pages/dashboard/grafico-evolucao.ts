import { PontoDaSerie } from '../../core/kpis/kpis';

export type ModoGrafico = 'percentual' | 'casos';

export interface PontoGrafico {
  rotulo: string;
  x: number;
  y: number | null;
  texto: string | null;
  mostrarRotulo: boolean;
  mostrarValor: boolean;
}

export interface MarcaDoEixo {
  rotulo: string;
  y: number;
}

export interface Grafico {
  largura: number;
  altura: number;
  esquerda: number;
  direita: number;
  topo: number;
  base: number;
  marcasY: MarcaDoEixo[];
  pontos: PontoGrafico[];
  trechos: string[];
  descricao: string;
}

const LARGURA = 640;
const ALTURA = 280;
const MARGEM = { esquerda: 56, direita: 24, topo: 32, base: 64 };
const FOLGA_X = 32;

const ROTULOS_POR_UNIDADE = { Dias: 14, Semanas: 5 } as const;
const MAXIMO_DE_PONTOS_COM_VALOR = 20;

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
