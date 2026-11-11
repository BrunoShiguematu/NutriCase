import { Atleta, EtapaCalculo, RespostaEtapa, TipoEtapa } from '../models';
import { AvaliacaoEtapa, avaliarEtapas, FATOR_MILHAR, KJ_POR_KCAL, LIMITE_SEGURANCA_GET_SOBRE_TMB } from './avaliar-etapas';

// Atleta de teste (o mesmo da T2): homem, 30 anos, 70 kg, 175 cm, 15 % de gordura.
//   TMB Mifflin = 1648,75 | TMB Harris-Benedict revisada = 1695,667 | TMB Cunningham = 1809
//   GET com fator 1,55 sobre a TMB Mifflin = 2555,5625
//   carboidrato 6 g/kg = 420 g | proteína 1,8 g/kg = 126 g | gordura 1 g/kg = 70 g
const HOMEM: Atleta = {
  id: 'atleta-teste',
  nome: 'Atleta de Teste',
  idade: 30,
  sexo: 'masculino',
  peso: 70,
  altura: 175,
  percentualGordura: 15,
  volumeTreino: '60 min/dia',
  horarioTreino: '07h00',
  fasePeriodizacao: 'Base',
  objetivo: 'Teste',
  restricoes: [],
  preferencias: [],
};

const SEM_GORDURA: Atleta = { ...HOMEM };
delete SEM_GORDURA.percentualGordura;

const MIFFLIN = 1648.75;
const HARRIS = 1695.667;
const GET_REFERENCIA = 2555.5625;

const TODAS_AS_EQUACOES = ['Harris-Benedict revisada', 'Mifflin-St Jeor', 'Cunningham'];

/** As 5 etapas de um caso de teste, com tolerância de 5 % em todas (valores de exemplo). */
function criarEtapas(opcoesTmb: string[] = TODAS_AS_EQUACOES): EtapaCalculo[] {
  const base = { casoId: 'caso-teste', tolerancia: 5, criterioReferencia: 'Critério de teste.' };
  return [
    { ...base, id: 'e-tmb', ordem: 1, tipo: 'TMB', parametroReferencia: 'Mifflin-St Jeor', opcoesAceitaveis: opcoesTmb },
    { ...base, id: 'e-get', ordem: 2, tipo: 'GET', parametroReferencia: 1.55, faixaAceitavel: { min: 1.4, max: 1.8 } },
    { ...base, id: 'e-cho', ordem: 3, tipo: 'CHO', parametroReferencia: 6, faixaAceitavel: { min: 5, max: 8 } },
    { ...base, id: 'e-ptn', ordem: 4, tipo: 'PTN', parametroReferencia: 1.8, faixaAceitavel: { min: 1.4, max: 2 } },
    { ...base, id: 'e-lip', ordem: 5, tipo: 'LIP', parametroReferencia: 1, faixaAceitavel: { min: 0.8, max: 1.5 } },
  ];
}

type Resposta = [tipo: TipoEtapa, parametro: string | number, valor: number];

function responder(respostas: Resposta[]): RespostaEtapa[] {
  return respostas.map(([tipo, parametro, valor]) => ({
    id: `r-${tipo}`,
    resolucaoId: 'resolucao-teste',
    etapaId: `e-${tipo.toLowerCase()}`,
    parametro,
    valor,
  }));
}

/** Avalia e devolve o resultado de uma etapa pelo tipo. */
function avaliar(respostas: Resposta[], atleta: Atleta = HOMEM, etapas: EtapaCalculo[] = criarEtapas()): Record<TipoEtapa, AvaliacaoEtapa> {
  const resultado = avaliarEtapas(etapas, responder(respostas), atleta);
  return Object.fromEntries(resultado.map((r) => [r.tipo, r])) as Record<TipoEtapa, AvaliacaoEtapa>;
}

const TMB_CORRETA: Resposta = ['TMB', 'Mifflin-St Jeor', MIFFLIN];
const GET_CORRETO: Resposta = ['GET', 1.55, GET_REFERENCIA];
const TODAS_CORRETAS: Resposta[] = [TMB_CORRETA, GET_CORRETO, ['CHO', 6, 420], ['PTN', 1.8, 126], ['LIP', 1, 70]];

