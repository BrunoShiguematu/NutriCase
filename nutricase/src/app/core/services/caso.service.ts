import { Injectable, computed, signal } from '@angular/core';
import { Atleta, Caso, EtapaCalculo } from '../models';
import { ATLETAS_EXEMPLO, CASOS_EXEMPLO, ETAPAS_EXEMPLO, etapasPadrao } from '../data/casos-exemplo';
import { StorageService } from './storage.service';

export type DadosCaso = Omit<Caso, 'id' | 'atletaId'>;
export type DadosAtleta = Omit<Atleta, 'id'>;

export interface CasoComAtleta {
  readonly caso: Caso;
  readonly atleta: Atleta;
}

interface DadosSalvos {
  readonly casos: readonly Caso[];
  readonly atletas: readonly Atleta[];
  readonly etapas: readonly EtapaCalculo[];
}

const CHAVE = 'nutricase.casos';

const porOrdem = (a: EtapaCalculo, b: EtapaCalculo): number => a.ordem - b.ordem;

function gerarId(prefixo: string): string {
  return `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

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

  listarEtapas(casoId: string): EtapaCalculo[] {
    return this.dados()
      .etapas.filter((e) => e.casoId === casoId)
      .sort(porOrdem);
  }

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
