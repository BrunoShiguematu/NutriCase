// Cálculo dos KPIs do dashboard (requisito 6): função pura, sem Angular e sem estado.
// Só as tentativas submetidas dentro do período contam (recorte por `submetidaEm`): a classificação só existe
// depois da submissão (RF09). Os valores vêm das mesmas respostas e do mesmo `resumoErros` da tela de resultado.

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

/** 'calculos': as 5 etapas de cálculo. 'dieta': a dieta de cada tentativa, dentro ou fora das metas. */
export type TipoKpi = 'calculos' | 'dieta';

/** Tipo de KPI e período; `inicio` e `fim` valem os dois (o limite de cada ponta entra). */
export interface FiltroKpis {
  tipo: TipoKpi;
  inicio: Date;
  fim: Date;
}

/** Os 4 tipos de erro das etapas de cálculo; "dieta fora das metas" é do tipo 'dieta'. */
export const TIPOS_ERRO_CALCULO: readonly TipoErro[] = TIPOS_ERRO.filter((t) => t !== 'dieta fora das metas');

/** Quantas tentativas foram submetidas no período e em quantos casos diferentes. */
export interface CasosResolvidos {
  tentativas: number;
  casosDistintos: number;
}

export interface ErrosDoTipo {
  tipo: TipoErro;
  quantidade: number;
}

/** Erros pelos tipos do filtro: os 4 de cálculo (mesmo com 0) ou só "dieta fora das metas". */
export interface ErrosPorTipo {
  tipos: ErrosDoTipo[];
  total: number;
}

/**
 * Os números do dashboard. Os campos que podem faltar ficam `null` quando não há o que medir no período
 * (a tela mostra "—", não 0). `aceitaveis` é sempre `null` no tipo 'dieta': a dieta ou está dentro das metas ou não.
 */
export interface Kpis {
  casosResolvidos: CasosResolvidos;
  /** Inteiro de 0 a 100. Cálculos: (corretas + aceitáveis) / total de etapas. Dieta: tentativas com a dieta dentro das metas / tentativas. */
  aproveitamento: number | null;
  /** Cálculos: etapas corretas. Dieta: tentativas com a dieta dentro das metas. */
  corretas: number | null;
  /** Cálculos: etapas avaliadas. Dieta: tentativas. */
  total: number | null;
  /** Etapas aceitáveis (classificação interna 'divergente'); só nos cálculos. */
  aceitaveis: number | null;
  /** Cálculos: etapas com erro de fato. Dieta: tentativas com a dieta fora das metas. */
  errosDeFato: number | null;
  errosPorTipo: ErrosPorTipo;
}

type KpisDoTipo = Omit<Kpis, 'casosResolvidos'>;

/** Os últimos `dias` dias, contando o de `agora`: do começo do primeiro dia ao fim do de `agora` (horário local). */
export function ultimosDias(dias: number, agora = new Date()): Pick<FiltroKpis, 'inicio' | 'fim'> {
  return {
    inicio: new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - (dias - 1)),
    fim: new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999),
  };
}

export function calcularKpis({ resolucoes, respostas, resumosErros }: EntradaKpis, filtro: FiltroKpis): Kpis {
  const inicio = filtro.inicio.getTime();
  const fim = filtro.fim.getTime();
  const submetidas = resolucoes.filter((r) => {
    const quando = Date.parse(r.submetidaEm ?? '');
    return r.status === 'submetida' && quando >= inicio && quando <= fim;
  });

  return {
    casosResolvidos: { tentativas: submetidas.length, casosDistintos: new Set(submetidas.map((r) => r.casoId)).size },
    ...(filtro.tipo === 'dieta'
      ? kpisDaDieta(submetidas, resumosErros)
      : kpisDosCalculos(submetidas, respostas, resumosErros)),
  };
}

function kpisDosCalculos(submetidas: readonly Resolucao[], respostas: readonly RespostaEtapa[], resumos: ReadonlyMap<string, ResumoErros>): KpisDoTipo {
  const errosPorTipo = somarErros(TIPOS_ERRO_CALCULO, submetidas.map((r) => resumos.get(r.id)));
  const ids = new Set(submetidas.map((r) => r.id));
  // Resposta sem classificação não foi avaliada; fica de fora, como na contagem da tela de resultado.
  const avaliadas = respostas.filter((r) => ids.has(r.resolucaoId) && r.classificacao !== undefined);
  if (avaliadas.length === 0) {
    return { aproveitamento: null, corretas: null, total: null, aceitaveis: null, errosDeFato: null, errosPorTipo };
  }
  const contar = (classificacao: RespostaEtapa['classificacao']) => avaliadas.filter((r) => r.classificacao === classificacao).length;
  const corretas = contar('correta');
  const aceitaveis = contar('divergente');
  const total = avaliadas.length;
  return {
    aproveitamento: Math.round(((corretas + aceitaveis) * 100) / total),
    corretas,
    total,
    aceitaveis,
    errosDeFato: contar('erro de fato'),
    errosPorTipo,
  };
}

function kpisDaDieta(submetidas: readonly Resolucao[], resumos: ReadonlyMap<string, ResumoErros>): KpisDoTipo {
  // Sem resumo (dado inconsistente) não dá para saber se a dieta ficou dentro das metas: a tentativa fica de fora.
  const comResumo = submetidas.map((r) => resumos.get(r.id)).filter((resumo): resumo is ResumoErros => resumo !== undefined);
  const fora = comResumo.filter((resumo) => resumo['dieta fora das metas'] > 0).length;
  const errosPorTipo: ErrosPorTipo = { tipos: [{ tipo: 'dieta fora das metas', quantidade: fora }], total: fora };
  const total = comResumo.length;
  if (total === 0) {
    return { aproveitamento: null, corretas: null, total: null, aceitaveis: null, errosDeFato: null, errosPorTipo };
  }
  const dentro = total - fora;
  return { aproveitamento: Math.round((dentro * 100) / total), corretas: dentro, total, aceitaveis: null, errosDeFato: fora, errosPorTipo };
}

function somarErros(tiposDoFiltro: readonly TipoErro[], resumos: readonly (ResumoErros | undefined)[]): ErrosPorTipo {
  const tipos = tiposDoFiltro.map((tipo) => ({
    tipo,
    quantidade: resumos.reduce((soma, resumo) => soma + (resumo?.[tipo] ?? 0), 0),
  }));
  return { tipos, total: tipos.reduce((soma, t) => soma + t.quantidade, 0) };
}
