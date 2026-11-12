import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ResolucoesComponent } from './resolucoes.component';
import { ResolverComponent } from './resolver/resolver.component';
import { ResultadoComponent } from './resultado/resultado.component';

describe('rotas de resoluções (carregadas sob demanda em /resolucoes)', () => {
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'resolucoes', loadChildren: () => import('./resolucoes.module').then((m) => m.ResolucoesModule) },
        ]),
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => localStorage.clear());

  it('/resolucoes abre a lista', async () => {
    expect(await harness.navigateByUrl('/resolucoes')).toBeInstanceOf(ResolucoesComponent);
  });

  it('/resolucoes/:id abre a tela de resolver', async () => {
    expect(await harness.navigateByUrl('/resolucoes/qualquer-id')).toBeInstanceOf(ResolverComponent);
  });

  it('/resolucoes/:id/resultado abre o resultado', async () => {
    expect(await harness.navigateByUrl('/resolucoes/qualquer-id/resultado')).toBeInstanceOf(ResultadoComponent);
  });
});
