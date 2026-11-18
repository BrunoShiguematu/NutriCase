import { Component, computed, EventEmitter, inject, input, Output, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { totaisDaDieta } from '../../../core/avaliacao/avaliar-dieta';
import { Resolucao } from '../../../core/models';
import { AlimentoService } from '../../../core/services/alimento.service';
import { CasoService } from '../../../core/services/caso.service';
import { Pendencia, ResolucaoService } from '../../../core/services/resolucao.service';
import { CAMPOS_DA_ETAPA, DestinoDaPendencia } from '../etapas-ui';
import { ConfirmarSubmissaoComponent } from './confirmar-submissao/confirmar-submissao.component';

export const PASSO_ETAPAS = 0;
export const PASSO_DIETA = 1;

const ROTULO_MARCADOR: Record<string, string> = { 'pré-treino': 'Pré-treino', 'pós-treino': 'Pós-treino' };

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

  @Output() readonly irPara = new EventEmitter<DestinoDaPendencia>();

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
    void this.alimentos.carregar();
  }

  protected levarAoPasso(pendencia: Pendencia): void {
    this.irPara.emit(pendencia.tipo === 'etapa' ? { passo: PASSO_ETAPAS, etapaId: pendencia.etapaId } : { passo: PASSO_DIETA });
  }

  protected tentarCarregarAlimentos(): void {
    void this.alimentos.carregar();
  }

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
