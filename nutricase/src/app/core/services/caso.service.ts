import { Injectable, computed, signal } from '@angular/core';
import { Atleta, Caso, EtapaCalculo } from '../models';
import { ATLETAS_EXEMPLO, CASOS_EXEMPLO, ETAPAS_EXEMPLO, etapasPadrao } from '../data/casos-exemplo';
import { StorageService } from './storage.service';

/** Campos que o usuário preenche; o serviço gera `id` e `atletaId`. */
export type DadosCaso = Omit<Caso, 'id' | 'atletaId'>;
export type DadosAtleta = Omit<Atleta, 'id'>;

export interface CasoComAtleta {
  readonly caso: Caso;
  readonly atleta: Atleta;
}

interface DadosSalvos {
  readonly casos: readonly Caso[];
  readonly atletas: readonly Atleta[];
  /** As 5 etapas de todos os casos, ligadas a cada caso por `casoId`. */
  readonly etapas: readonly EtapaCalculo[];
}

const CHAVE = 'nutricase.casos';

const porOrdem = (a: EtapaCalculo, b: EtapaCalculo): number => a.ordem - b.ordem;

function gerarId(prefixo: string): string {
  return `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Casos, fichas de atleta e as 5 etapas de cálculo de cada caso, guardados no navegador pelo StorageService.
 * `casos` é um signal: as telas que o leem atualizam sozinhas depois de criar, editar ou excluir.
 * Os modelos são `readonly` e o serviço nunca altera um objeto: cada mudança cria objetos novos. Por isso as
 * telas e a avaliação guardada de uma submissão (`ResolucaoService`) podem segurar os objetos sem copiar.
 */
@Injectable({ providedIn: 'root' })
export class CasoService {
  private readonly dados = signal<DadosSalvos>({ casos: [], atletas: [], etapas: [] });

  readonly casos = computed(() => this.dados().casos);

  constructor(private readonly storage: StorageService) {
    this.dados.set(this.carregar());
  }

  listar(): readonly Caso[] {
    return this.dados().casos;
  }

  buscarPorId(id: string): CasoComAtleta | undefined {
    const { casos, atletas } = this.dados();
    const caso = casos.find((c) => c.id === id);
    const atleta = caso ? atletas.find((a) => a.id === caso.atletaId) : undefined;
    return caso && atleta ? { caso, atleta } : undefined;
  }

  criar(dadosCaso: DadosCaso, dadosAtleta: DadosAtleta): CasoComAtleta {
    const atleta: Atleta = { ...dadosAtleta, id: gerarId('atleta') };
    const caso: Caso = { ...dadosCaso, id: gerarId('caso'), atletaId: atleta.id };
    const atual = this.dados();
    this.salvar({
      casos: [...atual.casos, caso],
      atletas: [...atual.atletas, atleta],
      etapas: [...atual.etapas, ...etapasPadrao(caso.id)],
    });
    return { caso, atleta };
  }

  /** Atualiza o caso e a ficha do atleta; devolve `undefined` se o id não existe. */
  atualizar(id: string, dadosCaso: DadosCaso, dadosAtleta: DadosAtleta): CasoComAtleta | undefined {
    const existente = this.buscarPorId(id);
    if (!existente) {
      return undefined;
    }
    const atleta: Atleta = { ...dadosAtleta, id: existente.atleta.id };
    const caso: Caso = { ...dadosCaso, id, atletaId: atleta.id };
    const atual = this.dados();
    this.salvar({
      ...atual,
      casos: atual.casos.map((c) => (c.id === id ? caso : c)),
      atletas: atual.atletas.map((a) => (a.id === atleta.id ? atleta : a)),
    });
    return { caso, atleta };
  }

  /** Exclui o caso, o atleta e as etapas dele; devolve `false` se o id não existe. */
  excluir(id: string): boolean {
    const existente = this.buscarPorId(id);
    if (!existente) {
      return false;
    }
    const atual = this.dados();
    this.salvar({
      casos: atual.casos.filter((c) => c.id !== id),
      atletas: atual.atletas.filter((a) => a.id !== existente.atleta.id),
      etapas: atual.etapas.filter((e) => e.casoId !== id),
    });
    return true;
  }

  /** As 5 etapas do caso, na ordem 1 a 5; vazio se o caso não existe. */
  listarEtapas(casoId: string): EtapaCalculo[] {
    return this.dados()
      .etapas.filter((e) => e.casoId === casoId)
      .sort(porOrdem);
  }

  /**
   * Troca os critérios das etapas do caso. Só aceita as 5 etapas que o caso já tem (mesmos `id`,
   * `casoId`, `tipo` e `ordem`; só os valores de critério mudam). Devolve as etapas guardadas, ou
   * `undefined` sem mudar nada quando o caso não existe ou a lista não é essa. A forma dos valores é
   * conferida pelo formulário. As etapas antigas não são alteradas: a avaliação já gravada numa submissão
   * continua com os critérios da época.
   */
  atualizarEtapas(casoId: string, etapas: readonly EtapaCalculo[]): EtapaCalculo[] | undefined {
    const atual = this.dados();
    if (!atual.casos.some((c) => c.id === casoId)) {
      return undefined;
    }
    const existentes = atual.etapas.filter((e) => e.casoId === casoId);
    const novas = existentes.map((existente) => etapas.find((n) => n.id === existente.id));
    const mesmasCinco =
      etapas.length === existentes.length &&
      existentes.every((existente, i) => {
        const nova = novas[i];
        return nova !== undefined && nova.casoId === casoId && nova.tipo === existente.tipo && nova.ordem === existente.ordem;
      });
    if (!mesmasCinco) {
      return undefined;
    }
    const guardadas = (novas as EtapaCalculo[]).sort(porOrdem);
    this.salvar({ ...atual, etapas: [...atual.etapas.filter((e) => e.casoId !== casoId), ...guardadas] });
    return guardadas;
  }

  private salvar(novo: DadosSalvos): void {
    this.dados.set(novo);
    this.storage.gravar(CHAVE, novo);
  }

  /** Com algo salvo, usa o salvo; na primeira abertura, grava os exemplos. */
  private carregar(): DadosSalvos {
    const salvos = this.storage.ler<DadosSalvos>(CHAVE);
    if (salvos) {
      return salvos;
    }
    const exemplos: DadosSalvos = { casos: CASOS_EXEMPLO, atletas: ATLETAS_EXEMPLO, etapas: ETAPAS_EXEMPLO };
    this.storage.gravar(CHAVE, exemplos);
    return exemplos;
  }
}
