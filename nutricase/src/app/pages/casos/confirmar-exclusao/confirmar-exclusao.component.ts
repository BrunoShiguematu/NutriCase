import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface DadosConfirmarExclusao {
  titulo: string;
}

/** Diálogo de confirmação: fecha com `true` ao confirmar e `false` ao cancelar. */
@Component({
  selector: 'app-confirmar-exclusao',
  standalone: false,
  styleUrl: './confirmar-exclusao.component.scss',
  templateUrl: './confirmar-exclusao.component.html',
})
export class ConfirmarExclusaoComponent {
  protected readonly dados = inject<DadosConfirmarExclusao>(MAT_DIALOG_DATA);
}
