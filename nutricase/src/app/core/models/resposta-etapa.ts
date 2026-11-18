export type Classificacao = 'correta' | 'divergente' | 'erro de fato';

export type TipoErro =
  | 'conversão de unidade'
  | 'escolha de equação'
  | 'aritmética'
  | 'meta fora de faixa'
  | 'dieta fora das metas';

export interface RespostaEtapa {
  readonly id: string;
  readonly resolucaoId: string;
  readonly etapaId: string;
  readonly parametro: string | number;
  readonly valor: number;
  readonly classificacao?: Classificacao;
  readonly tipoErro?: TipoErro;
}

export const TIPOS_ERRO: readonly TipoErro[] = [
  'conversão de unidade',
  'escolha de equação',
  'aritmética',
  'meta fora de faixa',
  'dieta fora das metas',
];

export type ResumoErros = Record<TipoErro, number>;
