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
  /**
   * Ids dos exemplos que o usuário editou (o caso, a ficha ou as etapas). Na troca de versão dos
   * exemplos, esses ficam como o usuário deixou. Dado antigo, sem o campo, vale como lista vazia.
   */
  exemplosEditados: string[];
  /** Ids dos exemplos que o usuário excluiu; na troca de versão eles não voltam. */
  exemplosExcluidos: string[];
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

/** Dado salvo que dá para reconhecer como etapa de um caso; o que não der é descartado na carga, sem quebrar. */
function etapaIdentificavel(e: unknown): e is EtapaCalculo {
  const etapa = e as Partial<EtapaCalculo> | null;
  return (
    typeof etapa === 'object' &&
    etapa !== null &&
    typeof etapa.id === 'string' &&
    typeof etapa.casoId === 'string' &&
    typeof etapa.ordem === 'number' &&
    TIPOS_ETAPA.includes(etapa.tipo as EtapaCalculo['tipo'])
  );
}

/** Etapa com todos os campos e o critério na forma certa; senão, a normalização a troca pela padrão do tipo. */
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

const ehExemplo = (id: string): boolean => id.startsWith(PREFIXO_ID_EXEMPLO);

/** Os mesmos dados, sem depender da ordem das chaves (o JSON já ignora chaves com `undefined`). */
function iguais(a: unknown, b: unknown): boolean {
  const normal = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(normal)
      : v !== null && typeof v === 'object'
        ? Object.fromEntries(Object.entries(v).sort(([x], [y]) => x.localeCompare(y)).map(([k, x]) => [k, normal(x)]))
        : v;
  return JSON.stringify(normal(a)) === JSON.stringify(normal(b));
}

