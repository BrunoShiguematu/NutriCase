export type Sexo = 'feminino' | 'masculino';

/** Ficha do atleta fictício de um caso (RF04–RF05). */
export interface Atleta {
  readonly id: string;
  /** Nome fictício. */
  readonly nome: string;
  readonly idade: number;
  readonly sexo: Sexo;
  /** Em kg. */
  readonly peso: number;
  /** Em cm. */
  readonly altura: number;
  /** Em %; vazio quando o caso não informa. */
  readonly percentualGordura?: number;
  /** Texto livre, ex.: "90 min/dia, 5x por semana". */
  readonly volumeTreino: string;
  /** Texto livre, ex.: "06h00". */
  readonly horarioTreino: string;
  readonly fasePeriodizacao: string;
  readonly objetivo: string;
  readonly restricoes: readonly string[];
  readonly preferencias: readonly string[];
}
