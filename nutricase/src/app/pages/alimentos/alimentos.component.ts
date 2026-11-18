import { Component, OnInit, ViewChild, computed, effect, inject } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { Alimento } from '../../core/models';
import { AlimentoService, nomeContem } from '../../core/services/alimento.service';

const TODOS = '';

@Component({
  selector: 'app-alimentos',
  standalone: false,
  styleUrl: './alimentos.component.scss',
  templateUrl: './alimentos.component.html',
})
export class AlimentosComponent implements OnInit {
  private readonly alimentoService = inject(AlimentoService);

  protected readonly colunas = ['nome', 'grupo', 'kcal', 'carboidrato', 'proteina', 'gordura', 'origem'];
  protected readonly opcoesPorPagina = [10, 25, 50];
  protected readonly todos = TODOS;

  protected readonly estado = this.alimentoService.estado;
  protected readonly grupos = computed(() => this.alimentoService.listarGrupos());
  protected readonly dataSource = new MatTableDataSource<Alimento>();
  protected busca = '';
  protected grupo = TODOS;

  @ViewChild(MatPaginator) set paginador(paginador: MatPaginator) {
    this.dataSource.paginator = paginador;
  }

  constructor() {
    this.dataSource.filterPredicate = (alimento, filtro) => {
      const { busca, grupo } = JSON.parse(filtro) as { busca: string; grupo: string };
      return (grupo === TODOS || alimento.grupo === grupo) && nomeContem(alimento.nome, busca);
    };
    effect(() => {
      if (this.estado() === 'pronto') {
        this.dataSource.data = this.alimentoService.listar();
      }
    });
  }

  ngOnInit(): void {
    void this.alimentoService.carregar();
  }

  protected tentarDeNovo(titulo: HTMLElement): void {
    titulo.focus();
    void this.alimentoService.carregar();
  }

  protected filtrar(): void {
    this.dataSource.filter = JSON.stringify({ busca: this.busca, grupo: this.grupo });
    this.dataSource.paginator?.firstPage();
  }

  protected formatar(valor: number): string {
    return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  }
}
