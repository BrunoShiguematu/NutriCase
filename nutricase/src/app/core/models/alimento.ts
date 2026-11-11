export type OrigemAlimento = 'TACO' | 'aluno';

/** Item da base de alimentos (RF13–RF14). Nutrientes por 100 g. */
export interface Alimento {
  id: string;
  nome: string;
  grupo: string;
  /** kcal por 100 g. */
  kcal: number;
  /** g por 100 g. */
  carboidrato: number;
  /** g por 100 g. */
  proteina: number;
  /** g por 100 g. */
  gordura: number;
  /** Quem cadastrou o alimento: vindo da tabela TACO ou criado pelo aluno. */
  origem: OrigemAlimento;
  /** Referência da fonte em texto livre, ex.: "TACO 4ª ed.". */
  fonte: string;
}
