import { Injectable, computed, signal } from '@angular/core';
import { AvaliacaoDieta, avaliarDieta, MetasDoAluno } from '../avaliacao/avaliar-dieta';
import { AvaliacaoEtapa, avaliarEtapas } from '../avaliacao/avaliar-etapas';
import { EtapaCalculo, ItemRefeicao, MarcadorRefeicao, Refeicao, Resolucao, RespostaEtapa, ResumoErros, TIPOS_ERRO } from '../models';
import { AlimentoService } from './alimento.service';
import { CasoService } from './caso.service';
import { StorageService } from './storage.service';

const CHAVE = 'nutricase.resolucoes';
const VERSAO = 1;

export { TIPOS_ERRO };
export type { ResumoErros };

export interface Pendencia {
  tipo: 'etapa' | 'dieta';
  etapaId?: string;
  texto: string;
}

export interface DadosRefeicao {
  nome: string;
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

export interface ResultadoEtapa {
  etapa: EtapaCalculo;
  resposta: RespostaEtapa;
  avaliacao: AvaliacaoEtapa;
}

export interface ResultadoResolucao {
  resolucao: Resolucao;
  etapas: ResultadoEtapa[];
  metasDoAluno: Required<{ [K in keyof MetasDoAluno]: number }>;
  dieta?: AvaliacaoDieta;
  resumoErros: ResumoErros;
  comentarioReferencia: string;
}

interface Submissao {
  readonly resolucaoId: string;
  readonly dietaForaDasMetas: boolean;
  readonly etapas: readonly EtapaCalculo[];
  readonly avaliacoes: readonly AvaliacaoEtapa[];
}

interface DadosSalvos {
  readonly versao: number;
  readonly resolucoes: readonly Resolucao[];
  readonly respostas: readonly RespostaEtapa[];
  readonly refeicoes: readonly Refeicao[];
  readonly itens: readonly ItemRefeicao[];
  readonly submissoes: readonly Submissao[];
}

function dadosVazios(): DadosSalvos {
  return { versao: VERSAO, resolucoes: [], respostas: [], refeicoes: [], itens: [], submissoes: [] };
}

function gerarId(prefixo: string): string {
  return `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

@Injectable({ providedIn: 'root' })
export class ResolucaoService {
  private readonly dados = signal<DadosSalvos>(dadosVazios());

  readonly resolucoes = computed(() => this.ordenadas(this.dados().resolucoes));

  constructor(
    private readonly storage: StorageService,
    private readonly casos: CasoService,
    private readonly alimentos: AlimentoService,
  ) {
    this.dados.set(this.carregar());
  }

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
    return resolucao;
  }

  buscar(id: string): Resolucao | undefined {
    return this.dados().resolucoes.find((r) => r.id === id);
  }

  listar(): Resolucao[] {
    return this.ordenadas(this.dados().resolucoes);
  }

  refazer(id: string): Resolucao | undefined {
    const anterior = this.buscar(id);
    return anterior ? this.iniciar(anterior.casoId) : undefined;
  }

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

  listarRespostas(resolucaoId: string): RespostaEtapa[] {
    const ordem = new Map(this.casos.listarEtapas(this.buscar(resolucaoId)?.casoId ?? '').map((e) => [e.id, e.ordem]));
    return this.dados()
      .respostas.filter((r) => r.resolucaoId === resolucaoId)
      .sort((a, b) => (ordem.get(a.etapaId) ?? 99) - (ordem.get(b.etapaId) ?? 99));
  }

  salvarResposta(resolucaoId: string, etapaId: string, parametro: string | number, valor: number): RespostaEtapa | undefined {
    const resolucao = this.emAndamento(resolucaoId);
    if (!resolucao || !this.casos.listarEtapas(resolucao.casoId).some((e) => e.id === etapaId)) {
      return undefined;
    }
    const atual = this.dados();
    const anterior = atual.respostas.find((r) => r.resolucaoId === resolucaoId && r.etapaId === etapaId);
    const resposta: RespostaEtapa = {
      id: anterior?.id ?? gerarId('resposta'),
      resolucaoId,
      etapaId,
      parametro,
      valor,
    };
    this.salvar({
      ...atual,
      respostas: anterior
        ? atual.respostas.map((r) => (r === anterior ? resposta : r))
        : [...atual.respostas, resposta],
    });
    return resposta;
  }

  listarRefeicoes(resolucaoId: string): Refeicao[] {
    return this.dados().refeicoes.filter((r) => r.resolucaoId === resolucaoId);
  }

  listarItens(refeicaoId: string): ItemRefeicao[] {
    return this.dados().itens.filter((i) => i.refeicaoId === refeicaoId);
  }

  listarItensDaResolucao(resolucaoId: string): ItemRefeicao[] {
    const ids = new Set(this.listarRefeicoes(resolucaoId).map((r) => r.id));
    return this.dados().itens.filter((i) => ids.has(i.refeicaoId));
  }

  criarRefeicao(resolucaoId: string, dados: DadosRefeicao): Refeicao | undefined {
    if (!this.emAndamento(resolucaoId)) {
      return undefined;
    }
    const refeicao: Refeicao = { id: gerarId('refeicao'), resolucaoId, ...dados };
    const atual = this.dados();
    this.salvar({ ...atual, refeicoes: [...atual.refeicoes, refeicao] });
    return refeicao;
  }

  atualizarRefeicao(refeicaoId: string, dados: DadosRefeicao): Refeicao | undefined {
    const atual = this.dados();
    const existente = atual.refeicoes.find((r) => r.id === refeicaoId);
    if (!existente || !this.emAndamento(existente.resolucaoId)) {
      return undefined;
    }
    const nova: Refeicao = { ...existente, ...dados };
    this.salvar({ ...atual, refeicoes: atual.refeicoes.map((r) => (r === existente ? nova : r)) });
    return nova;
  }

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

  criarItem(refeicaoId: string, dados: DadosItem): ItemRefeicao | undefined {
    const refeicao = this.dados().refeicoes.find((r) => r.id === refeicaoId);
    if (!refeicao || !this.emAndamento(refeicao.resolucaoId)) {
      return undefined;
    }
    const item: ItemRefeicao = { id: gerarId('item'), refeicaoId, alimentoId: dados.alimentoId, quantidadeGramas: dados.quantidadeGramas };
    const atual = this.dados();
    this.salvar({ ...atual, itens: [...atual.itens, item] });
    return item;
  }

  atualizarItem(itemId: string, dados: Partial<DadosItem>): ItemRefeicao | undefined {
    const atual = this.dados();
    const existente = atual.itens.find((i) => i.id === itemId);
    const refeicao = existente && atual.refeicoes.find((r) => r.id === existente.refeicaoId);
    if (!existente || !refeicao || !this.emAndamento(refeicao.resolucaoId)) {
      return undefined;
    }
    const novo: ItemRefeicao = {
      ...existente,
      ...(dados.alimentoId !== undefined ? { alimentoId: dados.alimentoId } : {}),
      ...(dados.quantidadeGramas !== undefined ? { quantidadeGramas: dados.quantidadeGramas } : {}),
    };
    this.salvar({ ...atual, itens: atual.itens.map((i) => (i === existente ? novo : i)) });
    return novo;
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

  salvarJustificativa(resolucaoId: string, texto: string): Resolucao | undefined {
    const resolucao = this.emAndamento(resolucaoId);
    if (!resolucao) {
      return undefined;
    }
    const nova: Resolucao = { ...resolucao, justificativa: texto };
    const atual = this.dados();
    this.salvar({ ...atual, resolucoes: atual.resolucoes.map((r) => (r.id === resolucaoId ? nova : r)) });
    return nova;
  }

  pendencias(resolucaoId: string): Pendencia[] | undefined {
    const resolucao = this.dados().resolucoes.find((r) => r.id === resolucaoId);
    if (!resolucao) {
      return undefined;
    }
    const respondidas = new Set(
      this.dados()
        .respostas.filter((r) => r.resolucaoId === resolucaoId)
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

  async submeter(resolucaoId: string): Promise<Resolucao | undefined> {
    if (!this.podeSubmeter(resolucaoId)) {
      return undefined;
    }
    await this.alimentos.carregar();
    if (this.alimentos.estado() !== 'pronto') {
      return undefined;
    }
    return this.concluirSubmissao(resolucaoId);
  }

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
      resolucao,
      etapas: [...submissao.etapas]
        .sort((a, b) => a.ordem - b.ordem)
        .map((etapa) => ({
          etapa,
          resposta: respostas.find((r) => r.etapaId === etapa.id)!,
          avaliacao: submissao.avaliacoes.find((a) => a.etapaId === etapa.id)!,
        })),
      metasDoAluno,
      ...(dieta ? { dieta } : {}),
      resumoErros: this.resumoDe(respostas, submissao),
      comentarioReferencia: caso.comentarioReferencia,
    };
  }

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

  private ordenadas(resolucoes: readonly Resolucao[]): Resolucao[] {
    return [...resolucoes].reverse().sort((a, b) => b.data.localeCompare(a.data));
  }

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
      etapas,
      avaliacoes,
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
    return submetida;
  }

  private dadosDoResultado(resolucaoId: string) {
    const atual = this.dados();
    const resolucao = atual.resolucoes.find((r) => r.id === resolucaoId);
    const submissao = atual.submissoes.find((s) => s.resolucaoId === resolucaoId);
    const doCaso = resolucao ? this.casos.buscarPorId(resolucao.casoId) : undefined;
    if (resolucao?.status !== 'submetida' || !submissao || !doCaso) {
      return undefined;
    }
    const respostas = atual.respostas.filter((r) => r.resolucaoId === resolucaoId);
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

  private carregar(): DadosSalvos {
    return this.storage.ler<DadosSalvos>(CHAVE) ?? dadosVazios();
  }
}
