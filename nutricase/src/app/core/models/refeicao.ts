export type MarcadorRefeicao = 'pré-treino' | 'pós-treino' | 'nenhum';

/** Refeição da dieta montada em uma tentativa (RF12, RF18). */
export interface Refeicao {
  id: string;
  resolucaoId: string;
  nome: string;
  /** Horário no formato "HH:mm". */
  horario: string;
  marcador: MarcadorRefeicao;
}
