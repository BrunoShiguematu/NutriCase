import { computed, Injectable, signal } from '@angular/core';
import {
  calcularKpis,
  casosConcluidos,
  conquistas as calcularConquistas,
  EntradaKpis,
  FiltroKpis,
  nivel as calcularNivel,
  ofensiva as calcularOfensiva,
  serieAproveitamento,
  ultimosDias,
} from '../kpis/kpis';
import { ResumoErros } from '../models';
import { ResolucaoService } from './resolucao.service';

/**
 * Lê as tentativas do `ResolucaoService` e entrega os KPIs do dashboard calculados por `calcularKpis`.
 * `filtro` é o tipo e o período escolhidos (padrão: cálculos, últimos 7 dias, até o fim de hoje) e `kpis`
 * recalcula sozinho quando o filtro ou as tentativas mudam. `ofensiva`, `nivel` e `conquistas` ignoram o filtro
 * (hábito e progresso acumulado); `serie` é o aproveitamento do gráfico, no tipo e no período do filtro.
 * Dia e hora de "hoje" são lidos quando o valor é calculado; abrir o Dashboard de novo traz o dia certo.
 */
@Injectable({ providedIn: 'root' })
export class KpiService {
  constructor(private readonly resolucoes: ResolucaoService) {}

  readonly filtro = signal<FiltroKpis>({ tipo: 'calculos', ...ultimosDias(7) });

  readonly kpis = computed(() => calcularKpis(this.entrada(), this.filtro()));

  readonly ofensiva = computed(() => calcularOfensiva(new Date(), this.entrada().resolucoes));

  readonly nivel = computed(() => calcularNivel(casosConcluidos(this.entrada().resolucoes)));

  readonly conquistas = computed(() => calcularConquistas(this.entrada()));

  readonly serie = computed(() => serieAproveitamento(this.entrada(), this.filtro()));

  private entrada(): EntradaKpis {
    const tentativas = this.resolucoes.listar();
    const respostas = tentativas.flatMap((r) => this.resolucoes.listarRespostas(r.id));
    const resumosErros = new Map<string, ResumoErros>();
    for (const tentativa of tentativas) {
      const resumo = this.resolucoes.resumoErros(tentativa.id);
      if (resumo) {
        resumosErros.set(tentativa.id, resumo);
      }
    }
    return { resolucoes: tentativas, respostas, resumosErros };
  }
}
