import { Component, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Caso } from '../../core/models';
import { CasoService } from '../../core/services/caso.service';
import { ConfirmarExclusao, DadosConfirmarExclusao } from '../confirmar-exclusao/confirmar-exclusao';

@Component({
  selector: 'app-gestao-casos',
  standalone: false,
  styleUrl: './gestao-casos.scss',
  templateUrl: './gestao-casos.html',
})
export class GestaoCasos {
  private readonly casoService = inject(CasoService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  /** O signal do serviço muda a cada criar/editar/excluir, e a tabela acompanha sozinha. */
  protected readonly casos = this.casoService.casos;
  protected readonly colunas = ['titulo', 'nivel', 'modalidade', 'acoes'];

  protected excluir(caso: Caso): void {
    this.dialog
      .open<ConfirmarExclusao, DadosConfirmarExclusao, boolean>(ConfirmarExclusao, {
        data: { titulo: caso.titulo },
      })
      .afterClosed()
      .subscribe((confirmou) => {
        if (confirmou === true) {
          this.casoService.excluir(caso.id);
          this.snackBar.open('Caso excluído', 'Fechar', { duration: 4000 });
        }
      });
  }
}
