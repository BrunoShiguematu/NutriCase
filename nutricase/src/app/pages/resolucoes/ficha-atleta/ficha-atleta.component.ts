import { Component, computed, input } from '@angular/core';
import { Atleta } from '../../../core/models';

@Component({
  selector: 'app-ficha-atleta',
  standalone: false,
  styleUrl: './ficha-atleta.component.scss',
  templateUrl: './ficha-atleta.component.html',
})
export class FichaAtletaComponent {
  readonly atleta = input.required<Atleta>();
  readonly modalidade = input<string>();

  protected readonly sexo = computed(() => (this.atleta().sexo === 'feminino' ? 'Feminino' : 'Masculino'));

  protected numero(valor: number): string {
    return valor.toLocaleString('pt-BR');
  }
}
