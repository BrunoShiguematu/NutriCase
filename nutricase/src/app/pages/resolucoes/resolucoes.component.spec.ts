import { TestBed } from '@angular/core/testing';
import { ResolucoesModule } from './resolucoes.module';
import { ResolucoesComponent } from './resolucoes.component';

describe('ResolucoesComponent', () => {
  it('mostra o título "Minhas resoluções" (a lista é da T12)', async () => {
    await TestBed.configureTestingModule({ imports: [ResolucoesModule] }).compileComponents();

    const fixture = TestBed.createComponent(ResolucoesComponent);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('h1.page-title')?.textContent).toContain('Minhas resoluções');
  });
});