describe('avaliarEtapas — correta', () => {
  it('as 5 etapas conferem com a referência: todas corretas, sem tipo de erro', () => {
    const r = avaliar(TODAS_CORRETAS);

    for (const tipo of ['TMB', 'GET', 'CHO', 'PTN', 'LIP'] as const) {
      expect(r[tipo].respondida).toBe(true);
      expect(r[tipo].classificacao).toBe('correta');
      expect(r[tipo].tipoErro).toBeUndefined();
      expect(r[tipo].motivo.length).toBeGreaterThan(0);
    }
    expect(r.TMB.valorEsperado).toBeCloseTo(1648.75, 6);
    expect(r.GET.valorEsperado).toBeCloseTo(2555.5625, 6);
    expect(r.CHO.valorEsperado).toBeCloseTo(420, 6);
    expect(r.PTN.valorEsperado).toBeCloseTo(126, 6);
    expect(r.LIP.valorEsperado).toBeCloseTo(70, 6);
  });

  it('devolve uma avaliação por etapa, na ordem, com id, tipo e ordem da etapa', () => {
    const resultado = avaliarEtapas(criarEtapas(), responder(TODAS_CORRETAS), HOMEM);

    expect(resultado.map((r) => [r.etapaId, r.tipo, r.ordem])).toEqual([
      ['e-tmb', 'TMB', 1],
      ['e-get', 'GET', 2],
      ['e-cho', 'CHO', 3],
      ['e-ptn', 'PTN', 4],
      ['e-lip', 'LIP', 5],
    ]);
  });

  it('valor dentro da tolerância conta como certo, inclusive no limite exato (±5 %)', () => {
    expect(avaliar([['CHO', 6, 441]]).CHO.classificacao).toBe('correta'); // 420 + 5 %
    expect(avaliar([['CHO', 6, 399]]).CHO.classificacao).toBe('correta'); // 420 − 5 %
    expect(avaliar([['CHO', 6, 441.1]]).CHO.tipoErro).toBe('aritmética');
    expect(avaliar([['CHO', 6, 398.9]]).CHO.tipoErro).toBe('aritmética');
  });

  it('parâmetro numérico dentro da tolerância da referência ainda é a referência', () => {
    // 6,2 g/kg está a 3,3 % de 6: correta (valor 6,2 × 70 = 434)
    expect(avaliar([['CHO', 6.2, 434]]).CHO.classificacao).toBe('correta');
  });

  it('não altera as listas recebidas', () => {
    const etapas = criarEtapas().reverse();
    const respostas = responder(TODAS_CORRETAS);
    const copiaEtapas = JSON.stringify(etapas);
    const copiaRespostas = JSON.stringify(respostas);

    avaliarEtapas(etapas, respostas, HOMEM);

    expect(JSON.stringify(etapas)).toBe(copiaEtapas);
    expect(JSON.stringify(respostas)).toBe(copiaRespostas);
  });

  it('devolve na ordem de `ordem`, mesmo com as etapas embaralhadas', () => {
    const embaralhadas = [criarEtapas()[3], criarEtapas()[0], criarEtapas()[4], criarEtapas()[2], criarEtapas()[1]];
    expect(avaliarEtapas(embaralhadas, [], HOMEM).map((r) => r.tipo)).toEqual(['TMB', 'GET', 'CHO', 'PTN', 'LIP']);
  });
});

