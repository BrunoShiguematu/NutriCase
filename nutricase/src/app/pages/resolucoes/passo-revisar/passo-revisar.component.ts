import { Component, computed, EventEmitter, inject, input, Output, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { totaisDaDieta } from '../../../core/avaliacao/avaliar-dieta';
import { Resolucao } from '../../../core/models';
import { AlimentoService } from '../../../core/services/alimento.service';
import { CasoService } from '../../../core/services/caso.service';
import { Pendencia, ResolucaoService } from '../../../core/services/resolucao.service';
import { CAMPOS_DA_ETAPA } from '../etapas-ui';
import { ConfirmarSubmissaoComponent } from './confirmar-submissao/confirmar-submissao.component';

/** Posição dos passos no stepper do resolver: para onde cada pendência leva. */
export const PASSO_ETAPAS = 0;
export const PASSO_DIETA = 1;

const ROTULO_MARCADOR: Record<string, string> = { 'pré-treino': 'Pré-treino', 'pós-treino': 'Pós-treino' };

/**
 * Passo "Revisar" e submissão (UC06). Mostra o que será corrigido (as 5 respostas, as refeições com o total do
 * dia e a justificativa) e as pendências (UC06, fluxo 2a): enquanto houver alguma, o botão Submeter fica
 * desativado e explica o motivo, e cada pendência tem um botão que leva ao passo onde ela se resolve.
 *
 * Submeter pede confirmação num diálogo e chama `ResolucaoService.submeter`. Com sucesso, abre o resultado. Se não
 * houver pendência e a submissão ainda assim falhar (por exemplo, a base de alimentos não carregou), mostra uma
 * mensagem própria e fica na tela, para tentar de novo. Nada aqui diz se alguma resposta está certa (RF09).
 */
@Component({
  selector: 'app-passo-revisar',
  standalone: false,
  styleUrl: './passo-revisar.component.scss',
  templateUrl: './passo-revisar.component.html',
})
export class PassoRevisarComponent {
  private readonly service = inject(ResolucaoService);
  private readonly alimentos = inject(AlimentoService);
  private readonly casos = inject(CasoService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  readonly resolucao = input.required<Resolucao>();

  /** Emite a posição do passo (0 = Etapas, 1 = Dieta) para onde a pendência leva; o resolver troca o passo. */
  @Output() readonly irPara = new EventEmitter<number>();

  protected readonly estadoAlimentos = this.alimentos.estado;
  protected readonly submetendo = signal(false);
  protected readonly erroSubmissao = signal(false);

  private readonly id = computed(() => this.resolucao().id);

  protected readonly pendencias = computed<Pendencia[]>(() => this.service.pendencias(this.id()) ?? []);

  protected readonly respostas = computed(() => {
    const respostas = this.service.listarRespostas(this.id());
    return this.casos.listarEtapas(this.resolucao().casoId).map((etapa) => {
      const resposta = respostas.find((r) => r.etapaId === etapa.id);
      const campos = CAMPOS_DA_ETAPA[etapa.tipo];
      return {
        numero: etapa.ordem,
        titulo: campos.titulo,
        parametro: resposta ? `${campos.parametroRotulo}: ${this.formatar(resposta.parametro, campos.parametroUnidade)}` : undefined,
        valor: resposta ? `${campos.valorRotulo}: ${this.formatar(resposta.valor, campos.valorUnidade)}` : undefined,
      };
    });
  });

  private readonly refeicoes = computed(() => this.service.listarRefeicoes(this.id()));
  private readonly itens = computed(() => this.service.listarItensDaResolucao(this.id()));

  protected readonly dieta = computed(() => {
    const itens = this.itens();
    return [...this.refeicoes()]
      .sort((a, b) => a.horario.localeCompare(b.horario))
      .map((refeicao) => ({
        refeicao,
        marcador: ROTULO_MARCADOR[refeicao.marcador],
        itens: itens
          .filter((item) => item.refeicaoId === refeicao.id)
          .map((item) => ({
            nome: this.alimentos.buscarPorId(item.alimentoId)?.nome ?? 'Alimento não encontrado na base',
            gramas: this.formatar(item.quantidadeGramas),
          })),
      }));
  });

  protected readonly totalDoDia = computed(() => {
    const dia = totaisDaDieta(this.refeicoes(), this.itens(), this.alimentos.alimentos()).dia;
    return `${this.formatar(dia.kcal)} kcal · CHO ${this.formatar(dia.cho)} g · PTN ${this.formatar(dia.ptn)} g · LIP ${this.formatar(dia.lip)} g`;
  });

  protected readonly justificativa = computed(() => this.service.buscar(this.id())?.justificativa.trim() ?? '');

  constructor() {
    // Os totais dependem da base de alimentos; chamar de novo é barato (só o primeiro faz o trabalho).
    void this.alimentos.carregar();
  }

  protected levarAoPasso(pendencia: Pendencia): void {
    this.irPara.emit(pendencia.tipo === 'etapa' ? PASSO_ETAPAS : PASSO_DIETA);
  }

  protected tentarCarregarAlimentos(): void {
    void this.alimentos.carregar();
  }

  /** Pede a confirmação; só com `true` a resolução é submetida. */
  protected submeter(): void {
    if (this.pendencias().length > 0 || this.submetendo()) {
      return;
    }
    this.dialog
      .open<ConfirmarSubmissaoComponent, void, boolean>(ConfirmarSubmissaoComponent)
      .afterClosed()
      .subscribe((confirmou) => {
        if (confirmou === true) {
          void this.executarSubmissao();
        }
      });
  }

  private async executarSubmissao(): Promise<void> {
    this.submetendo.set(true);
    this.erroSubmissao.set(false);
    const id = this.id();
    const submetida = await this.service.submeter(id);
    this.submetendo.set(false);
    if (!submetida) {
      this.erroSubmissao.set(true);
      return;
    }
    void this.router.navigate(['/resolucoes', id, 'resultado'], { replaceUrl: true });
  }

  private formatar(valor: string | number, unidade?: string): string {
    const texto = typeof valor === 'number' ? valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : valor;
    return unidade ? `${texto} ${unidade}` : texto;
  }
}
