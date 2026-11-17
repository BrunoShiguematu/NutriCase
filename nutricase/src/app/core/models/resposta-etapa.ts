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
  readonly id: string;
  readonly resolucaoId: string;
  readonly etapaId: string;
  /** Parâmetro escolhido: o nome da equação na TMB; o fator de atividade ou os g/kg/dia nas outras etapas. */
  readonly parametro: string | number;
  /** Valor calculado pelo estudante (kcal/dia na TMB e no GET; g/dia nas outras etapas). */
  readonly valor: number;
  /** Só preenchida na submissão: antes disso nada de certo ou errado aparece (RF09). */
  readonly classificacao?: Classificacao;
  /** Só preenchido na submissão, quando a classificação é "erro de fato". */
  readonly tipoErro?: TipoErro;
}

/** Os 5 tipos de erro do resumo (RF34), na ordem em que aparecem. */
export const TIPOS_ERRO: readonly TipoErro[] = [
  'conversão de unidade',
  'escolha de equação',
  'aritmética',
  'meta fora de faixa',
  'dieta fora das metas',
];

/** Quantos erros de cada tipo a tentativa teve; "dieta fora das metas" vale 0 ou 1. */
export type ResumoErros = Record<TipoErro, number>;