describe('avaliarEtapas — divergente (parâmetro aceitável, diferente da referência, valor confere)', () => {
  it('TMB por outra equação aceita, com o valor dessa equação', () => {
    const r = avaliar([['TMB', 'Harris-Benedict revisada', HARRIS]]);

    expect(r.TMB.classificacao).toBe('divergente');
    expect(r.TMB.tipoErro).toBeUndefined();
    expect(r.TMB.valorEsperado).toBeCloseTo(HARRIS, 3);
    expect(r.TMB.motivo).toContain('Mifflin-St Jeor'); // cita a referência do caso
  });

  it('fator de atividade dentro da faixa, mas fora da tolerância da referência', () => {
    // 1,7 está na faixa 1,4–1,8 e a 9,7 % de 1,55; GET coerente com a TMB do estudante: 1648,75 × 1,7 = 2802,875
    const r = avaliar([TMB_CORRETA, ['GET', 1.7, 2802.875]]);

    expect(r.GET.classificacao).toBe('divergente');
    expect(r.GET.tipoErro).toBeUndefined();
  });

  it('g/kg dentro da faixa e fora da tolerância da referência, com os gramas coerentes', () => {
    const r = avaliar([['CHO', 7, 490]]); // 7 × 70 = 490

    expect(r.CHO.classificacao).toBe('divergente');
    expect(r.CHO.valorEsperado).toBe(490);
  });

  it('os limites da faixa são aceitáveis (5 e 8 g/kg): divergente, não erro', () => {
    expect(avaliar([['CHO', 5, 350]]).CHO.classificacao).toBe('divergente');
    expect(avaliar([['CHO', 8, 560]]).CHO.classificacao).toBe('divergente');
  });

  it('valor zero com esperado zero não vira troca de unidade (0 × 4,184 e 0 ÷ 1000 também são 0)', () => {
    const etapas = criarEtapas().map((e) => (e.tipo === 'LIP' ? { ...e, faixaAceitavel: { min: 0, max: 1.5 } } : e));

    const lip = avaliar([['LIP', 0, 0]], HOMEM, etapas).LIP;

    expect(lip.classificacao).toBe('divergente');
    expect(lip.tipoErro).toBeUndefined();
  });
});

describe('avaliarEtapas — erro de fato: escolha de equação', () => {
  it('equação fora das aceitas pelo caso', () => {
    const etapas = criarEtapas(['Mifflin-St Jeor']);

    const r = avaliar([['TMB', 'Harris-Benedict revisada', HARRIS]], HOMEM, etapas);

    expect(r.TMB.classificacao).toBe('erro de fato');
    expect(r.TMB.tipoErro).toBe('escolha de equação');
    expect(r.TMB.valorEsperado).toBeCloseTo(HARRIS, 3); // a equação existe, só não vale neste caso
  });

  it('a referência do caso sempre vale, mesmo que a lista de opções não a repita', () => {
    const etapas = criarEtapas(['Harris-Benedict revisada']);

    expect(avaliar([TMB_CORRETA], HOMEM, etapas).TMB.classificacao).toBe('correta');
  });

  it('nome que o sistema não conhece (mesmo se estiver na lista) e parâmetro que não é texto', () => {
    const etapas = criarEtapas(['Mifflin-St Jeor', 'Katch-McArdle']);

    const desconhecida = avaliar([['TMB', 'Katch-McArdle', 1700]], HOMEM, etapas).TMB;
    const numero = avaliar([['TMB', 1648.75, 1648.75]]).TMB;

    expect(desconhecida.tipoErro).toBe('escolha de equação');
    expect(desconhecida.valorEsperado).toBeUndefined();
    expect(desconhecida.motivo).toContain('não é reconhecida');
    expect(numero.tipoErro).toBe('escolha de equação');
    expect(numero.valorEsperado).toBeUndefined();
  });

  it('vem antes de qualquer conferência do valor: valor absurdo com equação inaceitável continua sendo escolha de equação', () => {
    const etapas = criarEtapas(['Mifflin-St Jeor']);

    expect(avaliar([['TMB', 'Cunningham', 99999]], HOMEM, etapas).TMB.tipoErro).toBe('escolha de equação');
  });
});