/** Uma lista de ids de exemplo guardada: só textos com o prefixo de exemplo, sem repetição; o resto é descartado. */
function idsDeExemplo(lista: unknown): string[] {
  return Array.isArray(lista) ? [...new Set(lista.filter((id): id is string => typeof id === 'string' && ehExemplo(id)))] : [];
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
  private readonly dados = signal<DadosSalvos>({
    versao: VERSAO_CASOS_EXEMPLO,
    casos: [],
    atletas: [],
    etapas: [],
    exemplosEditados: [],
    exemplosExcluidos: [],
  });

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
    // Só conta como edição se algo mudou: salvar o formulário sem mexer em nada não "gasta" o exemplo.
    const mudou = !iguais(existente.caso, caso) || !iguais(existente.atleta, atleta);
    this.salvar({
      ...atual,
      casos: atual.casos.map((c) => (c.id === id ? caso : c)),
      atletas: atual.atletas.map((a) => (a.id === atleta.id ? atleta : a)),
      exemplosEditados: mudou ? this.marcarEditado(atual, id) : atual.exemplosEditados,
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
      // Um exemplo excluído não volta na troca de versão, mesmo que antes tivesse sido editado.
      exemplosEditados: atual.exemplosEditados.filter((e) => e !== id),
      exemplosExcluidos: ehExemplo(id) && !atual.exemplosExcluidos.includes(id) ? [...atual.exemplosExcluidos, id] : atual.exemplosExcluidos,
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
    const mudou = !iguais([...existentes].sort(porOrdem), guardadas);
    this.salvar({
      ...atual,
      etapas: [...atual.etapas.filter((e) => e.casoId !== casoId), ...guardadas],
      exemplosEditados: mudou ? this.marcarEditado(atual, casoId) : atual.exemplosEditados,
    });
    return guardadas.map(copiarEtapa);
  }

  /** A lista de exemplos editados com este caso incluído, se ele for um exemplo. */
  private marcarEditado(dados: DadosSalvos, casoId: string): string[] {
    return ehExemplo(casoId) && !dados.exemplosEditados.includes(casoId) ? [...dados.exemplosEditados, casoId] : dados.exemplosEditados;
  }

  private salvar(novo: DadosSalvos): void {
    this.dados.set(novo);
    this.storage.gravar(CHAVE, novo);
  }

  /**
   * Primeira abertura (ou dado ilegível): grava os exemplos.
   * Versão diferente da atual: os exemplos intactos são trocados pelos atuais e os casos do usuário
   * ficam. Um exemplo que o usuário editou (caso, ficha e etapas) fica como ele deixou, e um que ele
   * excluiu não volta. Os ids não mudam, então as resoluções ligadas aos exemplos continuam abrindo.
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
        exemplosEditados: [],
        exemplosExcluidos: [],
      });
    }
    if (salvos.versao === VERSAO_CASOS_EXEMPLO) {
      const { dados, alterado } = this.normalizar(salvos);
      return alterado ? this.gravarEDevolver(dados) : dados;
    }

    const excluidos = new Set(salvos.exemplosExcluidos);
    // Ficam como estão: os casos do usuário e os exemplos que ele editou (se ainda estão salvos).
    const mantidos = salvos.casos.filter((c) => !ehExemplo(c.id) || salvos.exemplosEditados.includes(c.id));
    const idsMantidos = new Set(mantidos.map((c) => c.id));
    const atletasMantidos = new Set(mantidos.map((c) => c.atletaId));
    // Entram os exemplos atuais que o usuário não excluiu nem editou.
    const novos = CASOS_EXEMPLO.filter((c) => !excluidos.has(c.id) && !idsMantidos.has(c.id));
    const atletasNovos = new Set(novos.map((c) => c.atletaId));
    return this.gravarEDevolver(
      this.normalizar({
        versao: VERSAO_CASOS_EXEMPLO,
        casos: [...novos.map(copiarCaso), ...mantidos],
        atletas: [
          ...ATLETAS_EXEMPLO.filter((a) => atletasNovos.has(a.id)).map(copiarAtleta),
          ...salvos.atletas.filter((a) => (ehExemplo(a.id) ? atletasMantidos.has(a.id) : true)),
        ],
        etapas: [
          ...ETAPAS_EXEMPLO.filter((e) => novos.some((c) => c.id === e.casoId)).map(copiarEtapa),
          ...salvos.etapas.filter((e) => idsMantidos.has(e.casoId)),
        ],
        exemplosEditados: salvos.exemplosEditados.filter((id) => idsMantidos.has(id)),
        exemplosExcluidos: salvos.exemplosExcluidos,
      }).dados,
    );
  }

  /**
   * Deixa os dados salvos no formato atual, sem perder nada do usuário:
   *  - caso sem `toleranciaDieta` (ou com valor inválido: não numérico, zero ou negativo): recebe `TOLERANCIA_DIETA_PADRAO`;
   *  - caso sem as 5 etapas completas: recebe `etapasPadrao`;
   *  - etapa com a forma do critério errada (veja `criterioBemFormado`): trocada só por ela mesma, pela padrão do mesmo tipo (as outras 4 ficam);
   *  - etapa de caso que não existe mais: descartada.
   * `alterado` diz se algo mudou, para só regravar quando preciso.
   */
  private normalizar(dados: DadosSalvos): { dados: DadosSalvos; alterado: boolean } {
    let alterado = false;
    const casos = dados.casos.map((caso) => {
      const tolerancia: unknown = caso.toleranciaDieta;
      if (typeof tolerancia === 'number' && Number.isFinite(tolerancia) && tolerancia > 0) {
        return caso;
      }
      alterado = true;
      return { ...caso, toleranciaDieta: TOLERANCIA_DIETA_PADRAO };
    });

    const etapas: EtapaCalculo[] = [];
    for (const caso of casos) {
      const doCaso = dados.etapas.filter((e) => e.casoId === caso.id);
      if (conjuntoCompleto(doCaso)) {
        const padrao = etapasPadrao(caso.id);
        for (const etapa of doCaso.sort(porOrdem)) {
          const tipo = etapa.tipo;
          if (etapaBemFormada(etapa)) {
            etapas.push(etapa);
          } else {
            alterado = true;
            etapas.push(padrao.find((p) => p.tipo === tipo) as EtapaCalculo);
          }
        }
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
    const lido = this.storage.ler<Partial<Record<keyof DadosSalvos, unknown>>>(CHAVE);
    if (lido && typeof lido.versao === 'number' && Array.isArray(lido.casos) && Array.isArray(lido.atletas)) {
      // Dado salvo antes das etapas existirem não tem a lista: vira vazia e a normalização preenche.
      // Fica o que dá para identificar (caso, tipo e ordem); a forma do critério é conferida na normalização.
      const etapas = Array.isArray(lido.etapas) ? lido.etapas.filter(etapaIdentificavel) : [];
      return {
        versao: lido.versao,
        casos: lido.casos,
        atletas: lido.atletas,
        etapas,
        // Dado salvo antes destas listas existirem não as tem: vale como vazia (nenhum exemplo editado ou excluído).
        exemplosEditados: idsDeExemplo(lido.exemplosEditados),
        exemplosExcluidos: idsDeExemplo(lido.exemplosExcluidos),
      };
    }
    return null;
  }

  private gravarEDevolver(dados: DadosSalvos): DadosSalvos {
    this.storage.gravar(CHAVE, dados);
    return dados;
  }
}
