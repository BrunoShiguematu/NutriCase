import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface DadosConfirmarExclusaoRefeicao {
  nome: string;
  /** Quantos itens a refeição tem; vão junto com ela. */
  itens: number;
}

/** Diálogo de confirmação: fecha com `true` ao confirmar e `false` ao cancelar. */
@Component({
  selector: 'app-confirmar-exclusao-refeicao',
  standalone: false,
  styleUrl: './confirmar-exclusao-refeicao.component.scss',
  templateUrl: './confirmar-exclusao-refeicao.component.html',
})
export class ConfirmarExclusaoRefeicaoComponent {
  protected readonly dados = inject<DadosConfirmarExclusaoRefeicao>(MAT_DIALOG_DATA);
}