describe('avaliarEtapas — Cunningham sem percentual de gordura', () => {
  it('é erro de fato "escolha de equação", sem valor esperado e sem lançar erro', () => {
    const respostas = responder([['TMB', 'Cunningham', 1800]]);

    expect(() => avaliarEtapas(criarEtapas(), respostas, SEM_GORDURA)).not.toThrow();
    const tmbAvaliada = avaliarEtapas(criarEtapas(), respostas, SEM_GORDURA)[0];
    expect(tmbAvaliada.classificacao).toBe('erro de fato');
    expect(tmbAvaliada.tipoErro).toBe('escolha de equação');
    expect(tmbAvaliada.valorEsperado).toBeUndefined();
    expect(tmbAvaliada.motivo).toContain('percentual de gordura');
  });

  it('a mesma escolha vale com a ficha que informa o percentual (correta ou divergente, não erro)', () => {
    const r = avaliar([['TMB', 'Cunningham', 1809]], HOMEM);

    expect(r.TMB.classificacao).toBe('divergente');
    expect(r.TMB.valorEsperado).toBeCloseTo(1809, 6);
  });

  it('as outras equações calculam normalmente na ficha sem percentual', () => {
    expect(avaliar([TMB_CORRETA], SEM_GORDURA).TMB.classificacao).toBe('correta');
  });

  it('o GET seguinte continua sendo avaliado com a TMB que o estudante informou', () => {
    // TMB informada: 1800 com Cunningham (inválida aqui); GET coerente: 1800 × 1,55 = 2790
    const r = avaliar([['TMB', 'Cunningham', 1800], ['GET', 1.55, 2790]], SEM_GORDURA);

    expect(r.TMB.tipoErro).toBe('escolha de equação');
    expect(r.GET.classificacao).toBe('correta');
    expect(r.GET.valorEsperado).toBeCloseTo(2790, 6);
  });
});

describe('avaliarEtapas — erro de fato: meta fora de faixa (parâmetro)', () => {
  it('g/kg abaixo ou acima da faixa aceitável, com o valor esperado a partir dele', () => {
    const acima = avaliar([['CHO', 10, 700]]).CHO;
    const abaixo = avaliar([['CHO', 4.99, 349.3]]).CHO;
    const logoAcima = avaliar([['CHO', 8.01, 560.7]]).CHO;

    expect(acima.classificacao).toBe('erro de fato');
    expect(acima.tipoErro).toBe('meta fora de faixa');
    expect(acima.valorEsperado).toBe(700);
    expect(acima.motivo).toContain('faixa aceitável');
    expect(abaixo.tipoErro).toBe('meta fora de faixa');
    expect(logoAcima.tipoErro).toBe('meta fora de faixa');
  });

  it('fator de atividade fora da faixa', () => {
    const r = avaliar([TMB_CORRETA, ['GET', 2.5, MIFFLIN * 2.5]]);

    expect(r.GET.tipoErro).toBe('meta fora de faixa');
  });

  it('vem antes da conferência do valor: parâmetro fora da faixa com valor errado continua sendo meta fora de faixa', () => {
    expect(avaliar([['PTN', 3, 1]]).PTN.tipoErro).toBe('meta fora de faixa');
  });

  it('parâmetro que é texto numa etapa numérica não lança erro e conta como meta fora de faixa', () => {
    const r = avaliar([['CHO', 'seis', 420]]).CHO;

    expect(r.tipoErro).toBe('meta fora de faixa');
    expect(r.motivo).toContain('não é um número válido');
    expect(r.valorEsperado).toBeUndefined();
  });

  it('etapa numérica sem faixa cadastrada não tem limite de parâmetro', () => {
    const etapas = criarEtapas().map((e) => (e.tipo === 'CHO' ? { ...e, faixaAceitavel: undefined } : e));

    expect(avaliar([['CHO', 12, 840]], HOMEM, etapas).CHO.classificacao).toBe('divergente');
  });
});

