export type TipoEtapa = 'TMB' | 'GET' | 'CHO' | 'PTN' | 'LIP';

export interface EtapaCalculo {
  readonly id: string;
  readonly casoId: string;
  readonly ordem: number;
  readonly tipo: TipoEtapa;
  readonly parametroReferencia: string | number;
  readonly opcoesAceitaveis?: readonly string[];
  readonly faixaAceitavel?: { readonly min: number; readonly max: number };
  readonly tolerancia: number;
  readonly criterioReferencia: string;
}
