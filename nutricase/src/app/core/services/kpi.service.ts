import { computed, Injectable, signal } from '@angular/core';
import { calcularKpis, EntradaKpis, FiltroKpis, ultimosDias } from '../kpis/kpis';
import { ResumoErros } from '../models';
import { ResolucaoService } from './resolucao.service';

/**
 * Lê as tentativas do `ResolucaoService` e entrega os KPIs do dashboard calculados por `calcularKpis`.
 * `filtro` é o tipo e o período escolhidos (padrão: cálculos, últimos 7 dias, até o fim de hoje) e `kpis`
 * recalcula sozinho quando o filtro ou as tentativas mudam.
 */
@Injectable({ providedIn: 'root' })
export class KpiService {
  constructor(private readonly resolucoes: ResolucaoService) {}

  readonly filtro = signal<FiltroKpis>({ tipo: 'calculos', ...ultimosDias(7) });

  readonly kpis = computed(() => calcularKpis(this.entrada(), this.filtro()));

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
