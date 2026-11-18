export type Sexo = 'feminino' | 'masculino';

export interface Atleta {
  readonly id: string;
  readonly nome: string;
  readonly idade: number;
  readonly sexo: Sexo;
  readonly peso: number;
  readonly altura: number;
  readonly percentualGordura?: number;
  readonly volumeTreino: string;
  readonly horarioTreino: string;
  readonly fasePeriodizacao: string;
  readonly objetivo: string;
  readonly restricoes: readonly string[];
  readonly preferencias: readonly string[];
}
