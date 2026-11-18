import { Alimento, Atleta, Caso, ItemRefeicao, Refeicao, TOLERANCIA_DIETA_PADRAO } from '../models';

export const MIN_REFEICOES = 3;

export const MAX_PERCENTUAL_KCAL_REFEICAO = 40;

export const MIN_ALIMENTOS_DIFERENTES = 5;

export const PALAVRAS_RESTRICAO: Readonly<Record<string, readonly string[]>> = {
  'Intolerância à lactose': ['leite', 'queijo', 'iogurte', 'requeijão', 'creme de leite'],
};

const EPSILON = 1e-9;

export interface Totais {
  kcal: number;
  cho: number;
  ptn: number;
  lip: number;
}

export interface TotaisRefeicao {
  refeicaoId: string;
  totais: Totais;
  itensIncompletos: string[];
}

export interface TotaisDaDieta {
  porRefeicao: TotaisRefeicao[];
  dia: Totais;
  itensIncompletos: string[];
}

export function totaisDaDieta(
  refeicoes: readonly Refeicao[],
  itens: readonly ItemRefeicao[],
  alimentos: readonly Alimento[],
): TotaisDaDieta {
  const alimentoPorId = new Map(alimentos.map((a) => [a.id, a]));

  const porRefeicao = refeicoes.map((refeicao): TotaisRefeicao => {
    const totais = totaisZerados();
    const itensIncompletos: string[] = [];
    for (const item of itens.filter((i) => i.refeicaoId === refeicao.id)) {
      const parcela = parcelaDoItem(item, alimentoPorId.get(item.alimentoId));
      if (parcela === undefined) {
        itensIncompletos.push(item.id);
        continue;
      }
      somarEm(totais, parcela);
    }
    return { refeicaoId: refeicao.id, totais, itensIncompletos };
  });

  const dia = totaisZerados();
  for (const r of porRefeicao) {
    somarEm(dia, r.totais);
  }
  return { porRefeicao, dia, itensIncompletos: porRefeicao.flatMap((r) => r.itensIncompletos) };
}

export type NutrienteMeta = keyof Totais;

export type Meta = number | null | undefined;

export interface MetasDoAluno {
  kcal?: Meta;
  cho?: Meta;
  ptn?: Meta;
  lip?: Meta;
}

export interface ComparativoMeta {
  nutriente: NutrienteMeta;
  total: number;
  situacao: 'dentro' | 'fora' | 'sem meta';
  meta?: number;
  diferencaPercentual?: number;
  dentroDaTolerancia?: boolean;
}

export type TipoAlerta =
  | 'falta pré-treino'
  | 'falta pós-treino'
  | 'restrição violada'
  | 'poucas refeições'
  | 'refeição concentra kcal'
  | 'pouca variedade';

export interface AlertaDieta {
  tipo: TipoAlerta;
  texto: string;
  refeicaoId?: string;
  alimentoId?: string;
}

export interface AvaliacaoDieta {
  totais: TotaisDaDieta;
  comparativo: ComparativoMeta[];
  alertas: AlertaDieta[];
  dietaForaDasMetas: boolean;
}

export function avaliarDieta(
  refeicoes: readonly Refeicao[],
  itens: readonly ItemRefeicao[],
  alimentos: readonly Alimento[],
  metasDoAluno: MetasDoAluno,
  caso: Pick<Caso, 'toleranciaDieta'>,
  atleta: Pick<Atleta, 'restricoes'>,
): AvaliacaoDieta {
  const totais = totaisDaDieta(refeicoes, itens, alimentos);
  const tolerancia = toleranciaValida(caso.toleranciaDieta);
  const comparativo = (['kcal', 'cho', 'ptn', 'lip'] as const).map((nutriente) =>
    compararComMeta(nutriente, totais.dia[nutriente], metasDoAluno[nutriente], tolerancia),
  );
  return {
    totais,
    comparativo,
    alertas: [
      ...alertasDeTreino(refeicoes),
      ...alertasDeRestricao(refeicoes, itens, alimentos, atleta.restricoes ?? []),
      ...alertasDeDistribuicao(refeicoes, totais),
      ...alertasDeVariedade(refeicoes, itens),
    ],
    dietaForaDasMetas: comparativo.some((c) => c.situacao === 'fora'),
  };
}

function totaisZerados(): Totais {
  return { kcal: 0, cho: 0, ptn: 0, lip: 0 };
}

function somarEm(destino: Totais, parcela: Totais): void {
  destino.kcal += parcela.kcal;
  destino.cho += parcela.cho;
  destino.ptn += parcela.ptn;
  destino.lip += parcela.lip;
}

function numeroFinito(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor);
}

function parcelaDoItem(item: ItemRefeicao, alimento: Alimento | undefined): Totais | undefined {
  if (!alimento || !numeroFinito(item.quantidadeGramas) || item.quantidadeGramas < 0) {
    return undefined;
  }
  const { kcal, carboidrato, proteina, gordura } = alimento;
  if (![kcal, carboidrato, proteina, gordura].every(numeroFinito)) {
    return undefined;
  }
  const fator = item.quantidadeGramas / 100;
  return { kcal: kcal * fator, cho: carboidrato * fator, ptn: proteina * fator, lip: gordura * fator };
}

