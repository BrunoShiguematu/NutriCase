export type Sexo = 'feminino' | 'masculino';

/** Ficha do atleta fictício de um caso (RF04–RF05). */
export interface Atleta {
  id: string;
  /** Nome fictício. */
  nome: string;
  idade: number;
  sexo: Sexo;
  /** Em kg. */
  peso: number;
  /** Em cm. */
  altura: number;
  /** Em %; vazio quando o caso não informa. */
  percentualGordura?: number;
  /** Texto livre, ex.: "90 min/dia, 5x por semana". */
  volumeTreino: string;
  /** Texto livre, ex.: "06h00". */
  horarioTreino: string;
  fasePeriodizacao: string;
  objetivo: string;
  restricoes: string[];
  preferencias: string[];
}
