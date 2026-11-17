import { Component, OnInit, ViewChild, computed, effect, inject } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { Alimento } from '../../core/models';
import { AlimentoService, nomeContem } from '../../core/services/alimento.service';

/** Valor da opção "Todos" do filtro de grupo. */
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

  /** O paginador só existe com a base pronta: liga ao dataSource quando aparece. */
  @ViewChild(MatPaginator) set paginador(paginador: MatPaginator) {
    this.dataSource.paginator = paginador;
  }

  constructor() {
    // Busca por nome (sem acento, todas as palavras) e grupo; o filtro vai como texto JSON porque o dataSource só aceita string.
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

  /** O botão some da tela ao clicar; o foco vai para o título para não se perder. */
  protected tentarDeNovo(titulo: HTMLElement): void {
    titulo.focus();
    void this.alimentoService.carregar();
  }

  protected filtrar(): void {
    this.dataSource.filter = JSON.stringify({ busca: this.busca, grupo: this.grupo });
    this.dataSource.paginator?.firstPage();
  }

  /** Número no formato brasileiro, ex.: 25,8. */
  protected formatar(valor: number): string {
    return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  }
}
