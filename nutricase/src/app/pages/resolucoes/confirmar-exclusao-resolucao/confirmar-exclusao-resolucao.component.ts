import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface DadosConfirmarExclusaoResolucao {
  caso: string;
  data: string;
  submetida: boolean;
}

@Component({
  selector: 'app-confirmar-exclusao-resolucao',
  standalone: false,
  styleUrl: './confirmar-exclusao-resolucao.component.scss',
  templateUrl: './confirmar-exclusao-resolucao.component.html',
})
export class ConfirmarExclusaoResolucaoComponent {
  protected readonly dados = inject<DadosConfirmarExclusaoResolucao>(MAT_DIALOG_DATA);
}
