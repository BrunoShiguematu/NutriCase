export type Nivel = 'Iniciante' | 'Intermediário' | 'Avançado';

/** Exercício do catálogo (RF01–RF03, RF36). A ficha do atleta fica em `Atleta`. */
export interface Caso {
  id: string;
  atletaId: string;
  titulo: string;
  modalidade: string;
  nivel: Nivel;
  competencia: string;
  descricao: string;
  comentarioReferencia: string;
}
