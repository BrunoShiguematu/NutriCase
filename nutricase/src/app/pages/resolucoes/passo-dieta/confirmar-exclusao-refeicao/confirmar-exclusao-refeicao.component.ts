import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface DadosConfirmarExclusaoRefeicao {
  nome: string;
  itens: number;
}

@Component({
  selector: 'app-confirmar-exclusao-refeicao',
  standalone: false,
  styleUrl: './confirmar-exclusao-refeicao.component.scss',
  templateUrl: './confirmar-exclusao-refeicao.component.html',
})
export class ConfirmarExclusaoRefeicaoComponent {
  protected readonly dados = inject<DadosConfirmarExclusaoRefeicao>(MAT_DIALOG_DATA);
}
