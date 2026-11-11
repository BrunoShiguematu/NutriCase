import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CasosPage } from './casos-page/casos-page';
import { GestaoCasos } from './gestao-casos/gestao-casos';

const routes: Routes = [
  { path: '', component: CasosPage },
  { path: 'gestao', component: GestaoCasos },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CasosRoutingModule {}
