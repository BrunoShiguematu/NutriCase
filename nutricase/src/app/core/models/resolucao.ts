export type StatusResolucao = 'em andamento' | 'submetida';

/** Uma tentativa do estudante em um caso (UC06, RF35). */
export interface Resolucao {
  id: string;
  casoId: string;
  /** Data e hora em ISO 8601, ex.: "2026-11-10T14:30:00.000Z". */
  data: string;
  status: StatusResolucao;
  justificativa: string;
}
