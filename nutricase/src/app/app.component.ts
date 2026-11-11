import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: false,
  // Host em bloco com altura total: o shell (layout/) ocupa a janela inteira.
  styles: [':host { display: block; height: 100%; }'],
  template: '<app-layout></app-layout>',
})
export class AppComponent { }
