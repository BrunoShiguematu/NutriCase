import { Component, inject } from '@angular/core';
import { KpiService } from '../../core/services/kpi.service';

const comInicial = (texto: string): string => texto.charAt(0).toUpperCase() + texto.slice(1);

/** Um tipo de erro pronto para a lista: rótulo, contagem e a largura da barra (% do total de erros). */
export interface LinhaErro {
  tipo: string;
  quantidade: number;
  largura: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: false,
  styleUrl: './dashboard.component.scss',
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  /** Lidos uma vez, ao abrir a tela (padrão do serviço: cálculos, últimos 7 dias); a tela abre de novo a cada visita ao Dashboard. */
  protected readonly kpis = inject(KpiService).kpis();

  /** Sem nenhuma tentativa submetida os cartões mostram "—", não 0%. */
  protected readonly semSubmissoes = this.kpis.casosResolvidos.tentativas === 0;

  protected readonly linhasErro: LinhaErro[] = this.kpis.errosPorTipo.tipos.map(({ tipo, quantidade }) => ({
    tipo: comInicial(tipo),
    quantidade,
    largura: this.kpis.errosPorTipo.total === 0 ? 0 : (quantidade * 100) / this.kpis.errosPorTipo.total,
  }));

  protected readonly casosTexto = this.plural(this.kpis.casosResolvidos.casosDistintos, 'caso', 'casos');
  protected readonly errosTexto = this.plural(this.kpis.errosPorTipo.total, 'erro', 'erros');

  private plural(n: number, singular: string, plural: string): string {
    return `${n} ${n === 1 ? singular : plural}`;
  }
}
