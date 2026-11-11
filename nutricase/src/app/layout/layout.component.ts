import { Component, inject } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';

@Component({
  selector: 'app-layout',
  standalone: false,
  styleUrl: './layout.component.scss',
  templateUrl: './layout.component.html',
})
export class LayoutComponent {
  protected readonly title = 'NutriCase';

  constructor() {
    // index.html carrega a fonte Material Symbols Outlined, não a Material Icons padrão.
    inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
  }
}
