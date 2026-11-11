import { Component, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Caso } from '../../../core/models';
import { CasoService } from '../../../core/services/caso.service';
import { ConfirmarExclusaoComponent, DadosConfirmarExclusao } from '../confirmar-exclusao/confirmar-exclusao.component';

@Component({
  selector: 'app-gestao-casos',
  standalone: false,
  styleUrl: './gestao-casos.component.scss',
  templateUrl: './gestao-casos.component.html',
})
export class GestaoCasosComponent {
  private readonly casoService = inject(CasoService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  /** O signal do serviço muda a cada criar/editar/excluir, e a tabela acompanha sozinha. */
  protected readonly casos = this.casoService.casos;
  protected readonly colunas = ['titulo', 'nivel', 'modalidade', 'acoes'];

  protected excluir(caso: Caso): void {
    this.dialog
      .open<ConfirmarExclusaoComponent, DadosConfirmarExclusao, boolean>(ConfirmarExclusaoComponent, {
        data: { titulo: caso.titulo },
      })
      .afterClosed()
      .subscribe((confirmou) => {
        if (confirmou === true) {
          const excluiu = this.casoService.excluir(caso.id);
          this.snackBar.open(
            excluiu ? 'Caso excluído' : 'Não foi possível excluir: caso não encontrado',
            'Fechar',
            { duration: 4000 },
          );
        }
      });
  }
}
