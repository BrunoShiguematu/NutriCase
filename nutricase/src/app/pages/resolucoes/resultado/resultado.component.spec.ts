import { TestBed } from '@angular/core/testing';
import { ResolucoesModule } from '../resolucoes.module';
import { ResultadoComponent } from './resultado.component';

describe('ResultadoComponent', () => {
  it('mostra o título "Resultado" (o conteúdo é da T11)', async () => {
    await TestBed.configureTestingModule({ imports: [ResolucoesModule] }).compileComponents();

    const fixture = TestBed.createComponent(ResultadoComponent);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('h1.page-title')?.textContent).toContain('Resultado');
  });
});
