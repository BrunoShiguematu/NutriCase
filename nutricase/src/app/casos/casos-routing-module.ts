import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CasosPage } from './casos-page/casos-page';

const routes: Routes = [{ path: '', component: CasosPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CasosRoutingModule {}
