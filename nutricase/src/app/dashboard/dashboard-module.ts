import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MaterialModule } from '../shared/material-module';
import { DashboardRoutingModule } from './dashboard-routing-module';
import { DashboardPage } from './dashboard-page/dashboard-page';

@NgModule({
  declarations: [DashboardPage],
  imports: [CommonModule, DashboardRoutingModule, MaterialModule],
})
export class DashboardModule {}
