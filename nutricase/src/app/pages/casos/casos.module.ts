import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { MaterialModule } from '../../shared/material.module';
import { CasosComponent } from './casos.component';
import { GestaoCasosComponent } from './gestao-casos/gestao-casos.component';
import { ConfirmarExclusaoComponent } from './confirmar-exclusao/confirmar-exclusao.component';
import { CasoFormComponent } from './caso-form/caso-form.component';

@NgModule({
  declarations: [CasosComponent, GestaoCasosComponent, ConfirmarExclusaoComponent, CasoFormComponent],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MaterialModule,
    RouterModule.forChild([
      { path: '', component: CasosComponent },
      { path: 'gestao', component: GestaoCasosComponent },
      { path: 'gestao/novo', component: CasoFormComponent },
      { path: 'gestao/:id/editar', component: CasoFormComponent },
    ]),
  ],
})
export class CasosModule {}
