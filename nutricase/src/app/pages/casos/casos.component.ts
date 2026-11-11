import { Component, computed, inject, signal } from '@angular/core';
import { Nivel } from '../../core/models';
import { CasoService } from '../../core/services/caso.service';

/** Valor da opção "Todos" dos filtros. */
const TODOS = '';

@Component({
  selector: 'app-casos',
  standalone: false,
  styleUrl: './casos.component.scss',
  templateUrl: './casos.component.html',
})
export class CasosComponent {
  private readonly casoService = inject(CasoService);

  protected readonly niveis: Nivel[] = ['Iniciante', 'Intermediário', 'Avançado'];
  protected readonly todos = TODOS;

  protected readonly nivelSelecionado = signal<Nivel | typeof TODOS>(TODOS);
  protected readonly modalidadeSelecionada = signal<string>(TODOS);

  /** Modalidades dos casos existentes, sem repetição e em ordem alfabética. */
  protected readonly modalidades = computed(() =>
    [...new Set(this.casoService.casos().map((caso) => caso.modalidade))].sort((a, b) =>
      a.localeCompare(b, 'pt-BR'),
    ),
  );

  protected readonly casosFiltrados = computed(() => {
    const nivel = this.nivelSelecionado();
    const modalidade = this.modalidadeSelecionada();
    return this.casoService
      .casos()
      .filter(
        (caso) =>
          (nivel === TODOS || caso.nivel === nivel) &&
          (modalidade === TODOS || caso.modalidade === modalidade),
      );
  });
}
