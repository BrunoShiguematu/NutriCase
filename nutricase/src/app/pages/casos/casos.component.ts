import { Component, computed, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Nivel } from '../../core/models';
import { CasoService } from '../../core/services/caso.service';
import { ResolucaoService } from '../../core/services/resolucao.service';

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
  private readonly resolucaoService = inject(ResolucaoService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

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

  /** Começa uma tentativa do caso e abre a tela de resolução dela. */
  protected resolver(casoId: string): void {
    const resolucao = this.resolucaoService.iniciar(casoId);
    if (!resolucao) {
      this.snackBar.open('Não foi possível iniciar: caso não encontrado', 'Fechar', { duration: 4000 });
      return;
    }
    void this.router.navigate(['/resolucoes', resolucao.id]);
  }
}
