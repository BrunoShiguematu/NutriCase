export type Classificacao = 'correta' | 'divergente' | 'erro de fato';

/** Os 5 tipos de erro agrupados no resumo (RF34). */
export type TipoErro =
  | 'conversão de unidade'
  | 'escolha de equação'
  | 'aritmética'
  | 'meta fora de faixa'
  | 'dieta fora das metas';

/** O que o estudante respondeu em uma etapa e como foi classificado (RF08, RF21, RF34). */
export interface RespostaEtapa {
  id: string;
  resolucaoId: string;
  etapaId: string;
  /** Parâmetro escolhido: o nome da equação na TMB; o fator de atividade ou os g/kg/dia nas outras etapas. */
  parametro: string | number;
  /** Valor calculado pelo estudante (kcal/dia na TMB e no GET; g/dia nas outras etapas). */
  valor: number;
  /** Só preenchida na submissão: antes disso nada de certo ou errado aparece (RF09). */
  classificacao?: Classificacao;
  /** Só preenchido na submissão, quando a classificação é "erro de fato". */
  tipoErro?: TipoErro;
}