describe('avaliarEtapas — RN08: limite de segurança energética', () => {
  it('o limite de exemplo é GET igual à TMB do estudante', () => {
    expect(LIMITE_SEGURANCA_GET_SOBRE_TMB).toBe(1);
  });

  it('GET abaixo da TMB do estudante é meta fora de faixa, mesmo com o fator na faixa', () => {
    const r = avaliar([TMB_CORRETA, ['GET', 1.55, 1500]]);

    expect(r.GET.classificacao).toBe('erro de fato');
    expect(r.GET.tipoErro).toBe('meta fora de faixa');
    expect(r.GET.motivo).toContain('limite de segurança');
    expect(r.GET.valorEsperado).toBeCloseTo(GET_REFERENCIA, 6);
  });

  it('GET igual à TMB ainda passa pelo limite (cai na conferência do valor)', () => {
    const r = avaliar([TMB_CORRETA, ['GET', 1.55, MIFFLIN]]);

    expect(r.GET.tipoErro).toBe('aritmética'); // não é meta fora de faixa
  });

  it('compara com a TMB que o estudante informou, não com a esperada', () => {
    // TMB informada: 1500 (errada). GET 1600 está acima dela (passa o limite), mas não bate com 1500 × 1,55 = 2325.
    const r = avaliar([['TMB', 'Mifflin-St Jeor', 1500], ['GET', 1.55, 1600]]);

    expect(r.GET.tipoErro).toBe('aritmética');
  });

  it('vem antes da conversão de unidade: GET ÷ 4,184 fica abaixo da TMB e é meta fora de faixa', () => {
    const r = avaliar([TMB_CORRETA, ['GET', 1.55, GET_REFERENCIA / KJ_POR_KCAL]]);

    expect(r.GET.tipoErro).toBe('meta fora de faixa');
  });

  it('sem a TMB do estudante não há limite a conferir', () => {
    const r = avaliar([['GET', 1.55, 100]]);

    expect(r.GET.tipoErro).toBeUndefined();
  });
});

describe('avaliarEtapas — erro de fato: conversão de unidade', () => {
  it('valor em kJ (esperado × 4,184)', () => {
    const r = avaliar([['TMB', 'Mifflin-St Jeor', MIFFLIN * KJ_POR_KCAL]]);

    expect(r.TMB.classificacao).toBe('erro de fato');
    expect(r.TMB.tipoErro).toBe('conversão de unidade');
    expect(r.TMB.motivo).toContain('multiplicado por 4,184');
  });

  it('valor dividido por 4,184', () => {
    const r = avaliar([['TMB', 'Mifflin-St Jeor', MIFFLIN / KJ_POR_KCAL]]);

    expect(r.TMB.tipoErro).toBe('conversão de unidade');
    expect(r.TMB.motivo).toContain('dividido por 4,184');
  });

  it('gramas ×1000 e ÷1000 (mg e kg no lugar de g)', () => {
    const mg = avaliar([['CHO', 6, 420 * FATOR_MILHAR]]).CHO;
    const kg = avaliar([['CHO', 6, 420 / FATOR_MILHAR]]).CHO;

    expect(mg.tipoErro).toBe('conversão de unidade');
    expect(mg.motivo).toContain('multiplicado por 1000');
    expect(kg.tipoErro).toBe('conversão de unidade');
    expect(kg.motivo).toContain('dividido por 1000');
  });

  it('GET em kJ, com a TMB em kcal', () => {
    const r = avaliar([TMB_CORRETA, ['GET', 1.55, GET_REFERENCIA * KJ_POR_KCAL]]);

    expect(r.GET.tipoErro).toBe('conversão de unidade');
  });

  it('a conversão é sobre o esperado a partir do parâmetro do estudante, não da referência', () => {
    // 7 g/kg × 70 = 490 g esperado; 490 mil mg é a troca de unidade desse parâmetro
    const r = avaliar([['CHO', 7, 490 * FATOR_MILHAR]]);

    expect(r.CHO.tipoErro).toBe('conversão de unidade');
  });

  it('valor ao acaso que não bate com nenhuma conversão é aritmética', () => {
    expect(avaliar([['CHO', 6, 777]]).CHO.tipoErro).toBe('aritmética');
  });
});

describe('avaliarEtapas — erro de fato: aritmética', () => {
  it('valor fora da tolerância do esperado para o parâmetro escolhido', () => {
    const r = avaliar([['TMB', 'Mifflin-St Jeor', 1500]]); // 9 % abaixo de 1648,75

    expect(r.TMB.classificacao).toBe('erro de fato');
    expect(r.TMB.tipoErro).toBe('aritmética');
    expect(r.TMB.valorEsperado).toBeCloseTo(MIFFLIN, 6);
  });

  it('parâmetro certo e conta errada é aritmética, não divergência', () => {
    expect(avaliar([['PTN', 1.8, 150]]).PTN.tipoErro).toBe('aritmética'); // esperado 126
  });

  it('parâmetro divergente e conta errada também é aritmética', () => {
    expect(avaliar([['CHO', 7, 420]]).CHO.tipoErro).toBe('aritmética'); // 7 g/kg pediria 490 g
  });
});

