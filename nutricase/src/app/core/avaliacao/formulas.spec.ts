import {
  DadosParaTmb,
  EQUACOES_TMB,
  get,
  gramasPorDia,
  kcalDosMacros,
  podeCalcularTmb,
  tmb,
} from './formulas';

// Valores calculados à mão (conta no comentário de cada caso).
// Atletas de teste, só com os campos que as fórmulas leem.
const HOMEM: DadosParaTmb = { sexo: 'masculino', idade: 30, peso: 70, altura: 175, percentualGordura: 15 };
const MULHER: DadosParaTmb = { sexo: 'feminino', idade: 25, peso: 60, altura: 165, percentualGordura: 25 };

describe('EQUACOES_TMB', () => {
  it('tem os três nomes exatos, nesta ordem', () => {
    expect([...EQUACOES_TMB]).toEqual(['Harris-Benedict revisada', 'Mifflin-St Jeor', 'Cunningham']);
  });
});

describe('tmb — homem de 30 anos, 70 kg, 175 cm, 15 % de gordura', () => {
  it('Harris-Benedict revisada', () => {
    // 88,362 + 13,397×70 + 4,799×175 − 5,677×30
    // = 88,362 + 937,79 + 839,825 − 170,31 = 1695,667
    expect(tmb('Harris-Benedict revisada', HOMEM)).toBeCloseTo(1695.667, 3);
  });

  it('Mifflin-St Jeor', () => {
    // 10×70 + 6,25×175 − 5×30 + 5 = 700 + 1093,75 − 150 + 5 = 1648,75
    expect(tmb('Mifflin-St Jeor', HOMEM)).toBeCloseTo(1648.75, 3);
  });

  it('Cunningham', () => {
    // massa livre de gordura = 70 × (1 − 0,15) = 59,5 kg; 500 + 22×59,5 = 500 + 1309 = 1809
    expect(tmb('Cunningham', HOMEM)).toBeCloseTo(1809, 3);
  });
});

describe('tmb — mulher de 25 anos, 60 kg, 165 cm, 25 % de gordura', () => {
  it('Harris-Benedict revisada', () => {
    // 447,593 + 9,247×60 + 3,098×165 − 4,330×25
    // = 447,593 + 554,82 + 511,17 − 108,25 = 1405,333
    expect(tmb('Harris-Benedict revisada', MULHER)).toBeCloseTo(1405.333, 3);
  });

  it('Mifflin-St Jeor', () => {
    // 10×60 + 6,25×165 − 5×25 − 161 = 600 + 1031,25 − 125 − 161 = 1345,25
    expect(tmb('Mifflin-St Jeor', MULHER)).toBeCloseTo(1345.25, 3);
  });

  it('Cunningham', () => {
    // massa livre de gordura = 60 × (1 − 0,25) = 45 kg; 500 + 22×45 = 500 + 990 = 1490
    expect(tmb('Cunningham', MULHER)).toBeCloseTo(1490, 3);
  });
});

describe('tmb — Cunningham sem percentual de gordura', () => {
  const semGordura: DadosParaTmb = { sexo: 'masculino', idade: 30, peso: 70, altura: 175 };

  it('lança um erro claro em vez de devolver um valor', () => {
    expect(() => tmb('Cunningham', semGordura)).toThrowError(/Cunningham exige o percentual de gordura/);
  });

  it('podeCalcularTmb avisa antes: só a Cunningham depende do percentual', () => {
    expect(podeCalcularTmb('Cunningham', semGordura)).toBe(false);
    expect(podeCalcularTmb('Cunningham', HOMEM)).toBe(true);
    expect(podeCalcularTmb('Harris-Benedict revisada', semGordura)).toBe(true);
    expect(podeCalcularTmb('Mifflin-St Jeor', semGordura)).toBe(true);
  });

  it('as outras duas equações calculam normalmente sem o percentual', () => {
    expect(tmb('Mifflin-St Jeor', semGordura)).toBeCloseTo(1648.75, 3);
    expect(tmb('Harris-Benedict revisada', semGordura)).toBeCloseTo(1695.667, 3);
  });
});

describe('tmb — a idade e o sexo entram onde a fonte manda', () => {
  it('a Cunningham não muda com sexo nem idade', () => {
    const outro: DadosParaTmb = { ...HOMEM, sexo: 'feminino', idade: 60 };
    expect(tmb('Cunningham', outro)).toBe(tmb('Cunningham', HOMEM));
  });

  it('a mesma ficha dá TMB menor para quem tem mais idade (HB e Mifflin)', () => {
    const maisVelho: DadosParaTmb = { ...HOMEM, idade: 40 };
    // 10 anos a mais: HB cai 5,677×10 = 56,77; Mifflin cai 5×10 = 50
    expect(tmb('Harris-Benedict revisada', HOMEM) - tmb('Harris-Benedict revisada', maisVelho)).toBeCloseTo(56.77, 3);
    expect(tmb('Mifflin-St Jeor', HOMEM) - tmb('Mifflin-St Jeor', maisVelho)).toBeCloseTo(50, 3);
  });
});

describe('get', () => {
  it('é a TMB vezes o fator de atividade', () => {
    // 1648,75 × 1,55 = 2473,125 (×1,5) + 82,4375 (×0,05) = 2555,5625
    expect(get(1648.75, 1.55)).toBeCloseTo(2555.5625, 4);
  });

  it('fator 1 devolve a própria TMB', () => {
    expect(get(1345.25, 1)).toBe(1345.25);
  });
});

describe('gramasPorDia', () => {
  it('é g/kg/dia vezes o peso', () => {
    expect(gramasPorDia(6, 70)).toBe(420); // carboidrato: 6 × 70
    expect(gramasPorDia(1.8, 70)).toBeCloseTo(126, 6); // proteína: 1,8 × 70
    expect(gramasPorDia(1, 60)).toBe(60); // gordura: 1 × 60
  });

  it('zero g/kg dá zero grama', () => {
    expect(gramasPorDia(0, 70)).toBe(0);
  });
});

describe('kcalDosMacros', () => {
  it('usa 4 kcal/g de carboidrato e proteína e 9 kcal/g de gordura', () => {
    // cho 420×4 = 1680; ptn 126×4 = 504; lip 70×9 = 630; total 1680 + 504 + 630 = 2814
    expect(kcalDosMacros({ cho: 420, ptn: 126, lip: 70 })).toEqual({ cho: 1680, ptn: 504, lip: 630, total: 2814 });
  });

  it('sem macros, tudo zero', () => {
    expect(kcalDosMacros({ cho: 0, ptn: 0, lip: 0 })).toEqual({ cho: 0, ptn: 0, lip: 0, total: 0 });
  });
});

describe('cadeia completa do atleta de exemplo (homem)', () => {
  it('TMB (Mifflin) → GET (×1,55) → gramas por kg → kcal', () => {
    const tmbKcal = tmb('Mifflin-St Jeor', HOMEM); // 1648,75
    const getKcal = get(tmbKcal, 1.55); // 2555,5625
    const cho = gramasPorDia(6, HOMEM.peso); // 420
    const ptn = gramasPorDia(1.8, HOMEM.peso); // 126
    const lip = gramasPorDia(1, HOMEM.peso); // 70
    expect(getKcal).toBeCloseTo(2555.5625, 4);
    expect(kcalDosMacros({ cho, ptn, lip }).total).toBeCloseTo(2814, 6);
  });
});
