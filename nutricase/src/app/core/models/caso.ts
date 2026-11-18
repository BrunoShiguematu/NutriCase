export type Nivel = 'Iniciante' | 'Intermediário' | 'Avançado';

export const TOLERANCIA_DIETA_PADRAO = 10;

export interface Caso {
  readonly id: string;
  readonly atletaId: string;
  readonly titulo: string;
  readonly modalidade: string;
  readonly nivel: Nivel;
  readonly competencia: string;
  readonly descricao: string;
  readonly comentarioReferencia: string;
  readonly toleranciaDieta: number;
}
