// Cálculo dos KPIs do dashboard (requisito 6): função pura, sem Angular e sem estado.
// Só as tentativas submetidas contam: a classificação só existe depois da submissão (RF09).
// Os valores vêm das mesmas respostas e do mesmo `resumoErros` da tela de resultado, então os dois batem.

import { Resolucao, RespostaEtapa, ResumoErros, TIPOS_ERRO, TipoErro } from '../models';

/** O que o cálculo recebe; o `KpiService` monta isto a partir do `ResolucaoService`. */
export interface EntradaKpis {
  /** Todas as tentativas; as em andamento são ignoradas. */
  resolucoes: readonly Resolucao[];
  /** Respostas de qualquer tentativa; só as das submetidas contam. */
  respostas: readonly RespostaEtapa[];
  /** O resumo de erros de cada tentativa submetida, pelo id da tentativa. */
  resumosErros: ReadonlyMap<string, ResumoErros>;
}

/** KPI 1: quantas tentativas foram submetidas e em quantos casos diferentes. */
export interface CasosConcluidos {
  tentativas: number;
  casosDistintos: number;
}

/** KPI 2: etapas corretas ou divergentes sobre o total de etapas avaliadas. */
export interface Aproveitamento {
  corretas: number;
  divergentes: number;
  /** Corretas + divergentes + com erro. */
  total: number;
  /** Inteiro de 0 a 100: (corretas + divergentes) / total, arredondado. */
  percentual: number;
}

export interface ErrosDoTipo {
  tipo: TipoErro;
  quantidade: number;
}

/** KPI 3: erros pelos 5 tipos da RF34. */
export interface ErrosPorTipo {
  /** Sempre os 5 tipos, na ordem de `TIPOS_ERRO`, mesmo com 0. */
  tipos: ErrosDoTipo[];
  total: number;
}

export interface Kpis {
  casosConcluidos: CasosConcluidos;
  /** `null` quando nenhuma tentativa submetida tem resposta avaliada (evita mostrar 0%). */
  aproveitamento: Aproveitamento | null;
  errosPorTipo: ErrosPorTipo;
}

export function calcularKpis({ resolucoes, respostas, resumosErros }: EntradaKpis): Kpis {
  const submetidas = resolucoes.filter((r) => r.status === 'submetida');
  const ids = new Set(submetidas.map((r) => r.id));

  return {
    casosConcluidos: {
      tentativas: submetidas.length,
      casosDistintos: new Set(submetidas.map((r) => r.casoId)).size,
    },
    aproveitamento: calcularAproveitamento(respostas.filter((r) => ids.has(r.resolucaoId))),
    errosPorTipo: somarErros(submetidas.map((r) => resumosErros.get(r.id))),
  };
}

function calcularAproveitamento(respostas: readonly RespostaEtapa[]): Aproveitamento | null {
  // Resposta sem classificação não foi avaliada; fica de fora, como na contagem da tela de resultado.
  const avaliadas = respostas.filter((r) => r.classificacao !== undefined);
  if (avaliadas.length === 0) {
    return null;
  }
  const corretas = avaliadas.filter((r) => r.classificacao === 'correta').length;
  const divergentes = avaliadas.filter((r) => r.classificacao === 'divergente').length;
  const total = avaliadas.length;
  return { corretas, divergentes, total, percentual: Math.round(((corretas + divergentes) * 100) / total) };
}

function somarErros(resumos: readonly (ResumoErros | undefined)[]): ErrosPorTipo {
  const tipos = TIPOS_ERRO.map((tipo) => ({
    tipo,
    quantidade: resumos.reduce((soma, resumo) => soma + (resumo?.[tipo] ?? 0), 0),
  }));
  return { tipos, total: tipos.reduce((soma, t) => soma + t.quantidade, 0) };
}
