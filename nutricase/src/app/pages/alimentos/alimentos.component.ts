import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { AlimentoService } from '../../core/services/alimento.service';

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
  protected readonly busca = signal('');
  protected readonly grupoSelecionado = signal<string>(TODOS);
  protected readonly indicePagina = signal(0);
  protected readonly tamanhoPagina = signal(this.opcoesPorPagina[0]);

  protected readonly grupos = computed(() => {
    return this.alimentoService.listarGrupos();
  });

  /** Resultado da busca por nome e do filtro de grupo, na ordem da TACO. */
  protected readonly resultados = computed(() => {
    const grupo = this.grupoSelecionado();
    return this.alimentoService
      .buscarPorNome(this.busca())
      .filter((alimento) => grupo === TODOS || alimento.grupo === grupo);
  });

  protected readonly paginaAtual = computed(() => {
    const inicio = this.indicePagina() * this.tamanhoPagina();
    return this.resultados().slice(inicio, inicio + this.tamanhoPagina());
  });

  ngOnInit(): void {
    void this.alimentoService.carregar();
  }

  /** O botão some da tela ao clicar; o foco vai para o título para não se perder. */
  protected tentarDeNovo(titulo: HTMLElement): void {
    titulo.focus();
    void this.alimentoService.carregar();
  }

  protected buscar(texto: string): void {
    this.busca.set(texto);
    this.indicePagina.set(0);
  }

  protected filtrarGrupo(grupo: string): void {
    this.grupoSelecionado.set(grupo);
    this.indicePagina.set(0);
  }

  protected mudarPagina(evento: PageEvent): void {
    this.indicePagina.set(evento.pageIndex);
    this.tamanhoPagina.set(evento.pageSize);
  }

  /** Número no formato brasileiro, ex.: 25,8. */
  protected formatar(valor: number): string {
    return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  }
}
