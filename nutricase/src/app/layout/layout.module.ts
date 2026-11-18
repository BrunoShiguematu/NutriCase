import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { LayoutComponent } from './layout.component';

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
    MatMenuModule,
    MatIconModule,
    MatButtonModule
  ],
  exports: [LayoutComponent]
})
export class LayoutModule { }
