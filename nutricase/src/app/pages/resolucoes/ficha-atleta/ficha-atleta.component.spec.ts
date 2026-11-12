import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ATLETAS_EXEMPLO } from '../../../core/data/casos-exemplo';
import { Atleta } from '../../../core/models';
import { ResolucoesModule } from '../resolucoes.module';
import { FichaAtletaComponent } from './ficha-atleta.component';

// Carlos Menezes (exemplo-atleta-1): 28 anos, 70 kg, 177 cm, 14 % de gordura. Pedro Nogueira (exemplo-atleta-5) tem restrição à lactose.
const CARLOS = ATLETAS_EXEMPLO[0];
const PEDRO = ATLETAS_EXEMPLO[4];

describe('FichaAtletaComponent', () => {
  let fixture: ComponentFixture<FichaAtletaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // Importa o módulo (e não só declara o componente): o template é compilado com o escopo do módulo.
      imports: [ResolucoesModule],
    }).compileComponents();
    fixture = TestBed.createComponent(FichaAtletaComponent);
  });

  async function mostrar(atleta: Atleta, modalidade?: string): Promise<HTMLElement> {
    fixture.componentRef.setInput('atleta', atleta);
    if (modalidade !== undefined) {
      fixture.componentRef.setInput('modalidade', modalidade);
    }
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  /** O texto do campo da ficha, pela classe do bloco (`ficha-nome`, `ficha-peso`...). */
  const campo = (raiz: HTMLElement, classe: string): string | undefined =>
    raiz.querySelector(`.${classe} dd`)?.textContent?.trim();

  it('mostra os dados da RF04: pessoais, antropometria, % de gordura, treino, fase, objetivo, restrições e preferências', async () => {
    const raiz = await mostrar(CARLOS, 'Corrida');

    expect(raiz.querySelector('.ficha-titulo')?.textContent).toContain('Ficha do atleta');
    expect(campo(raiz, 'ficha-nome')).toBe('Carlos Menezes');
    expect(campo(raiz, 'ficha-idade')).toBe('28 anos');
    expect(campo(raiz, 'ficha-sexo')).toBe('Masculino');
    expect(campo(raiz, 'ficha-peso')).toBe('70 kg');
    expect(campo(raiz, 'ficha-altura')).toBe('177 cm');
    expect(campo(raiz, 'ficha-gordura')).toBe('14 %');
    expect(campo(raiz, 'ficha-modalidade')).toBe('Corrida');
    expect(campo(raiz, 'ficha-volume')).toBe('90 min/dia, 5x por semana');
    expect(campo(raiz, 'ficha-horario')).toBe('06h00');
    expect(campo(raiz, 'ficha-fase')).toBe('Base');
    expect(campo(raiz, 'ficha-objetivo')).toBe('Completar a primeira maratona');
    expect(campo(raiz, 'ficha-restricoes')).toBe('Nenhuma');
    expect(campo(raiz, 'ficha-preferencias')).toBe('Café da manhã salgado');
  });

  it('cada dado tem o seu rótulo', async () => {
    const raiz = await mostrar(CARLOS, 'Corrida');

    const rotulos = Array.from(raiz.querySelectorAll('.ficha-dado dt'), (dt) => dt.textContent?.trim());

    expect(rotulos).toEqual([
      'Nome',
      'Idade',
      'Sexo',
      'Peso',
      'Altura',
      'Percentual de gordura',
      'Modalidade',
      'Volume de treino',
      'Horário de treino',
      'Fase da periodização',
      'Objetivo',
      'Restrições alimentares',
      'Preferências alimentares',
    ]);
  });

  it('mostra as restrições do atleta', async () => {
    const raiz = await mostrar(PEDRO);

    expect(campo(raiz, 'ficha-restricoes')).toBe('Intolerância à lactose');
  });

  it('lista várias restrições e preferências separadas por vírgula', async () => {
    const raiz = await mostrar({ ...CARLOS, restricoes: ['Lactose', 'Glúten'], preferencias: ['Frutas', 'Aveia'] });

    expect(campo(raiz, 'ficha-restricoes')).toBe('Lactose, Glúten');
    expect(campo(raiz, 'ficha-preferencias')).toBe('Frutas, Aveia');
  });

  it('sem percentual de gordura, diz "Não informado"; sem restrição nem preferência, "Nenhuma"', async () => {
    const { percentualGordura: _gordura, ...semGordura } = CARLOS;

    const raiz = await mostrar({ ...semGordura, restricoes: [], preferencias: [] });

    expect(campo(raiz, 'ficha-gordura')).toBe('Não informado');
    expect(campo(raiz, 'ficha-restricoes')).toBe('Nenhuma');
    expect(campo(raiz, 'ficha-preferencias')).toBe('Nenhuma');
  });

  it('escreve o sexo por extenso e usa vírgula nos decimais', async () => {
    const raiz = await mostrar({ ...CARLOS, sexo: 'feminino', peso: 73.5, altura: 168.5, percentualGordura: 22.5 });

    expect(campo(raiz, 'ficha-sexo')).toBe('Feminino');
    expect(campo(raiz, 'ficha-peso')).toBe('73,5 kg');
    expect(campo(raiz, 'ficha-altura')).toBe('168,5 cm');
    expect(campo(raiz, 'ficha-gordura')).toBe('22,5 %');
  });

  it('sem a modalidade (que é do caso), o campo não aparece', async () => {
    const raiz = await mostrar(CARLOS);

    expect(raiz.querySelector('.ficha-modalidade')).toBeNull();
  });

  it('acompanha o atleta quando ele muda', async () => {
    const raiz = await mostrar(CARLOS);
    expect(campo(raiz, 'ficha-nome')).toBe('Carlos Menezes');

    await mostrar(PEDRO);

    expect(campo(raiz, 'ficha-nome')).toBe('Pedro Nogueira');
  });
});
