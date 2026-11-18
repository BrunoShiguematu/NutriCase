import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: false,
  styles: [':host { display: block; height: 100%; }'],
  template: '<app-layout></app-layout>',
})
export class AppComponent { }
