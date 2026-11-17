/** Alimento e quantidade dentro de uma refeição (RF14–RF16). */
export interface ItemRefeicao {
  readonly id: string;
  readonly refeicaoId: string;
  readonly alimentoId: string;
  readonly quantidadeGramas: number;
}