function toleranciaValida(tolerancia: number | undefined): number {
  return numeroFinito(tolerancia) && tolerancia > 0 ? tolerancia : TOLERANCIA_DIETA_PADRAO;
}

function compararComMeta(nutriente: NutrienteMeta, total: number, meta: Meta, tolerancia: number): ComparativoMeta {
  if (!numeroFinito(meta)) {
    return { nutriente, total, situacao: 'sem meta' };
  }
  const dentroDaTolerancia = Math.abs(total - meta) <= Math.abs(meta) * (tolerancia / 100) + EPSILON;
  const comparativo: ComparativoMeta = {
    nutriente,
    total,
    situacao: dentroDaTolerancia ? 'dentro' : 'fora',
    meta,
    dentroDaTolerancia,
  };
  if (meta !== 0) {
    comparativo.diferencaPercentual = ((total - meta) / Math.abs(meta)) * 100;
  } else if (total === 0) {
    comparativo.diferencaPercentual = 0;
  }
  return comparativo;
}

function alertasDeTreino(refeicoes: readonly Refeicao[]): AlertaDieta[] {
  const alertas: AlertaDieta[] = [];
  if (!refeicoes.some((r) => r.marcador === 'pré-treino')) {
    alertas.push({ tipo: 'falta pré-treino', texto: 'Falta uma refeição marcada como pré-treino.' });
  }
  if (!refeicoes.some((r) => r.marcador === 'pós-treino')) {
    alertas.push({ tipo: 'falta pós-treino', texto: 'Falta uma refeição marcada como pós-treino.' });
  }
  return alertas;
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function nomeContemPalavra(nomeNormalizado: string, palavra: string): boolean {
  const escapada = palavra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escapada}`).test(nomeNormalizado);
}

function alertasDeRestricao(
  refeicoes: readonly Refeicao[],
  itens: readonly ItemRefeicao[],
  alimentos: readonly Alimento[],
  restricoes: readonly string[],
): AlertaDieta[] {
  const palavrasPorRestricao = new Map(Object.entries(PALAVRAS_RESTRICAO).map(([nome, palavras]) => [normalizar(nome), palavras]));
  const alimentoPorId = new Map(alimentos.map((a) => [a.id, a]));
  const alertas: AlertaDieta[] = [];

  for (const restricao of restricoes) {
    const palavras = palavrasPorRestricao.get(normalizar(restricao));
    if (!palavras) {
      continue;
    }
    const palavrasNormalizadas = palavras.map(normalizar);
    for (const refeicao of refeicoes) {
      for (const item of itens.filter((i) => i.refeicaoId === refeicao.id)) {
        const alimento = alimentoPorId.get(item.alimentoId);
        if (alimento && palavrasNormalizadas.some((p) => nomeContemPalavra(normalizar(alimento.nome), p))) {
          alertas.push({
            tipo: 'restrição violada',
            texto: `"${alimento.nome}" (refeição "${refeicao.nome}") conflita com a restrição "${restricao}".`,
            refeicaoId: refeicao.id,
            alimentoId: alimento.id,
          });
        }
      }
    }
  }
  return alertas;
}

function alertasDeDistribuicao(refeicoes: readonly Refeicao[], totais: TotaisDaDieta): AlertaDieta[] {
  const alertas: AlertaDieta[] = [];
  if (refeicoes.length < MIN_REFEICOES) {
    alertas.push({
      tipo: 'poucas refeições',
      texto: `A dieta tem menos de ${MIN_REFEICOES} refeições (tem ${refeicoes.length}).`,
    });
  }
  const kcalDoDia = totais.dia.kcal;
  if (kcalDoDia > 0) {
    for (const [indice, { totais: parcial }] of totais.porRefeicao.entries()) {
      const percentual = (parcial.kcal / kcalDoDia) * 100;
      if (percentual > MAX_PERCENTUAL_KCAL_REFEICAO + EPSILON) {
        const refeicao = refeicoes[indice];
        alertas.push({
          tipo: 'refeição concentra kcal',
          texto: `A refeição "${refeicao.nome}" concentra ${num(percentual)}% das kcal do dia (limite de exemplo: ${MAX_PERCENTUAL_KCAL_REFEICAO}%).`,
          refeicaoId: refeicao.id,
        });
      }
    }
  }
  return alertas;
}

function alertasDeVariedade(refeicoes: readonly Refeicao[], itens: readonly ItemRefeicao[]): AlertaDieta[] {
  const idsDasRefeicoes = new Set(refeicoes.map((r) => r.id));
  const diferentes = new Set(itens.filter((i) => idsDasRefeicoes.has(i.refeicaoId)).map((i) => i.alimentoId));
  return diferentes.size < MIN_ALIMENTOS_DIFERENTES
    ? [{ tipo: 'pouca variedade', texto: `A dieta tem menos de ${MIN_ALIMENTOS_DIFERENTES} alimentos diferentes (tem ${diferentes.size}).` }]
    : [];
}

function num(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}
