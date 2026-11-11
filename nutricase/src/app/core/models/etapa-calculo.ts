/**
 * Etapa de cálculo de um caso, com o critério de correção (RF07, RF21–RF23, RNF09).
 * Valores de critério, faixa e tolerância são exemplos até a validação docente.
 */
export interface EtapaCalculo {
  id: string;
  casoId: string;
  /** Posição da etapa no caso, começando em 1. */
  ordem: number;
  /** Texto livre, ex.: "TMB", "GET", "Meta de carboidrato". Os tipos dependem dos docentes. */
  tipo: string;
  /** Critério de referência do caso, mostrado nas etapas divergentes (RF23). */
  criterioReferencia: string;
  /** Faixa aceitável do resultado; escolha dentro dela e fora da referência é divergência (RN02). */
  faixaAceitavel: { min: number; max: number };
  /** Tolerância em %. */
  tolerancia: number;
}
