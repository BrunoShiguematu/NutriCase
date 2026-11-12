import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface DadosConfirmarExclusaoResolucao {
  /** Título do caso da tentativa (ou o aviso de caso excluído). */
  caso: string;
  /** "dd/MM/yyyy HH:mm" da tentativa, para o estudante reconhecer qual é. */
  data: string;
  submetida: boolean;
}

/** Diálogo de confirmação: fecha com `true` ao confirmar e `false` ao cancelar. */
@Component({
  selector: 'app-confirmar-exclusao-resolucao',
  standalone: false,
  styleUrl: './confirmar-exclusao-resolucao.component.scss',
  templateUrl: './confirmar-exclusao-resolucao.component.html',
})
export class ConfirmarExclusaoResolucaoComponent {
  protected readonly dados = inject<DadosConfirmarExclusaoResolucao>(MAT_DIALOG_DATA);
}
