import { Injectable, computed, signal } from '@angular/core';
import { AvaliacaoDieta, avaliarDieta, MetasDoAluno } from '../avaliacao/avaliar-dieta';
import { AvaliacaoEtapa, avaliarEtapas } from '../avaliacao/avaliar-etapas';
import {
  Classificacao,
  EtapaCalculo,
  ItemRefeicao,
  MarcadorRefeicao,
  Refeicao,
  Resolucao,
  RespostaEtapa,
  ResumoErros,
  StatusResolucao,
  TIPOS_ERRO,
} from '../models';
import { AlimentoService } from './alimento.service';
import { CasoService } from './caso.service';
import { StorageService } from './storage.service';

const CHAVE = 'nutricase.resolucoes';
const VERSAO = 1;

// Movidos para os modelos para o cálculo dos KPIs (sem Angular) importá-los; o serviço os reexporta.
export { TIPOS_ERRO };
export type { ResumoErros };

/** Algo que impede submeter (UC06, fluxo 2a). */
export interface Pendencia {
  tipo: 'etapa' | 'dieta';
  /** Só nas pendências de etapa. */
  etapaId?: string;
  texto: string;
}

export interface DadosRefeicao {
  nome: string;
  /** "HH:mm". */
  horario: string;
  marcador: MarcadorRefeicao;
}

export interface DadosItem {
  alimentoId: string;
  quantidadeGramas: number;
}

export interface ContagemEtapas {
  corretas: number;
  divergentes: number;
  comErro: number;
}

/** Uma etapa no resultado: o critério usado na correção, a resposta com a classificação e a explicação. */
export interface ResultadoEtapa {
  /** A etapa como estava quando a tentativa foi submetida (o docente pode editá-la depois). */
  etapa: EtapaCalculo;
  resposta: RespostaEtapa;
  avaliacao: AvaliacaoEtapa;
}

export interface ResultadoResolucao {
  resolucao: Resolucao;
  /** A avaliação gravada na submissão, na ordem das etapas (RF21–RF23). */
  etapas: ResultadoEtapa[];
  /** As metas que o estudante calculou: GET → kcal; CHO, PTN e LIP → gramas (RN05). */
  metasDoAluno: Required<{ [K in keyof MetasDoAluno]: number }>;
  /**
   * A dieta, recalculada agora com a base de alimentos e a tolerância do caso (RF24–RF27).
   * Ausente quando a base de alimentos não carregou: o resto do resultado continua valendo.
   */
  dieta?: AvaliacaoDieta;
  /** Contagem pelos 5 tipos (RF34), a partir do que foi gravado na submissão. */
  resumoErros: ResumoErros;
  /** O comentário de referência do caso (RF36). */
  comentarioReferencia: string;
}

/** O que a submissão grava além do status: a avaliação feita naquele momento. */
interface Submissao {
  resolucaoId: string;
  /** Resultado de `avaliarDieta` na submissão; alimenta o resumo "dieta fora das metas". */
  dietaForaDasMetas: boolean;
  /** As etapas (critérios) usadas na correção. */
  etapas: EtapaCalculo[];
  avaliacoes: AvaliacaoEtapa[];
}

interface DadosSalvos {
  versao: number;
  resolucoes: Resolucao[];
  respostas: RespostaEtapa[];
  refeicoes: Refeicao[];
  itens: ItemRefeicao[];
  submissoes: Submissao[];
}

const MARCADORES: readonly MarcadorRefeicao[] = ['pré-treino', 'pós-treino', 'nenhum'];
const STATUS: readonly StatusResolucao[] = ['em andamento', 'submetida'];
const CLASSIFICACOES: readonly Classificacao[] = ['correta', 'divergente', 'erro de fato'];
const HORARIO = /^([01]\d|2[0-3]):[0-5]\d$/;

function dadosVazios(): DadosSalvos {
  return { versao: VERSAO, resolucoes: [], respostas: [], refeicoes: [], itens: [], submissoes: [] };
}

