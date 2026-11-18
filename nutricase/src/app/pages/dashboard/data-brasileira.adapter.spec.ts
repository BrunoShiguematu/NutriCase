import { TestBed } from '@angular/core/testing';
import { DateAdapter, MAT_DATE_LOCALE } from '@angular/material/core';
import { DataBrasileiraAdapter } from './data-brasileira.adapter';

describe('DataBrasileiraAdapter', () => {
  const adaptador = (): DateAdapter<Date> => {
    TestBed.configureTestingModule({
      providers: [{ provide: DateAdapter, useClass: DataBrasileiraAdapter }, { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' }],
    });
    return TestBed.inject(DateAdapter);
  };

  it('lê dia/mês/ano, não mês/dia/ano', () => {
    const a = adaptador();

    expect(a.parse('07/11/2026', null)).toEqual(new Date(2026, 10, 7));
    expect(a.parse('18/11/2026', null)).toEqual(new Date(2026, 10, 18));
    expect(a.parse(' 1/2/2027 ', null)).toEqual(new Date(2027, 1, 1));
  });

  it('data que não existe é inválida, não vira outra data', () => {
    const a = adaptador();

    expect(a.isValid(a.parse('31/02/2026', null)!)).toBe(false);
    expect(a.isValid(a.parse('29/02/2025', null)!)).toBe(false);
    expect(a.parse('29/02/2024', null)).toEqual(new Date(2024, 1, 29));
    expect(a.isValid(a.parse('00/10/2026', null)!)).toBe(false);
  });

  it('vazio é null; ano de 2 dígitos, ISO e texto solto são inválidos (o nativo chutaria uma data)', () => {
    const a = adaptador();

    expect(a.parse('', null)).toBeNull();
    for (const texto of ['07/11/26', '2026-11-18', '18-11-2026', 'lixo', '18/11']) {
      expect(a.isValid(a.parse(texto, null)!), texto).toBe(false);
    }
  });
});
