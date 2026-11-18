import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DateAdapter, MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { MaterialModule } from '../../shared/material.module';
import { ConquistasDialogComponent } from './conquistas-dialog/conquistas-dialog.component';
import { DashboardComponent } from './dashboard.component';
import { DataBrasileiraAdapter } from './data-brasileira.adapter';

@NgModule({
  declarations: [DashboardComponent, ConquistasDialogComponent],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MaterialModule,
    MatButtonToggleModule,
    MatDatepickerModule,
    MatProgressSpinnerModule,
    RouterModule.forChild([{ path: '', component: DashboardComponent }]),
  ],
  providers: [provideNativeDateAdapter(), { provide: DateAdapter, useClass: DataBrasileiraAdapter }, { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' }],
})
export class DashboardModule {}
