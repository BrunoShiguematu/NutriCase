import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { MaterialModule } from '../../shared/material.module';
import { FichaAtletaComponent } from './ficha-atleta/ficha-atleta.component';
import { ResolucoesComponent } from './resolucoes.component';
import { ResolverComponent } from './resolver/resolver.component';
import { ResultadoComponent } from './resultado/resultado.component';

@NgModule({
  declarations: [ResolucoesComponent, ResolverComponent, FichaAtletaComponent, ResultadoComponent],
  imports: [
    CommonModule,
    MaterialModule,
    RouterModule.forChild([
      { path: '', component: ResolucoesComponent },
      { path: ':id', component: ResolverComponent },
      { path: ':id/resultado', component: ResultadoComponent },
    ]),
  ],
})
export class ResolucoesModule {}
