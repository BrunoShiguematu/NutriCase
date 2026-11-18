import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FiltroKpis, periodoEntreDatas, TipoKpi, ultimosDias, validarPeriodo } from '../../core/kpis/kpis';
import { KpiService } from '../../core/services/kpi.service';

const comInicial = (texto: string): string => texto.charAt(0).toUpperCase() + texto.slice(1);

type Periodo = 'hoje' | '7' | '30' | 'especifico';

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
export class DashboardComponent implements OnInit {
  private readonly service = inject(KpiService);

  protected readonly periodos: { valor: Periodo; rotulo: string }[] = [
    { valor: 'hoje', rotulo: 'Hoje' },
    { valor: '7', rotulo: 'Últimos 7 dias' },
    { valor: '30', rotulo: 'Últimos 30 dias' },
    { valor: 'especifico', rotulo: 'Período específico' },
  ];

  protected readonly kpis = this.service.kpis;
  protected readonly ofensiva = this.service.ofensiva;
  protected readonly nivel = this.service.nivel;

  /** A escolha na tela; o padrão é o mesmo do serviço (cálculos, últimos 7 dias). */
  protected readonly tipo = signal<TipoKpi>('calculos');
  protected readonly periodo = signal<Periodo>('7');
  private readonly dataInicial = signal<Date | null>(null);
  private readonly dataFinal = signal<Date | null>(null);

  /** O que está errado no "Período específico" (datas invertidas ou mais de 1 ano); `null` se está certo ou incompleto. */
  protected readonly erroDoPeriodo = computed(() => {
    const [inicio, fim] = [this.dataInicial(), this.dataFinal()];
    return this.periodo() === 'especifico' && inicio && fim ? validarPeriodo(inicio, fim) : null;
  });

  /** O "Período específico" escolhido e ainda sem as duas datas: os números continuam os do período anterior. */
  protected readonly faltaData = computed(() => this.periodo() === 'especifico' && (!this.dataInicial() || !this.dataFinal()));

  /** Sem nenhuma tentativa submetida no período os cartões mostram "—", não 0%. */
  protected readonly semDados = computed(() => this.kpis().casosResolvidos.tentativas === 0);

  /** Sem nenhuma tentativa submetida em tempo algum (o período não importa). */
  protected readonly semNenhuma = computed(() => this.nivel().casos === 0);

  protected readonly linhasErro = computed<LinhaErro[]>(() => {
    const { tipos, total } = this.kpis().errosPorTipo;
    return tipos.map(({ tipo, quantidade }) => ({ tipo: comInicial(tipo), quantidade, largura: total === 0 ? 0 : (quantidade * 100) / total }));
  });

  protected readonly casosTexto = computed(() => this.plural(this.kpis().casosResolvidos.casosDistintos, 'caso', 'casos'));
  protected readonly errosTexto = computed(() => this.plural(this.kpis().errosPorTipo.total, 'erro', 'erros'));

  /** Cada visita ao Dashboard parte do dia de agora e do filtro padrão, que é o que a tela mostra ao abrir. */
  ngOnInit(): void {
    this.service.atualizarHoje();
  }

  protected trocarTipo(tipo: TipoKpi): void {
    this.tipo.set(tipo);
    this.aplicar();
  }

  protected trocarPeriodo(periodo: Periodo): void {
    this.periodo.set(periodo);
    // Os campos de data somem e voltam vazios ao sair e voltar para o "Período específico": as datas guardadas vão junto.
    this.dataInicial.set(null);
    this.dataFinal.set(null);
    this.aplicar();
  }

  protected escolherInicio(data: Date | null): void {
    this.dataInicial.set(data);
    this.aplicar();
  }

  protected escolherFim(data: Date | null): void {
    this.dataFinal.set(data);
    this.aplicar();
  }

  /** Passa ao serviço o tipo e o período escolhidos; com o "Período específico" incompleto ou errado, deixa o filtro como está. */
  private aplicar(): void {
    const hoje = this.service.hoje();
    const periodo = this.periodo();
    let intervalo: Pick<FiltroKpis, 'inicio' | 'fim'>;
    if (periodo === 'especifico') {
      const [inicio, fim] = [this.dataInicial(), this.dataFinal()];
      if (!inicio || !fim || validarPeriodo(inicio, fim) !== null) {
        return;
      }
      intervalo = periodoEntreDatas(inicio, fim);
    } else {
      intervalo = ultimosDias(periodo === 'hoje' ? 1 : Number(periodo), hoje);
    }
    this.service.filtro.set({ tipo: this.tipo(), ...intervalo });
  }

  private plural(n: number, singular: string, plural: string): string {
    return `${n} ${n === 1 ? singular : plural}`;
  }
}
