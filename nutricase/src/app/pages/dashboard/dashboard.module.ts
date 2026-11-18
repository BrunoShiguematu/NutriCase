import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DateAdapter, MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDatepickerModule } from '@angular/material/datepicker';

import { MaterialModule } from '../../shared/material.module';
import { DashboardComponent } from './dashboard.component';
import { DataBrasileiraAdapter } from './data-brasileira.adapter';

@NgModule({
  declarations: [DashboardComponent],
  imports: [
    CommonModule,
    MaterialModule,
    MatButtonToggleModule,
    MatDatepickerModule,
    RouterModule.forChild([{ path: '', component: DashboardComponent }]),
  ],
  // provideNativeDateAdapter traz os formatos; o adaptador em seguida o troca por um que lê dia/mês/ano.
  providers: [provideNativeDateAdapter(), { provide: DateAdapter, useClass: DataBrasileiraAdapter }, { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' }],
})
export class DashboardModule {}
