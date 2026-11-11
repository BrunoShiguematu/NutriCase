import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MaterialModule } from '../shared/material-module';
import { CasosRoutingModule } from './casos-routing-module';
import { CasosPage } from './casos-page/casos-page';

@NgModule({
  declarations: [CasosPage],
  imports: [CommonModule, CasosRoutingModule, MaterialModule],
})
export class CasosModule {}
