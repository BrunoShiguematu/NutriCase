import { Injectable, computed, signal } from '@angular/core';
import { Atleta, Caso } from '../models';
import {
  ATLETAS_EXEMPLO,
  CASOS_EXEMPLO,
  PREFIXO_ID_EXEMPLO,
  VERSAO_CASOS_EXEMPLO,
} from '../data/casos-exemplo';
import { StorageService } from './storage.service';

/** Campos que o usuário preenche; o serviço gera `id` e `atletaId`. */
export type DadosCaso = Omit<Caso, 'id' | 'atletaId'>;
export type DadosAtleta = Omit<Atleta, 'id'>;

export interface CasoComAtleta {
  caso: Caso;
  atleta: Atleta;
}

interface DadosSalvos {
  versao: number;
  casos: Caso[];
  atletas: Atleta[];
}

const CHAVE = 'nutricase.casos';

// O serviço só entrega e só guarda cópias: nenhuma tela consegue alterar o estado interno
// nem as constantes de exemplo por acidente.
function copiarCaso<T extends DadosCaso>(caso: T): T {
  return { ...caso };
}

function copiarAtleta<T extends DadosAtleta>(atleta: T): T {
  return { ...atleta, restricoes: [...atleta.restricoes], preferencias: [...atleta.preferencias] };
}

function gerarId(prefixo: string): string {
  return `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Casos e fichas de atleta, guardados no navegador pelo StorageService.
 * `casos` é um signal: as telas que o leem atualizam sozinhas depois de criar, editar ou excluir.
 * Os objetos do signal são cópias compartilhadas por quem o lê até a próxima mudança: telas só
 * leem. Para editar, use `buscarPorId`, que devolve uma cópia nova a cada chamada.
 */
@Injectable({ providedIn: 'root' })
export class CasoService {
  private readonly dados = signal<DadosSalvos>({ versao: VERSAO_CASOS_EXEMPLO, casos: [], atletas: [] });

  readonly casos = computed(() => this.dados().casos.map(copiarCaso));

  constructor(private readonly storage: StorageService) {
    this.dados.set(this.carregar());
  }

  listar(): Caso[] {
    return this.dados().casos.map(copiarCaso);
  }

  buscarPorId(id: string): CasoComAtleta | undefined {
    const { casos, atletas } = this.dados();
    const caso = casos.find((c) => c.id === id);
    const atleta = caso ? atletas.find((a) => a.id === caso.atletaId) : undefined;
    return caso && atleta ? { caso: copiarCaso(caso), atleta: copiarAtleta(atleta) } : undefined;
  }

  criar(dadosCaso: DadosCaso, dadosAtleta: DadosAtleta): CasoComAtleta {
    const atleta: Atleta = { ...copiarAtleta(dadosAtleta), id: gerarId('atleta') };
    const caso: Caso = { ...copiarCaso(dadosCaso), id: gerarId('caso'), atletaId: atleta.id };
    const atual = this.dados();
    this.salvar({
      ...atual,
      casos: [...atual.casos, caso],
      atletas: [...atual.atletas, atleta],
    });
    return { caso: copiarCaso(caso), atleta: copiarAtleta(atleta) };
  }

  /** Atualiza o caso e a ficha do atleta; devolve `undefined` se o id não existe. */
  atualizar(id: string, dadosCaso: DadosCaso, dadosAtleta: DadosAtleta): CasoComAtleta | undefined {
    const existente = this.buscarPorId(id);
    if (!existente) {
      return undefined;
    }
    const atleta: Atleta = { ...copiarAtleta(dadosAtleta), id: existente.atleta.id };
    const caso: Caso = { ...copiarCaso(dadosCaso), id: existente.caso.id, atletaId: atleta.id };
    const atual = this.dados();
    this.salvar({
      ...atual,
      casos: atual.casos.map((c) => (c.id === id ? caso : c)),
      atletas: atual.atletas.map((a) => (a.id === atleta.id ? atleta : a)),
    });
    return { caso: copiarCaso(caso), atleta: copiarAtleta(atleta) };
  }

  /** Exclui o caso e o atleta dele; devolve `false` se o id não existe. */
  excluir(id: string): boolean {
    const existente = this.buscarPorId(id);
    if (!existente) {
      return false;
    }
    const atual = this.dados();
    this.salvar({
      ...atual,
      casos: atual.casos.filter((c) => c.id !== id),
      atletas: atual.atletas.filter((a) => a.id !== existente.atleta.id),
    });
    return true;
  }

  private salvar(novo: DadosSalvos): void {
    this.dados.set(novo);
    this.storage.gravar(CHAVE, novo);
  }

  /**
   * Primeira abertura (ou dado ilegível): grava os exemplos.
   * Versão diferente da atual: troca os exemplos antigos pelos atuais e mantém os casos do usuário.
   */
  private carregar(): DadosSalvos {
    const salvos = this.lerSalvos();
    if (!salvos) {
      return this.gravarEDevolver({
        versao: VERSAO_CASOS_EXEMPLO,
        casos: CASOS_EXEMPLO.map(copiarCaso),
        atletas: ATLETAS_EXEMPLO.map(copiarAtleta),
      });
    }
    if (salvos.versao === VERSAO_CASOS_EXEMPLO) {
      return salvos;
    }
    return this.gravarEDevolver({
      versao: VERSAO_CASOS_EXEMPLO,
      casos: [...CASOS_EXEMPLO.map(copiarCaso), ...salvos.casos.filter((c) => !c.id.startsWith(PREFIXO_ID_EXEMPLO))],
      atletas: [...ATLETAS_EXEMPLO.map(copiarAtleta), ...salvos.atletas.filter((a) => !a.id.startsWith(PREFIXO_ID_EXEMPLO))],
    });
  }

  private lerSalvos(): DadosSalvos | null {
    const lido = this.storage.ler<Partial<DadosSalvos>>(CHAVE);
    if (lido && typeof lido.versao === 'number' && Array.isArray(lido.casos) && Array.isArray(lido.atletas)) {
      return { versao: lido.versao, casos: lido.casos, atletas: lido.atletas };
    }
    return null;
  }

  private gravarEDevolver(dados: DadosSalvos): DadosSalvos {
    this.storage.gravar(CHAVE, dados);
    return dados;
  }
}
