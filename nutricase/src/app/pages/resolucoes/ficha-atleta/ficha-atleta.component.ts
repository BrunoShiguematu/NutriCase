import { Component, computed, input } from '@angular/core';
import { Atleta } from '../../../core/models';

/**
 * Ficha do atleta fictício do caso (RF04), sempre visível ao lado do passo a passo (RF05).
 * O modelo `Atleta` não tem modalidade (ela é do caso), então quem usa a passa em `modalidade`.
 */
@Component({
  selector: 'app-ficha-atleta',
  standalone: false,
  styleUrl: './ficha-atleta.component.scss',
  templateUrl: './ficha-atleta.component.html',
})
export class FichaAtletaComponent {
  readonly atleta = input.required<Atleta>();
  /** Modalidade do caso; não aparece na ficha se não vier. */
  readonly modalidade = input<string>();

  protected readonly sexo = computed(() => (this.atleta().sexo === 'feminino' ? 'Feminino' : 'Masculino'));

  /** Número com vírgula decimal (73,5), como no resto do app. */
  protected numero(valor: number): string {
    return valor.toLocaleString('pt-BR');
  }
}
