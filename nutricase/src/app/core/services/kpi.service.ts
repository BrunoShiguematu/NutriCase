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
  unidadeDaSerie,
  ultimosDias,
} from '../kpis/kpis';
import { ResumoErros } from '../models';
import { ResolucaoService } from './resolucao.service';

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

  readonly unidadeSerie = computed(() => unidadeDaSerie(this.filtro()));

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
