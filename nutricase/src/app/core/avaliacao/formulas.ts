// Fórmulas da correção (RNF08): funções puras, sem Angular, sem arredondar e sem estado.
// Quem compara com a resposta do estudante aplica a tolerância do caso (a arredondagem não é daqui).
//
// Unidades, como no modelo Atleta: peso em kg, altura em cm, idade em anos, percentual de gordura em %.
// Valores e equações aguardam validação docente.

import { Atleta } from '../models';

/** Nomes exatos das equações de TMB, para as telas e os dados dos casos usarem. */
export const EQUACOES_TMB = ['Harris-Benedict revisada', 'Mifflin-St Jeor', 'Cunningham'] as const;

export type EquacaoTmb = (typeof EQUACOES_TMB)[number];

/** Só os campos da ficha que as fórmulas leem; um `Atleta` inteiro serve. */
export type DadosParaTmb = Pick<Atleta, 'sexo' | 'idade' | 'peso' | 'altura' | 'percentualGordura'>;

/** kcal por grama de cada macronutriente (4/4/9). */
export const KCAL_POR_GRAMA = { cho: 4, ptn: 4, lip: 9 } as const;

/** Gramas por dia de cada macronutriente. */
export interface Macros {
  cho: number;
  ptn: number;
  lip: number;
}

/** Energia em kcal de cada macronutriente e o total. */
export interface KcalDosMacros extends Macros {
  total: number;
}

/**
 * Indica se a equação pode ser calculada para este atleta.
 * Só a Cunningham pode não poder: ela exige o percentual de gordura, que a ficha pode não informar.
 */
export function podeCalcularTmb(equacao: EquacaoTmb, atleta: DadosParaTmb): boolean {
  return equacao !== 'Cunningham' || atleta.percentualGordura !== undefined;
}

/**
 * Taxa metabólica basal em kcal/dia pela equação escolhida.
 *
 * Cunningham só existe quando a ficha informa o percentual de gordura. Sem ele, esta função
 * **lança um `Error`** com mensagem clara (em vez de devolver `undefined` e deixar um valor
 * ausente passar adiante). Quem avalia as etapas consulta `podeCalcularTmb` antes de calcular.
 */
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

/**
 * Harris-Benedict revisada.
 * Fonte: Roza AM, Shizgal HM. The Harris Benedict equation reevaluated: resting energy
 * requirements and the body cell mass. Am J Clin Nutr. 1984;40(1):168-182.
 *   homem:  88,362 + 13,397 × peso + 4,799 × altura − 5,677 × idade
 *   mulher: 447,593 + 9,247 × peso + 3,098 × altura − 4,330 × idade
 * Valores e equações aguardam validação docente.
 */
function tmbHarrisBenedictRevisada({ sexo, peso, altura, idade }: DadosParaTmb): number {
  return sexo === 'masculino'
    ? 88.362 + 13.397 * peso + 4.799 * altura - 5.677 * idade
    : 447.593 + 9.247 * peso + 3.098 * altura - 4.33 * idade;
}

/**
 * Mifflin-St Jeor.
 * Fonte: Mifflin MD, St Jeor ST, Hill LA, Scott BJ, Daugherty SA, Koh YO. A new predictive
 * equation for resting energy expenditure in healthy individuals. Am J Clin Nutr. 1990;51(2):241-247.
 *   10 × peso + 6,25 × altura − 5 × idade + s, com s = +5 (homem) ou −161 (mulher)
 * Esta é a forma arredondada usual. O artigo publica 9,99 × peso + 6,25 × altura − 4,92 × idade
 * + 166 × k − 161, com k = 1 (homem) ou 0 (mulher); a diferença é de cerca de 2 kcal, bem abaixo
 * de qualquer tolerância.
 * Valores e equações aguardam validação docente.
 */
function tmbMifflinStJeor({ sexo, peso, altura, idade }: DadosParaTmb): number {
  return 10 * peso + 6.25 * altura - 5 * idade + (sexo === 'masculino' ? 5 : -161);
}

/**
 * Cunningham.
 * Fonte: Cunningham JJ. A reanalysis of the factors influencing basal metabolic rate in normal
 * adults. Am J Clin Nutr. 1980;33(11):2372-2374.
 *   500 + 22 × massa livre de gordura, com massa livre de gordura = peso × (1 − % de gordura / 100)
 * Não depende de sexo nem de idade. Exige o percentual de gordura (veja `tmb`).
 * Valores e equações aguardam validação docente.
 */
function tmbCunningham({ peso, percentualGordura }: DadosParaTmb): number {
  if (percentualGordura === undefined) {
    throw new Error('A equação de Cunningham exige o percentual de gordura do atleta, e a ficha não informa.');
  }
  const massaLivreDeGordura = peso * (1 - percentualGordura / 100);
  return 500 + 22 * massaLivreDeGordura;
}

/** Gasto energético total em kcal/dia: TMB × fator de atividade. */
export function get(tmbKcal: number, fatorAtividade: number): number {
  return tmbKcal * fatorAtividade;
}

/** Gramas por dia de um macronutriente: g/kg/dia × peso em kg. */
export function gramasPorDia(gramasPorKg: number, pesoKg: number): number {
  return gramasPorKg * pesoKg;
}

/** Energia dos macronutrientes em kcal, com 4 kcal/g de carboidrato e de proteína e 9 kcal/g de gordura. */
export function kcalDosMacros({ cho, ptn, lip }: Macros): KcalDosMacros {
  const kcalCho = cho * KCAL_POR_GRAMA.cho;
  const kcalPtn = ptn * KCAL_POR_GRAMA.ptn;
  const kcalLip = lip * KCAL_POR_GRAMA.lip;
  return { cho: kcalCho, ptn: kcalPtn, lip: kcalLip, total: kcalCho + kcalPtn + kcalLip };
}
