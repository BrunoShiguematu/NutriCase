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
 * "Hoje" é o signal `hoje`: a ofensiva e o filtro padrão partem dele. `atualizarHoje` o põe no dia de agora e
 * volta o filtro ao padrão; o Dashboard o chama ao abrir, então quem deixa o app aberto passando da meia-noite
 * vê o dia certo na próxima visita.
 */
@Injectable({ providedIn: 'root' })
export class KpiService {
  constructor(private readonly resolucoes: ResolucaoService) {}

  readonly hoje = signal(new Date());

  readonly filtro = signal<FiltroKpis>(this.filtroPadrao());

  readonly kpis = computed(() => calcularKpis(this.entrada(), this.filtro()));

  readonly ofensiva = computed(() => calcularOfensiva(this.hoje(), this.entrada().resolucoes));

  readonly nivel = computed(() => calcularNivel(casosConcluidos(this.entrada().resolucoes)));

  readonly conquistas = computed(() => calcularConquistas(this.entrada()));

  readonly serie = computed(() => serieAproveitamento(this.entrada(), this.filtro()));

  /** Põe `hoje` no instante de agora e volta ao filtro padrão (cálculos, últimos 7 dias, até o fim de hoje). */
  atualizarHoje(): void {
    this.hoje.set(new Date());
    this.filtro.set(this.filtroPadrao());
  }

  private filtroPadrao(): FiltroKpis {
    return { tipo: 'calculos', ...ultimosDias(7, this.hoje()) };
  }

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
