import { Component, computed, inject, input, untracked } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Resolucao } from '../../../core/models';
import { ResolucaoService } from '../../../core/services/resolucao.service';

/**
 * Passo "Justificativa" da resolução: um texto livre para explicar as escolhas da dieta (RF19). É opcional:
 * não é pendência e não bloqueia a submissão. Nunca é avaliada (RF20, RN10), e o aviso disso fica sempre à
 * vista. Salva ao sair do campo e ao sair do passo (`salvarAtual`, chamado pelo resolver), e só quando o texto
 * mudou.
 */
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

  /**
   * O texto da tentativa, refeito só se a tentativa mudar. O objeto da tentativa é novo a cada gravação, então
   * o formulário não pode depender dele: seria refeito e perderia o que está sendo digitado.
   */
  protected readonly formulario = computed(() => {
    const id = this.resolucaoId(); // lido fora do untracked: é ele que faz o formulário ser refeito
    const salva = untracked(() => this.service.buscar(id)?.justificativa ?? '');
    return new FormGroup({ texto: new FormControl(salva, { nonNullable: true }) });
  });

  /** Salva a justificativa se ela mudou desde a última gravação. */
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

  /** O resolver chama ao sair do passo. */
  salvarAtual(): void {
    this.salvar();
  }
}
