import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Conquista } from '../../../core/kpis/kpis';

/** Diálogo com as conquistas, as obtidas e as que faltam; o botão Fechar fecha e o foco volta a quem abriu. */
@Component({
  selector: 'app-conquistas-dialog',
  standalone: false,
  styleUrl: './conquistas-dialog.component.scss',
  templateUrl: './conquistas-dialog.component.html',
})
export class ConquistasDialogComponent {
  protected readonly conquistas = inject<readonly Conquista[]>(MAT_DIALOG_DATA);
}