describe('avaliarEtapas — cadeia do estudante (RN04)', () => {
  it('TMB divergente: o GET é avaliado com a TMB do estudante, não com a de referência', () => {
    // TMB por Harris-Benedict (1695,667): divergente. GET = 1695,667 × 1,55 = 2628,28385, que difere
    // do GET de referência (2555,5625) em 2,8 %, mas é o que a cadeia dele pede.
    const r = avaliar([['TMB', 'Harris-Benedict revisada', HARRIS], ['GET', 1.55, 2628.28385]]);

    expect(r.TMB.classificacao).toBe('divergente');
    expect(r.GET.classificacao).toBe('correta');
    expect(r.GET.valorEsperado).toBeCloseTo(2628.28385, 4);
  });

  it('a TMB do estudante é a que ele escreveu, mesmo errada: TMB com erro de aritmética e GET coerente com ela dá GET correto', () => {
    // TMB 1500 (erro de aritmética). GET = 1500 × 1,55 = 2325: coerente com a TMB dele.
    const r = avaliar([['TMB', 'Mifflin-St Jeor', 1500], ['GET', 1.55, 2325]]);

    expect(r.TMB.tipoErro).toBe('aritmética');
    expect(r.GET.classificacao).toBe('correta');
    expect(r.GET.tipoErro).toBeUndefined();
    expect(r.GET.valorEsperado).toBeCloseTo(2325, 6);
  });

  it('o erro não se espalha às avessas: GET calculado com a TMB certa, depois de uma TMB errada, é incoerente com ela', () => {
    // O estudante escreveu TMB 1500 e depois um GET de 2555,5625 (da TMB certa): 2325 era o esperado.
    const r = avaliar([['TMB', 'Mifflin-St Jeor', 1500], ['GET', 1.55, GET_REFERENCIA]]);

    expect(r.GET.tipoErro).toBe('aritmética');
    expect(r.GET.valorEsperado).toBeCloseTo(2325, 6);
  });

  it('os gramas usam o g/kg do estudante', () => {
    // 7 g/kg × 70 kg = 490 g: coerente; 420 g seria o da referência (6 g/kg)
    const coerente = avaliar([['CHO', 7, 490]]).CHO;
    const dareferencia = avaliar([['CHO', 7, 420]]).CHO;

    expect(coerente.classificacao).toBe('divergente');
    expect(coerente.valorEsperado).toBe(490);
    expect(dareferencia.tipoErro).toBe('aritmética');
  });

  it('cada etapa é avaliada por si: um erro na TMB não altera a classificação das macros', () => {
    const r = avaliar([['TMB', 'Mifflin-St Jeor', 1500], ['GET', 1.55, 2325], ['CHO', 6, 420], ['PTN', 1.8, 126], ['LIP', 1, 70]]);

    expect(r.TMB.tipoErro).toBe('aritmética');
    expect([r.GET, r.CHO, r.PTN, r.LIP].map((e) => e.classificacao)).toEqual(['correta', 'correta', 'correta', 'correta']);
  });
});

