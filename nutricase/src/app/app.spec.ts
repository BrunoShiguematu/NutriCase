import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { AppModule } from './app-module';

// O spec importa o AppModule (Material + RouterModule com as rotas reais) em vez de redeclarar o App:
// o builder de testes só compila os arquivos alcançados pelos specs, e o App precisa do escopo do AppModule.
describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the brand name in the toolbar', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand')?.textContent).toContain('NutriCase');
  });
});
