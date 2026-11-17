import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { LayoutComponent } from './layout.component';

// O shell importa só o que usa; o MaterialModule (shared/) fica nos módulos lazy para não pesar no bundle inicial.
@NgModule({
  declarations: [LayoutComponent],
  imports: [
    RouterModule,
    MatSidenavModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatInputModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule
  ],
  exports: [LayoutComponent]
})
export class LayoutModule { }
