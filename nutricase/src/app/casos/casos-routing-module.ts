import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CasosPage } from './casos-page/casos-page';
import { GestaoCasos } from './gestao-casos/gestao-casos';
import { CasoForm } from './caso-form/caso-form';

const routes: Routes = [
  { path: '', component: CasosPage },
  { path: 'gestao', component: GestaoCasos },
  { path: 'gestao/novo', component: CasoForm },
  { path: 'gestao/:id/editar', component: CasoForm },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CasosRoutingModule {}
