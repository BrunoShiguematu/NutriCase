export type StatusResolucao = 'em andamento' | 'submetida';

export interface Resolucao {
  readonly id: string;
  readonly casoId: string;
  readonly data: string;
  readonly status: StatusResolucao;
  readonly justificativa: string;
  readonly submetidaEm?: string;
}
