import { Injectable, computed, signal } from '@angular/core';
import { Atleta, Caso, EtapaCalculo, TOLERANCIA_DIETA_PADRAO } from '../models';
import {
  ATLETAS_EXEMPLO,
  CASOS_EXEMPLO,
  ETAPAS_EXEMPLO,
  etapasPadrao,
  PREFIXO_ID_EXEMPLO,
  TIPOS_ETAPA,
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
  /** As 5 etapas de todos os casos, ligadas a cada caso por `casoId`. */
  etapas: EtapaCalculo[];
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

function copiarEtapa(etapa: EtapaCalculo): EtapaCalculo {
  const copia: EtapaCalculo = { ...etapa };
  if (etapa.opcoesAceitaveis) {
    copia.opcoesAceitaveis = [...etapa.opcoesAceitaveis];
  }
  if (etapa.faixaAceitavel) {
    copia.faixaAceitavel = { ...etapa.faixaAceitavel };
  }
  return copia;
}

const porOrdem = (a: EtapaCalculo, b: EtapaCalculo): number => a.ordem - b.ordem;

const ehNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * A forma do critério que cada tipo de etapa precisa ter para o motor funcionar:
 *  - TMB: referência em texto e uma lista não vazia de equações (textos) em `opcoesAceitaveis`;
 *  - GET, CHO, PTN e LIP: referência numérica e `faixaAceitavel` com `min` e `max` numéricos, `min ≤ max`.
 * Só a forma conta (o que está dentro da faixa e o que o docente pode escolher é com o formulário).
 */
function criterioBemFormado(etapa: Partial<EtapaCalculo>): boolean {
  if (etapa.tipo === 'TMB') {
    const opcoes: unknown = etapa.opcoesAceitaveis;
    return (
      typeof etapa.parametroReferencia === 'string' &&
      Array.isArray(opcoes) &&
      opcoes.length > 0 &&
      opcoes.every((o) => typeof o === 'string')
    );
  }
  const faixa: unknown = etapa.faixaAceitavel;
  if (!ehNumero(etapa.parametroReferencia) || typeof faixa !== 'object' || faixa === null) {
    return false;
  }
  const { min, max } = faixa as { min?: unknown; max?: unknown };
  return ehNumero(min) && ehNumero(max) && min <= max;
}

/** Dado salvo que parece uma etapa; o que vier torto é descartado na carga, sem quebrar. */
function etapaBemFormada(e: unknown): e is EtapaCalculo {
  const etapa = e as Partial<EtapaCalculo> | null;
  return (
    typeof etapa === 'object' &&
    etapa !== null &&
    typeof etapa.id === 'string' &&
    typeof etapa.casoId === 'string' &&
    typeof etapa.ordem === 'number' &&
    TIPOS_ETAPA.includes(etapa.tipo as EtapaCalculo['tipo']) &&
    (typeof etapa.parametroReferencia === 'string' || Number.isFinite(etapa.parametroReferencia)) &&
    ehNumero(etapa.tolerancia) &&
    etapa.tolerancia > 0 &&
    typeof etapa.criterioReferencia === 'string' &&
    criterioBemFormado(etapa)
  );
}

/** As etapas são exatamente as 5 do caso: uma de cada tipo, com a ordem 1 a 5 na ordem dos tipos. */
function conjuntoCompleto(etapas: EtapaCalculo[]): boolean {
  const ordenadas = [...etapas].sort(porOrdem);
  return ordenadas.length === TIPOS_ETAPA.length && ordenadas.every((e, i) => e.tipo === TIPOS_ETAPA[i] && e.ordem === i + 1);
}

function gerarId(prefixo: string): string {
  return `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Casos, fichas de atleta e as 5 etapas de cálculo de cada caso, guardados no navegador pelo StorageService.
 * `casos` é um signal: as telas que o leem atualizam sozinhas depois de criar, editar ou excluir.
 * Os objetos do signal são cópias compartilhadas por quem o lê até a próxima mudança: telas só
 * leem. Para editar, use `buscarPorId`, que devolve uma cópia nova a cada chamada.
 */
@Injectable({ providedIn: 'root' })
export class CasoService {
  private readonly dados = signal<DadosSalvos>({ versao: VERSAO_CASOS_EXEMPLO, casos: [], atletas: [], etapas: [] });

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
      etapas: [...atual.etapas, ...etapasPadrao(caso.id)],
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
      etapas: atual.etapas.filter((e) => e.casoId !== id),
    });
    return true;
  }

  /** As 5 etapas do caso, em cópias, na ordem 1 a 5; vazio se o caso não existe. */
  listarEtapas(casoId: string): EtapaCalculo[] {
    return this.dados()
      .etapas.filter((e) => e.casoId === casoId)
      .sort(porOrdem)
      .map(copiarEtapa);
  }

  /**
   * Troca os critérios das etapas do caso. Só aceita as 5 etapas que o caso já tem (mesmos `id`,
   * `casoId`, `tipo` e `ordem`; só os valores de critério mudam). Devolve as etapas guardadas, ou
   * `undefined` sem mudar nada quando o caso não existe ou a lista não é essa.
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
        return (
          nova !== undefined &&
          etapaBemFormada(nova) &&
          nova.casoId === casoId &&
          nova.tipo === existente.tipo &&
          nova.ordem === existente.ordem
        );
      });
    if (!mesmasCinco) {
      return undefined;
    }
    const guardadas = (novas as EtapaCalculo[]).map(copiarEtapa).sort(porOrdem);
    this.salvar({ ...atual, etapas: [...atual.etapas.filter((e) => e.casoId !== casoId), ...guardadas] });
    return guardadas.map(copiarEtapa);
  }

  private salvar(novo: DadosSalvos): void {
    this.dados.set(novo);
    this.storage.gravar(CHAVE, novo);
  }

  /**
   * Primeira abertura (ou dado ilegível): grava os exemplos.
   * Versão diferente da atual: troca os exemplos antigos pelos atuais e mantém os casos do usuário.
   * Em toda abertura os dados salvos são normalizados (veja `normalizar`), então dado de versão
   * antiga ou sem a lista de etapas carrega sem quebrar.
   */
  private carregar(): DadosSalvos {
    const salvos = this.lerSalvos();
    if (!salvos) {
      return this.gravarEDevolver({
        versao: VERSAO_CASOS_EXEMPLO,
        casos: CASOS_EXEMPLO.map(copiarCaso),
        atletas: ATLETAS_EXEMPLO.map(copiarAtleta),
        etapas: ETAPAS_EXEMPLO.map(copiarEtapa),
      });
    }
    if (salvos.versao === VERSAO_CASOS_EXEMPLO) {
      const { dados, alterado } = this.normalizar(salvos);
      return alterado ? this.gravarEDevolver(dados) : dados;
    }
    const doUsuario = (casoId: string): boolean => !casoId.startsWith(PREFIXO_ID_EXEMPLO);
    return this.gravarEDevolver(
      this.normalizar({
        versao: VERSAO_CASOS_EXEMPLO,
        casos: [...CASOS_EXEMPLO.map(copiarCaso), ...salvos.casos.filter((c) => doUsuario(c.id))],
        atletas: [...ATLETAS_EXEMPLO.map(copiarAtleta), ...salvos.atletas.filter((a) => !a.id.startsWith(PREFIXO_ID_EXEMPLO))],
        etapas: [...ETAPAS_EXEMPLO.map(copiarEtapa), ...salvos.etapas.filter((e) => doUsuario(e.casoId))],
      }).dados,
    );
  }

  /**
   * Deixa os dados salvos no formato atual, sem perder nada do usuário:
   *  - caso sem `toleranciaDieta` (ou com valor inválido): recebe `TOLERANCIA_DIETA_PADRAO`;
   *  - caso sem as 5 etapas completas: recebe `etapasPadrao`;
   *  - etapa com a forma do critério errada (veja `criterioBemFormado`): descartada, e o caso volta às 5 etapas padrão;
   *  - etapa de caso que não existe mais: descartada.
   * `alterado` diz se algo mudou, para só regravar quando preciso.
   */
  private normalizar(dados: DadosSalvos): { dados: DadosSalvos; alterado: boolean } {
    let alterado = false;
    const casos = dados.casos.map((caso) => {
      const tolerancia: unknown = caso.toleranciaDieta;
      if (typeof tolerancia === 'number' && Number.isFinite(tolerancia) && tolerancia >= 0) {
        return caso;
      }
      alterado = true;
      return { ...caso, toleranciaDieta: TOLERANCIA_DIETA_PADRAO };
    });

    const etapas: EtapaCalculo[] = [];
    for (const caso of casos) {
      const doCaso = dados.etapas.filter((e) => e.casoId === caso.id);
      if (conjuntoCompleto(doCaso)) {
        etapas.push(...doCaso.sort(porOrdem));
      } else {
        alterado = true;
        etapas.push(...etapasPadrao(caso.id));
      }
    }
    if (etapas.length !== dados.etapas.length) {
      alterado = true;
    }
    return { dados: { ...dados, casos, etapas }, alterado };
  }

  private lerSalvos(): DadosSalvos | null {
    const lido = this.storage.ler<Partial<DadosSalvos>>(CHAVE);
    if (lido && typeof lido.versao === 'number' && Array.isArray(lido.casos) && Array.isArray(lido.atletas)) {
      // Dado salvo antes das etapas existirem não tem a lista: vira vazia e a normalização preenche.
      const etapas = Array.isArray(lido.etapas) ? lido.etapas.filter(etapaBemFormada) : [];
      return { versao: lido.versao, casos: lido.casos, atletas: lido.atletas, etapas };
    }
    return null;
  }

  private gravarEDevolver(dados: DadosSalvos): DadosSalvos {
    this.storage.gravar(CHAVE, dados);
    return dados;
  }
}
