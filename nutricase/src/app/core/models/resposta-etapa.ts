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
  /** Opção escolhida, ex.: a equação de TMB; vazio em etapas só numéricas. */
  escolha?: string;
  /** Valor calculado pelo estudante; vazio em etapas só de escolha. */
  valor?: number;
  classificacao: Classificacao;
  /** Só preenchido quando a classificação é "erro de fato". */
  tipoErro?: TipoErro;
}
