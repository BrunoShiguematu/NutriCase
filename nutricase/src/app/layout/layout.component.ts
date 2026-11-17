import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { MatSidenav } from '@angular/material/sidenav';
import { Router } from '@angular/router';
import { nomeContem } from '../core/services/alimento.service';

/** Telas da pesquisa da barra superior; as rotas são as do app-routing e dos módulos. */
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
  /** As telas que casam com o texto (sem acento nem maiúsculas); sem texto, todas. */
  protected readonly telas = computed(() => TELAS.filter((tela) => nomeContem(tela.nome, this.busca())));

  constructor() {
    // index.html carrega a fonte Material Symbols Outlined, não a Material Icons padrão.
    inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
  }

  protected ir(rota: string, campo: HTMLInputElement): void {
    void this.router.navigateByUrl(rota);
    campo.value = '';
    this.busca.set('');
  }

  /** Abre ou fecha o menu; o botão que clicou some (o do topo só existe com o menu fechado), então o foco vai para o que ficou visível. */
  protected alternarMenu(sidenav: MatSidenav): void {
    void sidenav.toggle().then((resultado) => (resultado === 'open' ? this.botaoLateral() : this.botaoTopo())?.nativeElement.focus());
  }
}
