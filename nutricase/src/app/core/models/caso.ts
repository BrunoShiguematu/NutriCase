export type Nivel = 'Iniciante' | 'Intermediário' | 'Avançado';

/** Tolerância da dieta (%) usada enquanto o docente não define outra; valor de exemplo, aguarda validação docente. */
export const TOLERANCIA_DIETA_PADRAO = 10;

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
  /**
   * Tolerância (%) para comparar a dieta do estudante com as metas que ele calculou (RF24, RN05).
   * Valor de exemplo até a validação docente.
   */
  toleranciaDieta: number;
}
