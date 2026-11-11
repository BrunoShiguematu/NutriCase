import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { LayoutComponent } from './layout.component';
import { AppModule } from '../app.module';

// O spec importa o AppModule (Material + RouterModule com as rotas reais) em vez de redeclarar o LayoutComponent:
// o builder de testes só compila os arquivos alcançados pelos specs, e o LayoutComponent precisa do escopo do LayoutModule (importado pelo AppModule).
describe('LayoutComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule],
    }).compileComponents();
  });

  it('should create the layout', () => {
    const fixture = TestBed.createComponent(LayoutComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  describe('link ativo do menu', () => {
    /** Navega e devolve as classes `menu-*` dos links marcados como página atual. */
    async function ativosEm(url: string): Promise<string[]> {
      localStorage.clear();
      const fixture = TestBed.createComponent(LayoutComponent);
      await TestBed.inject(Router).navigateByUrl(url);
      fixture.detectChanges();
      await fixture.whenStable();
      const links = (fixture.nativeElement as HTMLElement).querySelectorAll('a[aria-current="page"]');
      return Array.from(links, (link) => Array.from(link.classList).find((c) => c.startsWith('menu-')) ?? '');
    }

    afterEach(() => localStorage.clear());

    it('tem os quatro links do menu, com "Gestão de casos" em /casos/gestao e "Base de alimentos" em /alimentos', () => {
      const fixture = TestBed.createComponent(LayoutComponent);
      fixture.detectChanges();
      const dom = fixture.nativeElement as HTMLElement;

      expect(dom.querySelectorAll('nav a[mat-list-item]').length).toBe(4);
      const gestao = dom.querySelector('.menu-gestao') as HTMLAnchorElement;
      expect(gestao.textContent).toContain('Gestão de casos');
      expect(gestao.getAttribute('href')).toBe('/casos/gestao');
      const alimentos = dom.querySelector('.menu-alimentos') as HTMLAnchorElement;
      expect(alimentos.textContent).toContain('Base de alimentos');
      expect(alimentos.getAttribute('href')).toBe('/alimentos');
    });

    it('/dashboard ativa só Dashboard', async () => {
      expect(await ativosEm('/dashboard')).toEqual(['menu-dashboard']);
    });

    it('/casos ativa só Casos', async () => {
      expect(await ativosEm('/casos')).toEqual(['menu-casos']);
    });

    it('/casos/gestao ativa só Gestão de casos (Casos não fica ativo junto)', async () => {
      expect(await ativosEm('/casos/gestao')).toEqual(['menu-gestao']);
    });

    it('/casos/gestao/novo mantém só Gestão de casos ativo', async () => {
      expect(await ativosEm('/casos/gestao/novo')).toEqual(['menu-gestao']);
    });

    it('/alimentos ativa só Base de alimentos', async () => {
      expect(await ativosEm('/alimentos')).toEqual(['menu-alimentos']);
    });

    it('/casos/gestao/:id/editar mantém só Gestão de casos ativo', async () => {
      expect(await ativosEm('/casos/gestao/exemplo-caso-1/editar')).toEqual(['menu-gestao']);
    });
  });

  it('should render the brand name in the toolbar', async () => {
    const fixture = TestBed.createComponent(LayoutComponent);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand')?.textContent).toContain('NutriCase');
  });
});
