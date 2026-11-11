import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AlimentosPage } from './alimentos-page/alimentos-page';

const routes: Routes = [{ path: '', component: AlimentosPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AlimentosRoutingModule {}
