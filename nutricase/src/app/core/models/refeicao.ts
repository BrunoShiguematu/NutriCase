export type MarcadorRefeicao = 'pré-treino' | 'pós-treino' | 'nenhum';

/** Refeição da dieta montada em uma tentativa (RF12, RF18). */
export interface Refeicao {
  readonly id: string;
  readonly resolucaoId: string;
  readonly nome: string;
  /** Horário no formato "HH:mm". */
  readonly horario: string;
  readonly marcador: MarcadorRefeicao;
}
