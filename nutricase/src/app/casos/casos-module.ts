import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MaterialModule } from '../shared/material-module';
import { CasosRoutingModule } from './casos-routing-module';
import { CasosPage } from './casos-page/casos-page';
import { GestaoCasos } from './gestao-casos/gestao-casos';
import { ConfirmarExclusao } from './confirmar-exclusao/confirmar-exclusao';

@NgModule({
  declarations: [CasosPage, GestaoCasos, ConfirmarExclusao],
  imports: [CommonModule, CasosRoutingModule, MaterialModule],
})
export class CasosModule {}
