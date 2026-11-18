import { Resolucao, RespostaEtapa, ResumoErros, TIPOS_ERRO, TipoErro } from '../models';

export interface EntradaKpis {
  resolucoes: readonly Resolucao[];
  respostas: readonly RespostaEtapa[];
  resumosErros: ReadonlyMap<string, ResumoErros>;
}

export type TipoKpi = 'calculos' | 'dieta';

export interface FiltroKpis {
  tipo: TipoKpi;
  inicio: Date;
  fim: Date;
}

export const TIPOS_ERRO_CALCULO: readonly TipoErro[] = TIPOS_ERRO.filter((t) => t !== 'dieta fora das metas');

export interface CasosResolvidos {
  tentativas: number;
  casosDistintos: number;
}

export interface ErrosDoTipo {
  tipo: TipoErro;
  quantidade: number;
}

export interface ErrosPorTipo {
  tipos: ErrosDoTipo[];
  total: number;
}

export interface Kpis {
  casosResolvidos: CasosResolvidos;
  aproveitamento: number | null;
  corretas: number | null;
  total: number | null;
  aceitaveis: number | null;
  errosDeFato: number | null;
  errosPorTipo: ErrosPorTipo;
}

type KpisDoTipo = Omit<Kpis, 'casosResolvidos'>;

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

const indiceDoDia = (d: Date): number => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;

const somarDias = (d: Date, dias: number): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias);
const fimDoDia = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const diaEMes = (d: Date): string => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

const submetidasComData = (resolucoes: readonly Resolucao[]): Resolucao[] =>
  resolucoes.filter((r) => r.status === 'submetida' && !Number.isNaN(Date.parse(r.submetidaEm ?? '')));

const diasComSubmissao = (resolucoes: readonly Resolucao[]): Set<number> =>
  new Set(submetidasComData(resolucoes).map((r) => indiceDoDia(new Date(r.submetidaEm!))));

export function casosConcluidos(resolucoes: readonly Resolucao[]): number {
  return new Set(resolucoes.filter((r) => r.status === 'submetida').map((r) => r.casoId)).size;
}

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

export interface Nivel {
  nome: NomeNivel;
  proximo: NomeNivel | null;
  casos: number;
  meta: number | null;
  faltam: number;
  percentual: number;
}

const NIVEIS: readonly { nome: NomeNivel; apartirDe: number }[] = [
  { nome: 'Bronze', apartirDe: 0 },
  { nome: 'Prata', apartirDe: 3 },
  { nome: 'Ouro', apartirDe: 6 },
];

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

export interface PontoDaSerie {
  rotulo: string;
  percentual: number | null;
  casos: number;
}

const diasDoPeriodo = (filtro: FiltroKpis): number =>
  indiceDoDia(filtro.fim) - indiceDoDia(new Date(filtro.inicio.getFullYear(), filtro.inicio.getMonth(), filtro.inicio.getDate())) + 1;

export function unidadeDaSerie(filtro: FiltroKpis): 'Dias' | 'Semanas' {
  return diasDoPeriodo(filtro) <= 14 ? 'Dias' : 'Semanas';
}

export function serieAproveitamento(entrada: EntradaKpis, filtro: FiltroKpis): PontoDaSerie[] {
  const primeiro = new Date(filtro.inicio.getFullYear(), filtro.inicio.getMonth(), filtro.inicio.getDate());
  const dias = diasDoPeriodo(filtro);
  const passo = unidadeDaSerie(filtro) === 'Dias' ? 1 : 7;
  const pontos: PontoDaSerie[] = [];
  for (let i = 0; i < dias; i += passo) {
    const primeiroDia = somarDias(primeiro, i);
    const ultimoDia = somarDias(primeiro, Math.min(i + passo, dias) - 1);
    const kpis = calcularKpis(entrada, {
      tipo: filtro.tipo,
      inicio: i === 0 ? filtro.inicio : primeiroDia,
      fim: i + passo >= dias ? filtro.fim : fimDoDia(ultimoDia),
    });
    pontos.push({
      rotulo: indiceDoDia(primeiroDia) === indiceDoDia(ultimoDia) ? diaEMes(primeiroDia) : `${diaEMes(primeiroDia)} – ${diaEMes(ultimoDia)}`,
      percentual: kpis.aproveitamento,
      casos: kpis.casosResolvidos.tentativas,
    });
  }
  return pontos;
}

export const MENSAGEM_PERIODO_INVERTIDO = 'A data inicial não pode ser depois da data final.';
export const MENSAGEM_PERIODO_LONGO = 'O período pode ter no máximo 1 ano.';

export function validarPeriodo(inicio: Date, fim: Date): string | null {
  if (indiceDoDia(inicio) > indiceDoDia(fim)) {
    return MENSAGEM_PERIODO_INVERTIDO;
  }
  const limite = new Date(inicio.getFullYear() + 1, inicio.getMonth(), inicio.getDate());
  return indiceDoDia(fim) > indiceDoDia(limite) ? MENSAGEM_PERIODO_LONGO : null;
}

export function periodoEntreDatas(de: Date, ate: Date): Pick<FiltroKpis, 'inicio' | 'fim'> {
  return { inicio: new Date(de.getFullYear(), de.getMonth(), de.getDate()), fim: fimDoDia(ate) };
}
