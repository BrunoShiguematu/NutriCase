export type OrigemAlimento = 'TACO' | 'aluno';

export interface Alimento {
  id: string;
  nome: string;
  grupo: string;
  kcal: number;
  carboidrato: number;
  proteina: number;
  gordura: number;
  origem: OrigemAlimento;
}
