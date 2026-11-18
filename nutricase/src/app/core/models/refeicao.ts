export type MarcadorRefeicao = 'pré-treino' | 'pós-treino' | 'nenhum';

export interface Refeicao {
  readonly id: string;
  readonly resolucaoId: string;
  readonly nome: string;
  readonly horario: string;
  readonly marcador: MarcadorRefeicao;
}
