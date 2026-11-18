import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { MatSidenav } from '@angular/material/sidenav';
import { Router } from '@angular/router';
import { nomeContem } from '../core/services/alimento.service';

const TELAS = [
  { nome: 'Dashboard', rota: '/dashboard' },
  { nome: 'Casos', rota: '/casos' },
  { nome: 'Gestão de casos', rota: '/casos/gestao' },
  { nome: 'Novo caso', rota: '/casos/gestao/novo' },
  { nome: 'Base de alimentos', rota: '/alimentos' },
  { nome: 'Minhas resoluções', rota: '/resolucoes' },
];

@Component({
  selector: 'app-layout',
  standalone: false,
  styleUrl: './layout.component.scss',
  templateUrl: './layout.component.html',
})
export class LayoutComponent {
  private readonly router = inject(Router);
  private readonly botaoLateral = viewChild('botaoLateral', { read: ElementRef<HTMLElement> });
  private readonly botaoTopo = viewChild('botaoTopo', { read: ElementRef<HTMLElement> });

  protected readonly busca = signal('');
  protected readonly telas = computed(() => TELAS.filter((tela) => nomeContem(tela.nome, this.busca())));

  constructor() {
    inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
  }

  protected ir(rota: string, campo: HTMLInputElement): void {
    void this.router.navigateByUrl(rota);
    campo.value = '';
    this.busca.set('');
  }

  protected alternarMenu(sidenav: MatSidenav): void {
    void sidenav.toggle().then((resultado) => (resultado === 'open' ? this.botaoLateral() : this.botaoTopo())?.nativeElement.focus());
  }
}
