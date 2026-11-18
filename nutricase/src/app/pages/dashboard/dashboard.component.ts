import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { FiltroKpis, periodoEntreDatas, TipoKpi, ultimosDias, validarPeriodo } from '../../core/kpis/kpis';
import { KpiService } from '../../core/services/kpi.service';
import { ConquistasDialogComponent } from './conquistas-dialog/conquistas-dialog.component';
import { Grafico, ModoGrafico, montarGrafico } from './grafico-evolucao';

const comInicial = (texto: string): string => texto.charAt(0).toUpperCase() + texto.slice(1);

type Periodo = 'hoje' | '7' | '30' | 'especifico';

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
  private readonly dialog = inject(MatDialog);

  protected readonly periodos: { valor: Periodo; rotulo: string }[] = [
    { valor: 'hoje', rotulo: 'Hoje' },
    { valor: '7', rotulo: 'Últimos 7 dias' },
    { valor: '30', rotulo: 'Últimos 30 dias' },
    { valor: 'especifico', rotulo: 'Período específico' },
  ];

  protected readonly kpis = this.service.kpis;
  protected readonly ofensiva = this.service.ofensiva;
  protected readonly nivel = this.service.nivel;
  private readonly conquistas = this.service.conquistas;

  protected readonly modoGrafico = signal<ModoGrafico>('percentual');
  protected readonly grafico = computed<Grafico>(() => montarGrafico(this.service.serie(), this.modoGrafico(), this.service.unidadeSerie()));
  protected readonly unidadeGrafico = this.service.unidadeSerie;

  protected readonly tipo = signal<TipoKpi>('calculos');
  protected readonly periodo = signal<Periodo>('7');
  protected readonly campoInicio = new FormControl<Date | null>(null);
  protected readonly campoFim = new FormControl<Date | null>(null);
  private readonly dataInicial = signal<Date | null>(null);
  private readonly dataFinal = signal<Date | null>(null);

  protected readonly erroDoPeriodo = computed(() => {
    const [inicio, fim] = [this.dataInicial(), this.dataFinal()];
    return this.periodo() === 'especifico' && inicio && fim ? validarPeriodo(inicio, fim) : null;
  });

  protected readonly faltaData = computed(() => this.periodo() === 'especifico' && (!this.dataInicial() || !this.dataFinal()));

  protected readonly semDados = computed(() => this.kpis().casosResolvidos.tentativas === 0);

  protected readonly semNenhuma = computed(() => this.nivel().casos === 0);

  protected readonly linhasErro = computed<LinhaErro[]>(() => {
    const { tipos, total } = this.kpis().errosPorTipo;
    return tipos.map(({ tipo, quantidade }) => ({ tipo: comInicial(tipo), quantidade, largura: total === 0 ? 0 : (quantidade * 100) / total }));
  });

  protected readonly casosTexto = computed(() => this.plural(this.kpis().casosResolvidos.casosDistintos, 'caso', 'casos'));
  protected readonly errosTexto = computed(() => this.plural(this.kpis().errosPorTipo.total, 'erro', 'erros'));

  ngOnInit(): void {
    this.service.atualizarHoje();
  }

  protected abrirConquistas(): void {
    this.dialog.open(ConquistasDialogComponent, { data: this.conquistas() });
  }

  protected trocarModoGrafico(modo: ModoGrafico): void {
    this.modoGrafico.set(modo);
  }

  protected trocarTipo(tipo: TipoKpi): void {
    this.tipo.set(tipo);
    this.aplicar();
  }

  protected trocarPeriodo(periodo: Periodo): void {
    this.periodo.set(periodo);
    this.dataInicial.set(null);
    this.dataFinal.set(null);
    this.campoInicio.reset();
    this.campoFim.reset();
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
