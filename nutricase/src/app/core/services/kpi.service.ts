import { Injectable } from '@angular/core';
import { calcularKpis, Kpis } from '../kpis/kpis';
import { ResumoErros } from '../models';
import { ResolucaoService } from './resolucao.service';

/** Lê as tentativas do `ResolucaoService` e entrega os KPIs do dashboard calculados por `calcularKpis`. */
@Injectable({ providedIn: 'root' })
export class KpiService {
  constructor(private readonly resolucoes: ResolucaoService) {}

  /** Calcula a partir do que está gravado agora; chame de novo para atualizar. */
  calcular(): Kpis {
    const tentativas = this.resolucoes.listar();
    const respostas = tentativas.flatMap((r) => this.resolucoes.listarRespostas(r.id));
    const resumosErros = new Map<string, ResumoErros>();
    for (const tentativa of tentativas) {
      const resumo = this.resolucoes.resumoErros(tentativa.id);
      if (resumo) {
        resumosErros.set(tentativa.id, resumo);
      }
    }
    return calcularKpis({ resolucoes: tentativas, respostas, resumosErros });
  }
}
