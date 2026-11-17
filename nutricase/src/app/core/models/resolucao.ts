export type StatusResolucao = 'em andamento' | 'submetida';

/** Uma tentativa do estudante em um caso (UC06, RF35). */
export interface Resolucao {
  readonly id: string;
  readonly casoId: string;
  /** Data e hora em ISO 8601, ex.: "2026-11-10T14:30:00.000Z". */
  readonly data: string;
  readonly status: StatusResolucao;
  readonly justificativa: string;
  /** Data e hora da submissão em ISO 8601; só existe quando o status é "submetida". */
  readonly submetidaEm?: string;
}
