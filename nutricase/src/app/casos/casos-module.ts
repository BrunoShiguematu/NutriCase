import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { MaterialModule } from '../shared/material-module';
import { CasosRoutingModule } from './casos-routing-module';
import { CasosPage } from './casos-page/casos-page';
import { GestaoCasos } from './gestao-casos/gestao-casos';
import { ConfirmarExclusao } from './confirmar-exclusao/confirmar-exclusao';
import { CasoForm } from './caso-form/caso-form';

@NgModule({
  declarations: [CasosPage, GestaoCasos, ConfirmarExclusao, CasoForm],
  imports: [CommonModule, ReactiveFormsModule, CasosRoutingModule, MaterialModule],
})
export class CasosModule {}
