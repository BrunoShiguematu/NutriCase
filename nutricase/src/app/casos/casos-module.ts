import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { CasosRoutingModule } from './casos-routing-module';
import { CasosPage } from './casos-page/casos-page';

@NgModule({
  declarations: [CasosPage],
  imports: [CommonModule, CasosRoutingModule],
})
export class CasosModule {}
