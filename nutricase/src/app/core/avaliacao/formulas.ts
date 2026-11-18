import { Atleta } from '../models';

export const EQUACOES_TMB = ['Harris-Benedict revisada', 'Mifflin-St Jeor', 'Cunningham'] as const;

export type EquacaoTmb = (typeof EQUACOES_TMB)[number];

export type DadosParaTmb = Pick<Atleta, 'sexo' | 'idade' | 'peso' | 'altura' | 'percentualGordura'>;

export const KCAL_POR_GRAMA = { cho: 4, ptn: 4, lip: 9 } as const;

export interface Macros {
  cho: number;
  ptn: number;
  lip: number;
}

export interface KcalDosMacros extends Macros {
  total: number;
}

export function podeCalcularTmb(equacao: EquacaoTmb, atleta: DadosParaTmb): boolean {
  return equacao !== 'Cunningham' || atleta.percentualGordura !== undefined;
}

export function tmb(equacao: EquacaoTmb, atleta: DadosParaTmb): number {
  switch (equacao) {
    case 'Harris-Benedict revisada':
      return tmbHarrisBenedictRevisada(atleta);
    case 'Mifflin-St Jeor':
      return tmbMifflinStJeor(atleta);
    case 'Cunningham':
      return tmbCunningham(atleta);
  }
}

function tmbHarrisBenedictRevisada({ sexo, peso, altura, idade }: DadosParaTmb): number {
  return sexo === 'masculino'
    ? 88.362 + 13.397 * peso + 4.799 * altura - 5.677 * idade
    : 447.593 + 9.247 * peso + 3.098 * altura - 4.33 * idade;
}

function tmbMifflinStJeor({ sexo, peso, altura, idade }: DadosParaTmb): number {
  return 10 * peso + 6.25 * altura - 5 * idade + (sexo === 'masculino' ? 5 : -161);
}

function tmbCunningham({ peso, percentualGordura }: DadosParaTmb): number {
  if (percentualGordura === undefined) {
    throw new Error('A equação de Cunningham exige o percentual de gordura do atleta, e a ficha não informa.');
  }
  const massaLivreDeGordura = peso * (1 - percentualGordura / 100);
  return 500 + 22 * massaLivreDeGordura;
}

export function get(tmbKcal: number, fatorAtividade: number): number {
  return tmbKcal * fatorAtividade;
}

export function gramasPorDia(gramasPorKg: number, pesoKg: number): number {
  return gramasPorKg * pesoKg;
}

export function kcalDosMacros({ cho, ptn, lip }: Macros): KcalDosMacros {
  const kcalCho = cho * KCAL_POR_GRAMA.cho;
  const kcalPtn = ptn * KCAL_POR_GRAMA.ptn;
  const kcalLip = lip * KCAL_POR_GRAMA.lip;
  return { cho: kcalCho, ptn: kcalPtn, lip: kcalLip, total: kcalCho + kcalPtn + kcalLip };
}
