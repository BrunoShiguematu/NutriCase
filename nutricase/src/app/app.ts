import { Component, inject } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';

@Component({
  selector: 'app-root',
  standalone: false,
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = 'NutriCase';

  constructor() {
    // index.html carrega a fonte Material Symbols Outlined, não a Material Icons padrão.
    inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
  }
}
