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

// ---------- Ofensiva, nível, conquistas e série do gráfico ----------
// Todas puras e por data LOCAL (o dia que a pessoa vê), sem olhar o filtro do dashboard: ofensiva, nível e
// conquistas são hábito e progresso acumulado; só a série do gráfico respeita o tipo e o período.

/** Número inteiro do dia local (sem hora), para contar dias seguidos sem erro de horário de verão. */
const indiceDoDia = (d: Date): number => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;

const somarDias = (d: Date, dias: number): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias);
const fimDoDia = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const diaEMes = (d: Date): string => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

const submetidasComData = (resolucoes: readonly Resolucao[]): Resolucao[] =>
  resolucoes.filter((r) => r.status === 'submetida' && !Number.isNaN(Date.parse(r.submetidaEm ?? '')));

/** Os dias locais (como `indiceDoDia`) em que houve pelo menos uma submissão. */
const diasComSubmissao = (resolucoes: readonly Resolucao[]): Set<number> =>
  new Set(submetidasComData(resolucoes).map((r) => indiceDoDia(new Date(r.submetidaEm!))));

/** Quantos casos diferentes têm pelo menos uma tentativa submetida. */
export function casosConcluidos(resolucoes: readonly Resolucao[]): number {
  return new Set(resolucoes.filter((r) => r.status === 'submetida').map((r) => r.casoId)).size;
}

/**
 * Dias seguidos com pelo menos uma submissão, de hoje para trás. Se hoje ainda não teve, conta a partir de
 * ontem: a sequência só se quebra quando o dia acaba sem submissão.
 */
export function ofensiva(hoje: Date, resolucoes: readonly Resolucao[]): number {
  const dias = diasComSubmissao(resolucoes);
  let dia = indiceDoDia(hoje);
  if (!dias.has(dia)) {
    dia -= 1;
  }
  let seguidos = 0;
  while (dias.has(dia)) {
    seguidos += 1;
    dia -= 1;
  }
  return seguidos;
}

/** A maior sequência de dias seguidos com submissão que já houve (a conquista da ofensiva fica para sempre). */
export function maiorOfensiva(resolucoes: readonly Resolucao[]): number {
  let maior = 0;
  let atual = 0;
  let anterior: number | undefined;
  for (const dia of [...diasComSubmissao(resolucoes)].sort((a, b) => a - b)) {
    atual = anterior !== undefined && dia === anterior + 1 ? atual + 1 : 1;
    maior = Math.max(maior, atual);
    anterior = dia;
  }
  return maior;
}

export type NomeNivel = 'Bronze' | 'Prata' | 'Ouro';

/** O nível e o caminho até o próximo: `meta` é quantos casos pedem o próximo nível (`null` no último). */
export interface Nivel {
  nome: NomeNivel;
  proximo: NomeNivel | null;
  casos: number;
  meta: number | null;
  faltam: number;
  /** Inteiro de 0 a 100: casos / meta; 100 no último nível. */
  percentual: number;
}

const NIVEIS: readonly { nome: NomeNivel; apartirDe: number }[] = [
  { nome: 'Bronze', apartirDe: 0 },
  { nome: 'Prata', apartirDe: 3 },
  { nome: 'Ouro', apartirDe: 6 },
];

/** Bronze de 0 a 2 casos distintos, Prata de 3 a 5, Ouro de 6 em diante. */
export function nivel(casosDistintos: number): Nivel {
  const casos = Math.max(0, casosDistintos);
  let posicao = 0;
  NIVEIS.forEach((n, i) => (casos >= n.apartirDe ? (posicao = i) : undefined));
  const proximo = NIVEIS[posicao + 1];
  if (!proximo) {
    return { nome: NIVEIS[posicao].nome, proximo: null, casos, meta: null, faltam: 0, percentual: 100 };
  }
  return {
    nome: NIVEIS[posicao].nome,
    proximo: proximo.nome,
    casos,
    meta: proximo.apartirDe,
    faltam: proximo.apartirDe - casos,
    percentual: Math.round((casos * 100) / proximo.apartirDe),
  };
}

export interface Conquista {
  id: 'primeiro-caso' | 'cinco-casos' | 'ofensiva-3' | 'cem-por-cento';
  titulo: string;
  descricao: string;
  obtida: boolean;
}

/**
 * As 4 conquistas, sempre na mesma ordem. `ofensiva-3` vale se alguma sequência chegou a 3 dias, mesmo que já
 * tenha acabado. `cem-por-cento`: uma tentativa com pelo menos uma etapa avaliada e nenhuma com erro de fato
 * (a dieta não entra).
 */
export function conquistas({ resolucoes, respostas }: Pick<EntradaKpis, 'resolucoes' | 'respostas'>): Conquista[] {
  const casos = casosConcluidos(resolucoes);
  const submetidas = resolucoes.filter((r) => r.status === 'submetida');
  const cemPorCento = submetidas.some((r) => {
    const avaliadas = respostas.filter((x) => x.resolucaoId === r.id && x.classificacao !== undefined);
    return avaliadas.length > 0 && avaliadas.every((x) => x.classificacao !== 'erro de fato');
  });
  return [
    { id: 'primeiro-caso', titulo: 'Primeiro caso', descricao: 'Submeta a primeira resolução.', obtida: casos >= 1 },
    { id: 'cinco-casos', titulo: '5 casos distintos', descricao: 'Resolva 5 casos diferentes.', obtida: casos >= 5 },
    { id: 'ofensiva-3', titulo: 'Ofensiva de 3 dias', descricao: 'Submeta resoluções em 3 dias seguidos.', obtida: maiorOfensiva(resolucoes) >= 3 },
    { id: 'cem-por-cento', titulo: '100% em um caso', descricao: 'Tenha todas as etapas de uma tentativa corretas ou aceitáveis.', obtida: cemPorCento },
  ];
}

/** Um ponto do gráfico: o rótulo do dia ou da semana, o aproveitamento (`null` sem dados) e as tentativas submetidas. */
export interface PontoDaSerie {
  rotulo: string;
  percentual: number | null;
  casos: number;
}

/**
 * O aproveitamento ao longo do período do filtro, no tipo dele: um ponto por dia até 14 dias (e para 1 dia só),
 * um por semana acima disso. A semana é um bloco de 7 dias contado do início do período; o último pode ser menor.
 */
export function serieAproveitamento(entrada: EntradaKpis, filtro: FiltroKpis): PontoDaSerie[] {
  const primeiro = new Date(filtro.inicio.getFullYear(), filtro.inicio.getMonth(), filtro.inicio.getDate());
  const dias = indiceDoDia(filtro.fim) - indiceDoDia(primeiro) + 1;
  const passo = dias <= 14 ? 1 : 7;
  const pontos: PontoDaSerie[] = [];
  for (let i = 0; i < dias; i += passo) {
    const primeiroDia = somarDias(primeiro, i);
    const ultimoDia = somarDias(primeiro, Math.min(i + passo, dias) - 1);
    const kpis = calcularKpis(entrada, {
      tipo: filtro.tipo,
      // A primeira e a última ponta respeitam a hora do filtro; as de dentro vão de 00:00 a 23:59:59.999.
      inicio: i === 0 ? filtro.inicio : primeiroDia,
      fim: i + passo >= dias ? filtro.fim : fimDoDia(ultimoDia),
    });
    pontos.push({
      rotulo: passo === 1 ? diaEMes(primeiroDia) : `${diaEMes(primeiroDia)} – ${diaEMes(ultimoDia)}`,
      percentual: kpis.aproveitamento,
      casos: kpis.casosResolvidos.tentativas,
    });
  }
  return pontos;
}
