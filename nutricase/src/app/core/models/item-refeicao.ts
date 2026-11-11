/** Alimento e quantidade dentro de uma refeição (RF14–RF16). */
export interface ItemRefeicao {
  id: string;
  refeicaoId: string;
  alimentoId: string;
  quantidadeGramas: number;
}
