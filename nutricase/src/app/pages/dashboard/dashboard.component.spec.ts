import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { KpiService } from '../../core/services/kpi.service';
import { DashboardComponent } from './dashboard.component';
import { DashboardModule } from './dashboard.module';

/** Os métodos de escolha são `protected`; o teste os chama como a tela chama. */
interface Tela {
  trocarPeriodo(periodo: 'hoje' | '7' | '30' | 'especifico'): void;
  trocarTipo(tipo: 'calculos' | 'dieta'): void;
  escolherInicio(data: Date | null): void;
  escolherFim(data: Date | null): void;
}

describe('DashboardComponent: filtros', () => {
  function abrir() {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [DashboardModule], providers: [provideRouter([])] });
    const service = TestBed.inject(KpiService);
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    return { service, tela: fixture.componentInstance as unknown as Tela };
  }
  const duracaoEmDias = (s: KpiService) => Math.round((s.filtro().fim.getTime() - s.filtro().inicio.getTime()) / 86_400_000);

  afterEach(() => localStorage.clear());

  it('abre no padrão do serviço: cálculos, 7 dias', () => {
    const { service } = abrir();

    expect(service.filtro().tipo).toBe('calculos');
    expect(duracaoEmDias(service)).toBe(7);
  });

  it('trocar o tipo e o período muda o filtro do serviço', () => {
    const { service, tela } = abrir();

    tela.trocarTipo('dieta');
    tela.trocarPeriodo('30');

    expect(service.filtro().tipo).toBe('dieta');
    expect(duracaoEmDias(service)).toBe(30);
    tela.trocarPeriodo('hoje');
    expect(duracaoEmDias(service)).toBe(1);
  });

  it('Período específico: valido aplica; invertido e mais de 1 ano não mudam o filtro; incompleto também não', () => {
    const { service, tela } = abrir();
    tela.trocarPeriodo('especifico');
    const antes = service.filtro();

    tela.escolherInicio(new Date(2026, 10, 10));
    expect(service.filtro()).toBe(antes); // falta a data final

    tela.escolherFim(new Date(2026, 10, 5));
    expect(service.filtro()).toBe(antes); // invertido

    tela.escolherFim(new Date(2028, 0, 1));
    expect(service.filtro()).toBe(antes); // mais de 1 ano

    tela.escolherFim(new Date(2026, 10, 12));
    expect(service.filtro().inicio).toEqual(new Date(2026, 10, 10, 0, 0, 0, 0));
    expect(service.filtro().fim).toEqual(new Date(2026, 10, 12, 23, 59, 59, 999));
  });

  it('sair do Período específico e voltar zera as datas: sem datas antigas valendo em silêncio', () => {
    const { service, tela } = abrir();
    tela.trocarPeriodo('especifico');
    tela.escolherInicio(new Date(2026, 10, 10));
    tela.escolherFim(new Date(2026, 10, 12));
    const doEspecifico = service.filtro();

    tela.trocarPeriodo('7');
    expect(service.filtro()).not.toBe(doEspecifico);
    tela.trocarPeriodo('especifico'); // os campos voltam vazios

    expect(service.filtro().fim.getTime()).toBeGreaterThan(doEspecifico.fim.getTime()); // continua o período de 7 dias, não o de 10 a 12/11
    tela.escolherFim(new Date(2026, 10, 13)); // só a data final: ainda falta a inicial
    expect(duracaoEmDias(service)).toBe(7);
  });
});
