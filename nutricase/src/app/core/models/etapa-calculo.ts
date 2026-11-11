/** As 5 etapas de cálculo de um caso, sempre nesta ordem (TMB → GET → carboidrato → proteína → gordura). */
export type TipoEtapa = 'TMB' | 'GET' | 'CHO' | 'PTN' | 'LIP';

/**
 * Etapa de cálculo de um caso, com o critério de correção (RF07, RF21–RF23, RNF09).
 *
 * Os valores de critério (parâmetro de referência, opções, faixa e tolerância) são exemplos
 * até a validação docente; ficam nos dados do caso para o docente poder editá-los.
 */
export interface EtapaCalculo {
  id: string;
  casoId: string;
  /** Posição da etapa no caso, começando em 1. */
  ordem: number;
  tipo: TipoEtapa;
  /**
   * Parâmetro de referência do caso. Na TMB é texto (o nome da equação, ex.: "Mifflin-St Jeor");
   * nas outras etapas é número (fator de atividade ou g/kg/dia).
   */
  parametroReferencia: string | number;
  /** Só na TMB: as equações aceitáveis. Escolher uma fora desta lista é erro de "escolha de equação". */
  opcoesAceitaveis?: string[];
  /**
   * Só nas etapas numéricas: faixa aceitável do parâmetro. Dentro dela e fora da referência é
   * divergência (RN02); fora dela é "meta fora de faixa".
   */
  faixaAceitavel?: { min: number; max: number };
  /** Tolerância em %, usada para comparar o valor do estudante com o esperado. */
  tolerancia: number;
  /** Critério de referência do caso, em texto, mostrado nas etapas divergentes (RF23). */
  criterioReferencia: string;
}
