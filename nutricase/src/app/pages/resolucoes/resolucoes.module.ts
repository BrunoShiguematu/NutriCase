import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { MaterialModule } from '../../shared/material.module';
import { FichaAtletaComponent } from './ficha-atleta/ficha-atleta.component';
import { BuscaAlimentoComponent } from './passo-dieta/busca-alimento/busca-alimento.component';
import { ConfirmarExclusaoRefeicaoComponent } from './passo-dieta/confirmar-exclusao-refeicao/confirmar-exclusao-refeicao.component';
import { PassoDietaComponent } from './passo-dieta/passo-dieta.component';
import { PassoEtapasComponent } from './passo-etapas/passo-etapas.component';
import { PassoJustificativaComponent } from './passo-justificativa/passo-justificativa.component';
import { ConfirmarSubmissaoComponent } from './passo-revisar/confirmar-submissao/confirmar-submissao.component';
import { PassoRevisarComponent } from './passo-revisar/passo-revisar.component';
import { ResolucoesComponent } from './resolucoes.component';
import { ResolverComponent } from './resolver/resolver.component';
import { ResultadoComponent } from './resultado/resultado.component';

@NgModule({
  declarations: [
    ResolucoesComponent,
    ResolverComponent,
    FichaAtletaComponent,
    PassoEtapasComponent,
    PassoDietaComponent,
    BuscaAlimentoComponent,
    ConfirmarExclusaoRefeicaoComponent,
    PassoJustificativaComponent,
    PassoRevisarComponent,
    ConfirmarSubmissaoComponent,
    ResultadoComponent,
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MaterialModule,
    RouterModule.forChild([
      { path: '', component: ResolucoesComponent },
      { path: ':id', component: ResolverComponent },
      { path: ':id/resultado', component: ResultadoComponent },
    ]),
  ],
})
export class ResolucoesModule {}
