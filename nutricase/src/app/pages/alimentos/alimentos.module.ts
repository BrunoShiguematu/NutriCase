import { Injectable, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatPaginatorIntl } from '@angular/material/paginator';

import { MaterialModule } from '../../shared/material-module';
import { AlimentosComponent } from './alimentos.component';

/** Textos do paginador em português (o padrão do Angular Material é em inglês). */
@Injectable()
export class PaginadorPtBr extends MatPaginatorIntl {
  override itemsPerPageLabel = 'Itens por página';
  override nextPageLabel = 'Próxima página';
  override previousPageLabel = 'Página anterior';
  override firstPageLabel = 'Primeira página';
  override lastPageLabel = 'Última página';
  override getRangeLabel = (pagina: number, tamanho: number, total: number): string => {
    if (total === 0) {
      return '0 de 0';
    }
    const inicio = pagina * tamanho;
    return `${inicio + 1} – ${Math.min(inicio + tamanho, total)} de ${total}`;
  };
}

@NgModule({
  declarations: [AlimentosComponent],
  imports: [
    CommonModule,
    MaterialModule,
    RouterModule.forChild([{ path: '', component: AlimentosComponent }]),
  ],
  providers: [{ provide: MatPaginatorIntl, useClass: PaginadorPtBr }],
})
export class AlimentosModule {}
