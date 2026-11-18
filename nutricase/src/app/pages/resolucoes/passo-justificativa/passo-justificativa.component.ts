import { Component, computed, inject, input, untracked } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Resolucao } from '../../../core/models';
import { ResolucaoService } from '../../../core/services/resolucao.service';

@Component({
  selector: 'app-passo-justificativa',
  standalone: false,
  styleUrl: './passo-justificativa.component.scss',
  templateUrl: './passo-justificativa.component.html',
})
export class PassoJustificativaComponent {
  private readonly service = inject(ResolucaoService);
  private readonly snackBar = inject(MatSnackBar);

  readonly resolucao = input.required<Resolucao>();

  private readonly resolucaoId = computed(() => this.resolucao().id);

  protected readonly formulario = computed(() => {
    const id = this.resolucaoId();
    const salva = untracked(() => this.service.buscar(id)?.justificativa ?? '');
    return new FormGroup({ texto: new FormControl(salva, { nonNullable: true }) });
  });

  salvar(): void {
    const controle = this.formulario().controls.texto;
    if (!controle.dirty) {
      return;
    }
    if (!this.service.salvarJustificativa(this.resolucaoId(), controle.value)) {
      this.snackBar.open('Não foi possível salvar a justificativa', 'Fechar', { duration: 4000 });
      return;
    }
    controle.markAsPristine();
  }

  salvarAtual(): void {
    this.salvar();
  }
}