describe('avaliarEtapas — número não finito do estudante conta como ausente', () => {
  const NAO_FINITOS = [NaN, Infinity, -Infinity];

  it('valor não finito: a etapa não é avaliada, sem lançar erro', () => {
    for (const valor of NAO_FINITOS) {
      const respostas = responder([['CHO', 6, valor]]);

      expect(() => avaliarEtapas(criarEtapas(), respostas, HOMEM)).not.toThrow();
      const cho = avaliarEtapas(criarEtapas(), respostas, HOMEM)[2];
      expect(cho.respondida).toBe(false);
      expect(cho.classificacao).toBeUndefined();
      expect(cho.tipoErro).toBeUndefined();
      expect(cho.valorEsperado).toBeUndefined();
      expect(cho.motivo).toContain('número inválido');
    }
  });

  it('parâmetro numérico não finito: a etapa não é avaliada, nem vira "meta fora de faixa"', () => {
    for (const parametro of NAO_FINITOS) {
      const cho = avaliar([['CHO', parametro, 420]]).CHO;

      expect(cho.respondida).toBe(false);
      expect(cho.classificacao).toBeUndefined();
      expect(cho.motivo).toContain('número inválido');
    }
  });

  it('TMB com valor não finito não alimenta o GET: sem base, e o valor esperado fica ausente (nunca NaN)', () => {
    for (const valor of NAO_FINITOS) {
      const r = avaliar([['TMB', 'Mifflin-St Jeor', valor], ['GET', 1.55, 2325]]);

      expect(r.TMB.respondida).toBe(false);
      expect(r.GET.respondida).toBe(true);
      expect(r.GET.classificacao).toBeUndefined();
      expect(r.GET.valorEsperado).toBeUndefined();
      expect(r.GET.motivo).toContain('Não foi possível avaliar');
    }
  });

  it('as outras etapas seguem sendo avaliadas normalmente', () => {
    const r = avaliar([['TMB', 'Mifflin-St Jeor', NaN], ['CHO', 6, 420], ['PTN', 1.8, Infinity], ['LIP', 1, 70]]);

    expect(r.CHO.classificacao).toBe('correta');
    expect(r.LIP.classificacao).toBe('correta');
    expect(r.PTN.respondida).toBe(false);
  });

  it('não confunde com valor zero ou negativo, que são números finitos e seguem avaliados', () => {
    expect(avaliar([['CHO', 6, 0]]).CHO.tipoErro).toBe('aritmética');
    expect(avaliar([['CHO', 6, -420]]).CHO.tipoErro).toBe('aritmética');
  });
});

describe('avaliarEtapas — etapa sem resposta', () => {
  it('não classifica e deixa isso explícito', () => {
    const resultado = avaliarEtapas(criarEtapas(), [], HOMEM);

    expect(resultado.length).toBe(5);
    for (const r of resultado) {
      expect(r.respondida).toBe(false);
      expect(r.classificacao).toBeUndefined();
      expect(r.tipoErro).toBeUndefined();
      expect(r.valorEsperado).toBeUndefined();
      expect(r.motivo).toContain('sem resposta');
    }
  });

  it('só as etapas respondidas são avaliadas', () => {
    const r = avaliar([TMB_CORRETA, ['LIP', 1, 70]]);

    expect(r.TMB.classificacao).toBe('correta');
    expect(r.LIP.classificacao).toBe('correta');
    expect([r.GET, r.CHO, r.PTN].map((e) => e.respondida)).toEqual([false, false, false]);
    expect([r.GET, r.CHO, r.PTN].map((e) => e.classificacao)).toEqual([undefined, undefined, undefined]);
  });

  it('resposta de etapa que não está na lista é ignorada', () => {
    const respostas: RespostaEtapa[] = [{ id: 'x', resolucaoId: 'r', etapaId: 'outra-etapa', parametro: 6, valor: 420 }];

    expect(avaliarEtapas(criarEtapas(), respostas, HOMEM).every((r) => !r.respondida)).toBe(true);
  });

  it('GET respondido sem a TMB: respondida, mas não avaliada (sem base) — a menos que o parâmetro já seja inaceitável', () => {
    const semBase = avaliar([['GET', 1.55, GET_REFERENCIA]]).GET;
    const foraDaFaixa = avaliar([['GET', 2.5, 4000]]).GET;

    expect(semBase.respondida).toBe(true);
    expect(semBase.classificacao).toBeUndefined();
    expect(semBase.valorEsperado).toBeUndefined();
    expect(semBase.motivo).toContain('Não foi possível avaliar');
    expect(foraDaFaixa.tipoErro).toBe('meta fora de faixa');
  });

  it('sem nenhuma etapa não há nada para avaliar', () => {
    expect(avaliarEtapas([], [], HOMEM)).toEqual([]);
  });
});