function gerarId(prefixo: string): string {
  return `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Cópia profunda de dado simples (só JSON): ninguém recebe nem guarda referência ao estado interno. */
function clonar<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T;
}

const ehNumeroFinito = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const ehTexto = (v: unknown): v is string => typeof v === 'string';

function parametroValido(parametro: unknown): parametro is string | number {
  return (ehTexto(parametro) && parametro.trim() !== '') || ehNumeroFinito(parametro);
}

function respostaValida(r: RespostaEtapa): boolean {
  return parametroValido(r.parametro) && ehNumeroFinito(r.valor);
}

/** Dado salvo que parece o que deveria ser; o que vier torto é descartado na carga, sem quebrar. */
function resolucaoBemFormada(r: unknown): r is Resolucao {
  const x = r as Partial<Resolucao> | null;
  return (
    typeof x === 'object' &&
    x !== null &&
    ehTexto(x.id) &&
    ehTexto(x.casoId) &&
    ehTexto(x.data) &&
    STATUS.includes(x.status as StatusResolucao) &&
    ehTexto(x.justificativa) &&
    (x.submetidaEm === undefined || ehTexto(x.submetidaEm))
  );
}

function respostaBemFormada(r: unknown): r is RespostaEtapa {
  const x = r as Partial<RespostaEtapa> | null;
  return (
    typeof x === 'object' &&
    x !== null &&
    ehTexto(x.id) &&
    ehTexto(x.resolucaoId) &&
    ehTexto(x.etapaId) &&
    parametroValido(x.parametro) &&
    ehNumeroFinito(x.valor) &&
    (x.classificacao === undefined || CLASSIFICACOES.includes(x.classificacao)) &&
    (x.tipoErro === undefined || TIPOS_ERRO.includes(x.tipoErro))
  );
}

function refeicaoBemFormada(r: unknown): r is Refeicao {
  const x = r as Partial<Refeicao> | null;
  return (
    typeof x === 'object' &&
    x !== null &&
    ehTexto(x.id) &&
    ehTexto(x.resolucaoId) &&
    ehTexto(x.nome) &&
    ehTexto(x.horario) &&
    MARCADORES.includes(x.marcador as MarcadorRefeicao)
  );
}

function itemBemFormado(i: unknown): i is ItemRefeicao {
  const x = i as Partial<ItemRefeicao> | null;
  return (
    typeof x === 'object' &&
    x !== null &&
    ehTexto(x.id) &&
    ehTexto(x.refeicaoId) &&
    ehTexto(x.alimentoId) &&
    ehNumeroFinito(x.quantidadeGramas) &&
    x.quantidadeGramas >= 0
  );
}

function submissaoBemFormada(s: unknown): s is Submissao {
  const x = s as Partial<Submissao> | null;
  return (
    typeof x === 'object' &&
    x !== null &&
    ehTexto(x.resolucaoId) &&
    typeof x.dietaForaDasMetas === 'boolean' &&
    Array.isArray(x.etapas) &&
    Array.isArray(x.avaliacoes)
  );
}

/** Refeição com os campos válidos e aparados, ou `undefined`. */
function refeicaoValida(dados: DadosRefeicao): DadosRefeicao | undefined {
  const nome = ehTexto(dados?.nome) ? dados.nome.trim() : '';
  if (nome === '' || !ehTexto(dados.horario) || !HORARIO.test(dados.horario) || !MARCADORES.includes(dados.marcador)) {
    return undefined;
  }
  return { nome, horario: dados.horario, marcador: dados.marcador };
}

const alimentoIdValido = (id: unknown): id is string => ehTexto(id) && id.trim() !== '';
const quantidadeValida = (q: unknown): q is number => ehNumeroFinito(q) && q > 0;

/**
 * As tentativas do estudante: resolução, respostas das etapas, refeições e itens da dieta (UC02–UC06, UC08).
 * Guardadas no navegador pelo StorageService, no mesmo padrão do CasoService: `resolucoes` é um signal,
 * tudo que sai é cópia, e dado salvo ruim é descartado ou consertado na carga em vez de quebrar.
 *
 * Funções de edição (responder, refeições, itens, justificativa) devolvem `undefined` ou `false`, sem mudar
 * nada, quando o id não existe, o dado é inválido ou a tentativa já foi submetida: uma tentativa submetida
 * não aceita mais edição. Nada de certo ou errado existe antes da submissão (RF09).
 *
 * `submeter` e `resultado` são **assíncronas**: precisam da base de alimentos (a dieta vira kcal e gramas
 * por ela) e esperam `AlimentoService.carregar()`, que é rápido quando a base já está pronta. Sem esperar, o
 * total da dieta seria 0 e a dieta apareceria fora das metas por engano. Quem chama só usa `await`.
 *
 * Tentativa de um caso que foi excluído continua guardada, mas só pode ser excluída ou refeita (esta
 * devolve `undefined`): sem o caso não há etapas nem atleta para corrigir ou mostrar.
 */
@Injectable({ providedIn: 'root' })
export class ResolucaoService {
  private readonly dados = signal<DadosSalvos>(dadosVazios());

  /** Todas as tentativas, a mais recente primeiro, para as telas atualizarem sozinhas. */
  readonly resolucoes = computed(() => this.ordenadas(this.dados().resolucoes));

  constructor(
    private readonly storage: StorageService,
    private readonly casos: CasoService,
    private readonly alimentos: AlimentoService,
  ) {
    this.dados.set(this.carregar());
  }

  // ---------- tentativas ----------

  /** Começa uma tentativa "em andamento" do caso; `undefined` se o caso não existe. */
  iniciar(casoId: string): Resolucao | undefined {
    if (!this.casos.buscarPorId(casoId)) {
      return undefined;
    }
    const resolucao: Resolucao = {
      id: gerarId('resolucao'),
      casoId,
      data: new Date().toISOString(),
      status: 'em andamento',
      justificativa: '',
    };
    const atual = this.dados();
    this.salvar({ ...atual, resolucoes: [...atual.resolucoes, resolucao] });
    return { ...resolucao };
  }

  buscar(id: string): Resolucao | undefined {
    const achada = this.dados().resolucoes.find((r) => r.id === id);
    return achada ? { ...achada } : undefined;
  }

  /** Todas as tentativas, a mais recente primeiro. */
  listar(): Resolucao[] {
    return this.ordenadas(this.dados().resolucoes);
  }

  /** Nova tentativa do mesmo caso, sem copiar nada da anterior; `undefined` se a tentativa ou o caso não existem. */
  refazer(id: string): Resolucao | undefined {
    const anterior = this.buscar(id);
    return anterior ? this.iniciar(anterior.casoId) : undefined;
  }

  /** Exclui a tentativa e, em cascata, as respostas, refeições, itens e a avaliação dela. */
  excluir(id: string): boolean {
    const atual = this.dados();
    if (!atual.resolucoes.some((r) => r.id === id)) {
      return false;
    }
    const refeicoesIds = new Set(atual.refeicoes.filter((r) => r.resolucaoId === id).map((r) => r.id));
    this.salvar({
      ...atual,
      resolucoes: atual.resolucoes.filter((r) => r.id !== id),
      respostas: atual.respostas.filter((r) => r.resolucaoId !== id),
      refeicoes: atual.refeicoes.filter((r) => r.resolucaoId !== id),
      itens: atual.itens.filter((i) => !refeicoesIds.has(i.refeicaoId)),
      submissoes: atual.submissoes.filter((s) => s.resolucaoId !== id),
    });
    return true;
  }

  // ---------- etapas ----------

  /** As respostas da tentativa, em cópias, na ordem das etapas do caso. */
  listarRespostas(resolucaoId: string): RespostaEtapa[] {
    const ordem = new Map(this.casos.listarEtapas(this.buscar(resolucaoId)?.casoId ?? '').map((e) => [e.id, e.ordem]));
    return this.dados()
      .respostas.filter((r) => r.resolucaoId === resolucaoId)
      .sort((a, b) => (ordem.get(a.etapaId) ?? 99) - (ordem.get(b.etapaId) ?? 99))
      .map((r) => ({ ...r }));
  }

  /**
   * Guarda a resposta da etapa, substituindo a anterior da mesma etapa. `undefined` se a tentativa não
   * existe ou já foi submetida, se a etapa não é uma das 5 do caso, ou se o parâmetro ou o valor não são
   * válidos (parâmetro: texto não vazio ou número finito; valor: número finito).
   */
  salvarResposta(resolucaoId: string, etapaId: string, parametro: string | number, valor: number): RespostaEtapa | undefined {
    const resolucao = this.emAndamento(resolucaoId);
    if (!resolucao || !this.casos.listarEtapas(resolucao.casoId).some((e) => e.id === etapaId)) {
      return undefined;
    }
    if (!parametroValido(parametro) || !ehNumeroFinito(valor)) {
      return undefined;
    }
    const atual = this.dados();
    const anterior = atual.respostas.find((r) => r.resolucaoId === resolucaoId && r.etapaId === etapaId);
    const resposta: RespostaEtapa = {
      id: anterior?.id ?? gerarId('resposta'),
      resolucaoId,
      etapaId,
      parametro: typeof parametro === 'string' ? parametro.trim() : parametro,
      valor,
    };
    this.salvar({
      ...atual,
      respostas: anterior
        ? atual.respostas.map((r) => (r === anterior ? resposta : r))
        : [...atual.respostas, resposta],
    });
    return { ...resposta };
  }

  // ---------- dieta ----------

  /** As refeições da tentativa, em cópias, na ordem em que foram criadas. */
  listarRefeicoes(resolucaoId: string): Refeicao[] {
    return this.dados()
      .refeicoes.filter((r) => r.resolucaoId === resolucaoId)
      .map((r) => ({ ...r }));
  }

  /** Os itens de uma refeição, em cópias. */
  listarItens(refeicaoId: string): ItemRefeicao[] {
    return this.dados()
      .itens.filter((i) => i.refeicaoId === refeicaoId)
      .map((i) => ({ ...i }));
  }

  /** Os itens de todas as refeições da tentativa, em cópias. */
  listarItensDaResolucao(resolucaoId: string): ItemRefeicao[] {
    const ids = new Set(this.listarRefeicoes(resolucaoId).map((r) => r.id));
    return this.dados()
      .itens.filter((i) => ids.has(i.refeicaoId))
      .map((i) => ({ ...i }));
  }

  /** Nome não vazio, horário "HH:mm" e marcador válido; senão `undefined`. */
  criarRefeicao(resolucaoId: string, dados: DadosRefeicao): Refeicao | undefined {
    const valida = refeicaoValida(dados);
    if (!valida || !this.emAndamento(resolucaoId)) {
      return undefined;
    }
    const refeicao: Refeicao = { id: gerarId('refeicao'), resolucaoId, ...valida };
    const atual = this.dados();
    this.salvar({ ...atual, refeicoes: [...atual.refeicoes, refeicao] });
    return { ...refeicao };
  }

  atualizarRefeicao(refeicaoId: string, dados: DadosRefeicao): Refeicao | undefined {
    const valida = refeicaoValida(dados);
    const atual = this.dados();
    const existente = atual.refeicoes.find((r) => r.id === refeicaoId);
    if (!valida || !existente || !this.emAndamento(existente.resolucaoId)) {
      return undefined;
    }
    const nova: Refeicao = { ...existente, ...valida };
    this.salvar({ ...atual, refeicoes: atual.refeicoes.map((r) => (r === existente ? nova : r)) });
    return { ...nova };
  }

  /** Exclui a refeição e os itens dela. */
  excluirRefeicao(refeicaoId: string): boolean {
    const atual = this.dados();
    const existente = atual.refeicoes.find((r) => r.id === refeicaoId);
    if (!existente || !this.emAndamento(existente.resolucaoId)) {
      return false;
    }
    this.salvar({
      ...atual,
      refeicoes: atual.refeicoes.filter((r) => r !== existente),
      itens: atual.itens.filter((i) => i.refeicaoId !== refeicaoId),
    });
    return true;
  }

  /**
   * Alimento (id não vazio) e quantidade maior que zero. O serviço não confere se o alimento existe na
   * base: a tela escolhe da lista, e um id que sumiu da base conta como item incompleto na avaliação.
   */
  criarItem(refeicaoId: string, dados: DadosItem): ItemRefeicao | undefined {
    const refeicao = this.dados().refeicoes.find((r) => r.id === refeicaoId);
    if (!refeicao || !this.emAndamento(refeicao.resolucaoId)) {
      return undefined;
    }
    if (!alimentoIdValido(dados?.alimentoId) || !quantidadeValida(dados.quantidadeGramas)) {
      return undefined;
    }
    const item: ItemRefeicao = { id: gerarId('item'), refeicaoId, alimentoId: dados.alimentoId, quantidadeGramas: dados.quantidadeGramas };
    const atual = this.dados();
    this.salvar({ ...atual, itens: [...atual.itens, item] });
    return { ...item };
  }

  /** Muda o alimento e/ou a quantidade do item; só o que vier é validado e trocado. */
  atualizarItem(itemId: string, dados: Partial<DadosItem>): ItemRefeicao | undefined {
    const atual = this.dados();
    const existente = atual.itens.find((i) => i.id === itemId);
    const refeicao = existente && atual.refeicoes.find((r) => r.id === existente.refeicaoId);
    if (!existente || !refeicao || !this.emAndamento(refeicao.resolucaoId)) {
      return undefined;
    }
    if (dados.alimentoId !== undefined && !alimentoIdValido(dados.alimentoId)) {
      return undefined;
    }
    if (dados.quantidadeGramas !== undefined && !quantidadeValida(dados.quantidadeGramas)) {
      return undefined;
    }
    const novo: ItemRefeicao = {
      ...existente,
      ...(dados.alimentoId !== undefined ? { alimentoId: dados.alimentoId } : {}),
      ...(dados.quantidadeGramas !== undefined ? { quantidadeGramas: dados.quantidadeGramas } : {}),
    };
    this.salvar({ ...atual, itens: atual.itens.map((i) => (i === existente ? novo : i)) });
    return { ...novo };
  }

  excluirItem(itemId: string): boolean {
    const atual = this.dados();
    const existente = atual.itens.find((i) => i.id === itemId);
    const refeicao = existente && atual.refeicoes.find((r) => r.id === existente.refeicaoId);
    if (!existente || !refeicao || !this.emAndamento(refeicao.resolucaoId)) {
      return false;
    }
    this.salvar({ ...atual, itens: atual.itens.filter((i) => i !== existente) });
    return true;
  }

  // ---------- justificativa, pendências e submissão ----------

  /** A justificativa nunca é avaliada (RN10). */
  salvarJustificativa(resolucaoId: string, texto: string): Resolucao | undefined {
    const resolucao = this.emAndamento(resolucaoId);
    if (!resolucao || !ehTexto(texto)) {
      return undefined;
    }
    const nova: Resolucao = { ...resolucao, justificativa: texto };
    const atual = this.dados();
    this.salvar({ ...atual, resolucoes: atual.resolucoes.map((r) => (r.id === resolucaoId ? nova : r)) });
    return { ...nova };
  }

  /**
   * O que falta para poder submeter (UC06, fluxo 2a): cada etapa do caso sem resposta válida, na ordem, e
   * "dieta sem itens". Vazia quando já dá para submeter. `undefined` se a tentativa não existe.
   */
  pendencias(resolucaoId: string): Pendencia[] | undefined {
    const resolucao = this.dados().resolucoes.find((r) => r.id === resolucaoId);
    if (!resolucao) {
      return undefined;
    }
    const respondidas = new Set(
      this.dados()
        .respostas.filter((r) => r.resolucaoId === resolucaoId && respostaValida(r))
        .map((r) => r.etapaId),
    );
    const pendencias: Pendencia[] = this.casos
      .listarEtapas(resolucao.casoId)
      .filter((e) => !respondidas.has(e.id))
      .map((e) => ({ tipo: 'etapa', etapaId: e.id, texto: `Etapa ${e.ordem} (${e.tipo}) sem resposta.` }));
    if (this.listarItensDaResolucao(resolucaoId).length === 0) {
      pendencias.push({ tipo: 'dieta', texto: 'A dieta não tem nenhum item.' });
    }
    return pendencias;
  }

  /**
   * Submete a tentativa: corrige as etapas (`avaliarEtapas`, com o atleta e as etapas do caso) e a dieta
   * (`avaliarDieta`, contra as metas do estudante), grava a classificação e o tipo de erro nas respostas e
   * deixa a tentativa "submetida", com `submetidaEm`. Também guarda a avaliação feita (etapas, critérios e se
   * a dieta ficou fora das metas), para o resultado e o resumo não mudarem se o caso for editado depois.
   *
   * Devolve `undefined`, sem mudar nada, quando: a tentativa não existe, já foi submetida, o caso sumiu,
   * há pendências (consulte `pendencias` para mostrar quais) ou a base de alimentos não carregou.
   */
  async submeter(resolucaoId: string): Promise<Resolucao | undefined> {
    if (!this.podeSubmeter(resolucaoId)) {
      return undefined;
    }
    await this.alimentos.carregar();
    if (this.alimentos.estado() !== 'pronto') {
      return undefined;
    }
    // O estado pode ter mudado durante a espera: tudo é conferido e calculado de novo daqui.
    return this.concluirSubmissao(resolucaoId);
  }

  /**
   * O resultado de uma tentativa **submetida**; `undefined` se ela não existe, não foi submetida ou o caso
   * sumiu. As etapas vêm da avaliação gravada na submissão; a dieta é recalculada agora, com os alimentos e a
   * tolerância do caso, e o resumo de erros vem do que foi gravado. Se a base de alimentos não carregar,
   * `dieta` vem ausente e o resto do resultado continua valendo.
   */
  async resultado(resolucaoId: string): Promise<ResultadoResolucao | undefined> {
    if (!this.dadosDoResultado(resolucaoId)) {
      return undefined;
    }
    await this.alimentos.carregar();
    const base = this.dadosDoResultado(resolucaoId);
    if (!base) {
      return undefined;
    }
    const { resolucao, submissao, respostas, caso, atleta } = base;
    const metasDoAluno = this.metasDoAluno(submissao.etapas, respostas);
    const dieta =
      this.alimentos.estado() === 'pronto'
        ? avaliarDieta(
            this.listarRefeicoes(resolucaoId),
            this.listarItensDaResolucao(resolucaoId),
            this.alimentos.listar(),
            metasDoAluno,
            caso,
            atleta,
          )
        : undefined;
    return {
      resolucao: { ...resolucao },
      etapas: clonar(submissao.etapas)
        .sort((a, b) => a.ordem - b.ordem)
        .map((etapa) => ({
          etapa,
          resposta: { ...respostas.find((r) => r.etapaId === etapa.id)! },
          avaliacao: clonar(submissao.avaliacoes.find((a) => a.etapaId === etapa.id)!),
        })),
      metasDoAluno,
      ...(dieta ? { dieta } : {}),
      resumoErros: this.resumoDe(respostas, submissao),
      comentarioReferencia: caso.comentarioReferencia,
    };
  }

  /** Corretas, divergentes e com erro de uma tentativa submetida; `undefined` se não existe ou não foi submetida. */
  contagemEtapas(resolucaoId: string): ContagemEtapas | undefined {
    const resolucao = this.dados().resolucoes.find((r) => r.id === resolucaoId);
    if (resolucao?.status !== 'submetida') {
      return undefined;
    }
    const classificacoes = this.dados()
      .respostas.filter((r) => r.resolucaoId === resolucaoId)
      .map((r) => r.classificacao);
    return {
      corretas: classificacoes.filter((c) => c === 'correta').length,
      divergentes: classificacoes.filter((c) => c === 'divergente').length,
      comErro: classificacoes.filter((c) => c === 'erro de fato').length,
    };
  }

  /** O resumo pelos 5 tipos de erro (RF34) de uma tentativa submetida; `undefined` se não existe ou não foi submetida. */
  resumoErros(resolucaoId: string): ResumoErros | undefined {
    const resolucao = this.dados().resolucoes.find((r) => r.id === resolucaoId);
    const submissao = this.dados().submissoes.find((s) => s.resolucaoId === resolucaoId);
    if (resolucao?.status !== 'submetida' || !submissao) {
      return undefined;
    }
    return this.resumoDe(
      this.dados().respostas.filter((r) => r.resolucaoId === resolucaoId),
      submissao,
    );
  }

  // ---------- por dentro ----------

  private ordenadas(resolucoes: readonly Resolucao[]): Resolucao[] {
    // Mais recente primeiro; na mesma hora, a criada por último vem antes (a ordenação é estável).
    return [...resolucoes]
      .reverse()
      .sort((a, b) => b.data.localeCompare(a.data))
      .map((r) => ({ ...r }));
  }

  /** A tentativa, se existe e ainda aceita edição. */
  private emAndamento(resolucaoId: string): Resolucao | undefined {
    const resolucao = this.dados().resolucoes.find((r) => r.id === resolucaoId);
    return resolucao?.status === 'em andamento' ? resolucao : undefined;
  }

  private podeSubmeter(resolucaoId: string): boolean {
    const resolucao = this.emAndamento(resolucaoId);
    return !!resolucao && !!this.casos.buscarPorId(resolucao.casoId) && this.pendencias(resolucaoId)?.length === 0;
  }

  private metasDoAluno(etapas: readonly EtapaCalculo[], respostas: readonly RespostaEtapa[]): ResultadoResolucao['metasDoAluno'] {
    const valorDe = (tipo: EtapaCalculo['tipo']): number => {
      const etapa = etapas.find((e) => e.tipo === tipo);
      return respostas.find((r) => r.etapaId === etapa?.id)?.valor ?? NaN;
    };
    return { kcal: valorDe('GET'), cho: valorDe('CHO'), ptn: valorDe('PTN'), lip: valorDe('LIP') };
  }

  private concluirSubmissao(resolucaoId: string): Resolucao | undefined {
    if (!this.podeSubmeter(resolucaoId)) {
      return undefined;
    }
    const resolucao = this.emAndamento(resolucaoId)!;
    const doCaso = this.casos.buscarPorId(resolucao.casoId)!;
    const etapas = this.casos.listarEtapas(resolucao.casoId);
    const atual = this.dados();
    const respostas = atual.respostas.filter((r) => r.resolucaoId === resolucaoId);

    const avaliacoes = avaliarEtapas(etapas, respostas, doCaso.atleta);
    // Com a tentativa sem pendências toda etapa sai classificada; se não sair, não submete.
    if (avaliacoes.some((a) => a.classificacao === undefined)) {
      return undefined;
    }
    const dieta = avaliarDieta(
      this.listarRefeicoes(resolucaoId),
      this.listarItensDaResolucao(resolucaoId),
      this.alimentos.listar(),
      this.metasDoAluno(etapas, respostas),
      doCaso.caso,
      doCaso.atleta,
    );

    const submetida: Resolucao = { ...resolucao, status: 'submetida', submetidaEm: new Date().toISOString() };
    const submissao: Submissao = {
      resolucaoId,
      dietaForaDasMetas: dieta.dietaForaDasMetas,
      etapas: clonar(etapas),
      avaliacoes: clonar(avaliacoes),
    };
    this.salvar({
      ...atual,
      resolucoes: atual.resolucoes.map((r) => (r.id === resolucaoId ? submetida : r)),
      respostas: atual.respostas.map((r) => {
        const avaliacao = r.resolucaoId === resolucaoId ? avaliacoes.find((a) => a.etapaId === r.etapaId) : undefined;
        if (!avaliacao) {
          return r;
        }
        const { tipoErro: _antigo, ...semTipo } = r;
        return { ...semTipo, classificacao: avaliacao.classificacao, ...(avaliacao.tipoErro ? { tipoErro: avaliacao.tipoErro } : {}) };
      }),
      submissoes: [...atual.submissoes.filter((s) => s.resolucaoId !== resolucaoId), submissao],
    });
    return { ...submetida };
  }

  /** Tudo que o resultado precisa, ou `undefined` se a tentativa não está submetida ou o caso sumiu. */
  private dadosDoResultado(resolucaoId: string) {
    const atual = this.dados();
    const resolucao = atual.resolucoes.find((r) => r.id === resolucaoId);
    const submissao = atual.submissoes.find((s) => s.resolucaoId === resolucaoId);
    const doCaso = resolucao ? this.casos.buscarPorId(resolucao.casoId) : undefined;
    if (resolucao?.status !== 'submetida' || !submissao || !doCaso) {
      return undefined;
    }
    const respostas = atual.respostas.filter((r) => r.resolucaoId === resolucaoId);
    // Cada etapa avaliada precisa ter a resposta e a avaliação; senão o dado está inconsistente.
    const completo = submissao.etapas.every(
      (e) => respostas.some((r) => r.etapaId === e.id) && submissao.avaliacoes.some((a) => a.etapaId === e.id),
    );
    return completo ? { resolucao, submissao, respostas, caso: doCaso.caso, atleta: doCaso.atleta } : undefined;
  }

  private resumoDe(respostas: readonly RespostaEtapa[], submissao: Submissao): ResumoErros {
    const resumo = Object.fromEntries(TIPOS_ERRO.map((t) => [t, 0])) as ResumoErros;
    for (const r of respostas) {
      if (r.classificacao === 'erro de fato' && r.tipoErro) {
        resumo[r.tipoErro] += 1;
      }
    }
    if (submissao.dietaForaDasMetas) {
      resumo['dieta fora das metas'] += 1;
    }
    return resumo;
  }

  private salvar(novo: DadosSalvos): void {
    this.dados.set(novo);
    this.storage.gravar(CHAVE, novo);
  }

  /** Lê o que o navegador tem, conserta o que dá e descarta o que não dá; regrava só se algo mudou. */
  private carregar(): DadosSalvos {
    const lido = this.storage.ler<Partial<Record<keyof DadosSalvos, unknown>>>(CHAVE);
    if (!lido || typeof lido !== 'object') {
      return dadosVazios();
    }
    const { dados, alterado } = this.normalizar(lido);
    if (alterado) {
      this.storage.gravar(CHAVE, dados);
    }
    return dados;
  }

  /**
   * - descarta itens malformados (cada lista pode estar ausente, não ser lista ou ter itens tortos);
   * - descarta respostas, refeições e itens cujo pai não existe, e respostas repetidas da mesma etapa (fica a última);
   * - tentativa "submetida" sem a avaliação guardada volta a "em andamento" e perde as classificações,
   *   porque não há como mostrar o resultado e o estudante pode submeter de novo;
   * - tentativa "em andamento" não guarda classificação (RF09) nem avaliação de submissão.
   */
  private normalizar(lido: Partial<Record<keyof DadosSalvos, unknown>>): { dados: DadosSalvos; alterado: boolean } {
    let alterado = false;
    /** Lê uma lista do dado salvo: ausente vale vazia; o que não é lista ou é torto é descartado. */
    const lista = <T>(valor: unknown, serve: (x: unknown) => x is T): T[] => {
      const itens: unknown[] = Array.isArray(valor) ? valor : [];
      const bons = itens.filter(serve);
      if ((valor !== undefined && !Array.isArray(valor)) || bons.length !== itens.length) {
        alterado = true;
      }
      return bons.map(clonar);
    };
    const manter = <T>(itens: T[], serve: (x: T) => boolean): T[] => {
      const mantidos = itens.filter(serve);
      if (mantidos.length !== itens.length) {
        alterado = true;
      }
      return mantidos;
    };

    const submissoesLidas = lista(lido.submissoes, submissaoBemFormada);
    const comSubmissao = new Set(submissoesLidas.map((s) => s.resolucaoId));
    const resolucoes = lista(lido.resolucoes, resolucaoBemFormada).map((r) => {
      if (r.status === 'submetida' && !comSubmissao.has(r.id)) {
        alterado = true;
        const { submetidaEm: _submetidaEm, ...semData } = r;
        return { ...semData, status: 'em andamento' as const };
      }
      return r;
    });
    const ids = new Set(resolucoes.map((r) => r.id));
    const submetidas = new Set(resolucoes.filter((r) => r.status === 'submetida').map((r) => r.id));

    const submissoes = manter(submissoesLidas, (s) => submetidas.has(s.resolucaoId));
    const refeicoes = manter(lista(lido.refeicoes, refeicaoBemFormada), (r) => ids.has(r.resolucaoId));
    const refeicoesIds = new Set(refeicoes.map((r) => r.id));
    const itens = manter(lista(lido.itens, itemBemFormado), (i) => refeicoesIds.has(i.refeicaoId));

    const comPai = manter(lista(lido.respostas, respostaBemFormada), (r) => ids.has(r.resolucaoId));
    const ultimaPorEtapa = new Map(comPai.map((r) => [`${r.resolucaoId}|${r.etapaId}`, r]));
    if (ultimaPorEtapa.size !== comPai.length) {
      alterado = true; // etapa respondida duas vezes: fica a última
    }
    const respostas = [...ultimaPorEtapa.values()].map((r) => {
      if (!submetidas.has(r.resolucaoId) && (r.classificacao !== undefined || r.tipoErro !== undefined)) {
        alterado = true;
        const { classificacao: _classificacao, tipoErro: _tipoErro, ...semVeredito } = r;
        return semVeredito;
      }
      return r;
    });

    return { dados: { versao: VERSAO, resolucoes, respostas, refeicoes, itens, submissoes }, alterado };
  }
}
