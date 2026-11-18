import { Alimento, ItemRefeicao, MarcadorRefeicao, Refeicao } from '../models';
import {
  avaliarDieta,
  MAX_PERCENTUAL_KCAL_REFEICAO,
  MetasDoAluno,
  MIN_ALIMENTOS_DIFERENTES,
  MIN_REFEICOES,
  PALAVRAS_RESTRICAO,
  TipoAlerta,
  totaisDaDieta,
} from './avaliar-dieta';

function alimento(id: string, nome: string, kcal: number, carboidrato: number, proteina: number, gordura: number): Alimento {
  return { id, nome, grupo: 'Teste', kcal, carboidrato, proteina, gordura, origem: 'TACO' };
}

const ARROZ = alimento('a-arroz', 'Arroz, tipo 1, cozido', 128, 28.1, 2.5, 0.2);
const FEIJAO = alimento('a-feijao', 'Feijão, carioca, cozido', 76, 13.6, 4.8, 0.5);
const FRANGO = alimento('a-frango', 'Peito de frango, grelhado', 159, 0, 32, 2.5);
const BANANA = alimento('a-banana', 'Banana, prata', 98, 26, 1.3, 0.1);
const AVEIA = alimento('a-aveia', 'Aveia, flocos', 394, 66.6, 13.9, 8.5);
const OVO = alimento('a-ovo', 'Ovo, cozido', 146, 0.6, 13.3, 9.5);
const BASE100 = alimento('a-base', 'Alimento de teste', 100, 10, 5, 2);
const QUEIJO = alimento('a-queijo', 'Queijo, minas, frescal', 264, 3.2, 17.4, 20.2);
const IOGURTE = alimento('a-iogurte', 'IOGURTE natural', 51, 1.9, 4.1, 3);
const LEITE = alimento('a-leite', 'Leite, de vaca, integral', 61, 4.5, 2.9, 3.2);
const REQUEIJAO = alimento('a-requeijao', 'REQUEIJÃO, cremoso', 257, 2.4, 9.6, 23.4);
const CREME_DE_LEITE = alimento('a-creme', 'Creme de leite', 221, 3, 1.9, 22.5);
const AMENDOIM = alimento('a-amendoim', 'Amendoim, torrado', 606, 18.7, 25.3, 53.6);

const TODOS = [ARROZ, FEIJAO, FRANGO, BANANA, AVEIA, OVO, BASE100, QUEIJO, IOGURTE, LEITE, REQUEIJAO, CREME_DE_LEITE, AMENDOIM];

function refeicao(id: string, marcador: MarcadorRefeicao = 'nenhum', nome = `Refeição ${id}`): Refeicao {
  return { id, resolucaoId: 'resolucao-teste', nome, horario: '08:00', marcador };
}

function item(id: string, refeicaoId: string, alimentoId: string, quantidadeGramas: number): ItemRefeicao {
  return { id, refeicaoId, alimentoId, quantidadeGramas };
}

const CASO = { toleranciaDieta: 10 };
const SEM_RESTRICAO = { restricoes: [] as string[] };
const SEM_METAS: MetasDoAluno = {};

const DIETA_COMPLETA = {
  refeicoes: [
    refeicao('r1', 'pré-treino', 'Café da manhã'),
    refeicao('r2', 'nenhum', 'Almoço'),
    refeicao('r3', 'pós-treino', 'Lanche'),
    refeicao('r4', 'nenhum', 'Jantar'),
  ],
  itens: [
    item('i1', 'r1', 'a-aveia', 50),
    item('i2', 'r1', 'a-banana', 100),
    item('i3', 'r2', 'a-arroz', 150),
    item('i4', 'r2', 'a-feijao', 100),
    item('i5', 'r2', 'a-frango', 100),
    item('i6', 'r3', 'a-ovo', 100),
    item('i7', 'r4', 'a-arroz', 150),
    item('i8', 'r4', 'a-frango', 100),
  ],
  metasExatas: { kcal: 1219, cho: 157.8, ptn: 97.85, lip: 19.95 } as MetasDoAluno,
};

const tipos = (alertas: { tipo: TipoAlerta }[]): TipoAlerta[] => alertas.map((a) => a.tipo);

describe('totaisDaDieta', () => {
  it('é a base por 100 g × gramas ÷ 100, por refeição e no dia', () => {
    const t = totaisDaDieta(
      [refeicao('r1'), refeicao('r2')],
      [item('i1', 'r1', 'a-arroz', 200), item('i2', 'r1', 'a-frango', 150), item('i3', 'r2', 'a-banana', 120)],
      TODOS,
    );

    expect(t.porRefeicao.map((r) => r.refeicaoId)).toEqual(['r1', 'r2']);
    expect(t.porRefeicao[0].totais.kcal).toBeCloseTo(494.5, 6);
    expect(t.porRefeicao[0].totais.cho).toBeCloseTo(56.2, 6);
    expect(t.porRefeicao[0].totais.ptn).toBeCloseTo(53, 6);
    expect(t.porRefeicao[0].totais.lip).toBeCloseTo(4.15, 6);
    expect(t.porRefeicao[1].totais.kcal).toBeCloseTo(117.6, 6);
    expect(t.porRefeicao[1].totais.cho).toBeCloseTo(31.2, 6);
    expect(t.dia.kcal).toBeCloseTo(612.1, 6);
    expect(t.dia.cho).toBeCloseTo(87.4, 6);
    expect(t.dia.ptn).toBeCloseTo(54.56, 6);
    expect(t.dia.lip).toBeCloseTo(4.27, 6);
    expect(t.itensIncompletos).toEqual([]);
  });

  it('a dieta completa de exemplo fecha em 1219 kcal, 157,8 g de CHO, 97,85 g de PTN e 19,95 g de LIP', () => {
    const t = totaisDaDieta(DIETA_COMPLETA.refeicoes, DIETA_COMPLETA.itens, TODOS);

    expect(t.porRefeicao.map((r) => r.totais.kcal)).toEqual([295, 427, 146, 351].map((v) => expect.closeTo(v, 6)));
    expect(t.dia.kcal).toBeCloseTo(1219, 6);
    expect(t.dia.cho).toBeCloseTo(157.8, 6);
    expect(t.dia.ptn).toBeCloseTo(97.85, 6);
    expect(t.dia.lip).toBeCloseTo(19.95, 6);
  });

  it('refeição sem itens tem totais zero, e a dieta vazia soma zero', () => {
    const comVazia = totaisDaDieta([refeicao('r1')], [], TODOS);
    const vazia = totaisDaDieta([], [], TODOS);

    expect(comVazia.porRefeicao[0].totais).toEqual({ kcal: 0, cho: 0, ptn: 0, lip: 0 });
    expect(vazia.porRefeicao).toEqual([]);
    expect(vazia.dia).toEqual({ kcal: 0, cho: 0, ptn: 0, lip: 0 });
    expect(vazia.itensIncompletos).toEqual([]);
  });

  describe('dado ausente: o item conta zero e é sinalizado', () => {
    const refeicoes = [refeicao('r1')];

    it('alimento com algum valor ausente (undefined ou null) ou não finito conta inteiro como zero', () => {
      const semKcal = { ...BANANA, id: 'x1', kcal: undefined as unknown as number };
      const semProteina = { ...BANANA, id: 'x2', proteina: null as unknown as number };
      const gorduraNaN = { ...BANANA, id: 'x3', gordura: NaN };
      const itens = [item('i1', 'r1', 'x1', 100), item('i2', 'r1', 'x2', 100), item('i3', 'r1', 'x3', 100), item('i4', 'r1', 'a-arroz', 100)];

      const t = totaisDaDieta(refeicoes, itens, [semKcal, semProteina, gorduraNaN, ARROZ]);

      expect(t.dia).toEqual({ kcal: 128, cho: 28.1, ptn: 2.5, lip: 0.2 });
      expect(t.itensIncompletos).toEqual(['i1', 'i2', 'i3']);
      expect(t.porRefeicao[0].itensIncompletos).toEqual(['i1', 'i2', 'i3']);
    });

    it('alimento que não está na base conta zero e é sinalizado', () => {
      const t = totaisDaDieta(refeicoes, [item('i1', 'r1', 'nao-existe', 100), item('i2', 'r1', 'a-arroz', 100)], TODOS);

      expect(t.dia.kcal).toBe(128);
      expect(t.itensIncompletos).toEqual(['i1']);
    });

    it('quantidade não finita ou negativa conta zero e é sinalizada; zero grama é válido', () => {
      const itens = [item('i1', 'r1', 'a-arroz', NaN), item('i2', 'r1', 'a-arroz', -50), item('i3', 'r1', 'a-arroz', Infinity), item('i4', 'r1', 'a-arroz', 0)];

      const t = totaisDaDieta(refeicoes, itens, TODOS);

      expect(t.dia.kcal).toBe(0);
      expect(t.itensIncompletos).toEqual(['i1', 'i2', 'i3']);
    });

    it('item de uma refeição que não está na lista é ignorado', () => {
      const t = totaisDaDieta(refeicoes, [item('i1', 'outra', 'a-arroz', 100)], TODOS);

      expect(t.dia.kcal).toBe(0);
      expect(t.itensIncompletos).toEqual([]);
    });
  });

  it('não altera as listas recebidas', () => {
    const copia = JSON.stringify([DIETA_COMPLETA.refeicoes, DIETA_COMPLETA.itens, TODOS]);

    totaisDaDieta(DIETA_COMPLETA.refeicoes, DIETA_COMPLETA.itens, TODOS);
    avaliarDieta(DIETA_COMPLETA.refeicoes, DIETA_COMPLETA.itens, TODOS, DIETA_COMPLETA.metasExatas, CASO, SEM_RESTRICAO);

    expect(JSON.stringify([DIETA_COMPLETA.refeicoes, DIETA_COMPLETA.itens, TODOS])).toBe(copia);
  });
});

describe('avaliarDieta — comparativo contra as metas do aluno (RN05)', () => {
  const um = (metas: MetasDoAluno, gramasBase: number, caso = CASO) =>
    avaliarDieta([refeicao('r1')], [item('i1', 'r1', 'a-base', gramasBase)], TODOS, metas, caso, SEM_RESTRICAO);

  it('devolve kcal, cho, ptn e lip, nessa ordem, com total, meta, diferença % e dentro da tolerância', () => {
    const { comparativo } = avaliarDieta(
      DIETA_COMPLETA.refeicoes, DIETA_COMPLETA.itens, TODOS, { kcal: 1100, cho: 157.8, ptn: 97.85, lip: 19.95 }, CASO, SEM_RESTRICAO,
    );

    expect(comparativo.map((c) => c.nutriente)).toEqual(['kcal', 'cho', 'ptn', 'lip']);
    const kcal = comparativo[0];
    expect(kcal.total).toBeCloseTo(1219, 6);
    expect(kcal.meta).toBe(1100);
    expect(kcal.diferencaPercentual).toBeCloseTo(10.818, 3);
    expect(kcal.dentroDaTolerancia).toBe(false);
    expect(kcal.situacao).toBe('fora');
    expect(comparativo[1].diferencaPercentual).toBeCloseTo(0, 6);
    expect(comparativo[1].situacao).toBe('dentro');
  });

  it('dieta igual às metas do aluno: tudo dentro e a dieta não fica fora das metas', () => {
    const r = avaliarDieta(DIETA_COMPLETA.refeicoes, DIETA_COMPLETA.itens, TODOS, DIETA_COMPLETA.metasExatas, CASO, SEM_RESTRICAO);

    expect(r.comparativo.every((c) => c.situacao === 'dentro' && c.dentroDaTolerancia)).toBe(true);
    expect(r.dietaForaDasMetas).toBe(false);
  });

  it('usa as metas DO ALUNO, não as de referência: a mesma dieta está certa para uma cadeia errada e fora para a de referência', () => {
    const caso = { toleranciaDieta: 5 };
    const metasDoAluno: MetasDoAluno = { kcal: 2325, cho: 232.5, ptn: 116.25, lip: 46.5 };
    const metasDeReferencia: MetasDoAluno = { kcal: 2555.5625, cho: 420, ptn: 126, lip: 70 };

    const contraAsDoAluno = um(metasDoAluno, 2325, caso);
    const contraAsDeReferencia = um(metasDeReferencia, 2325, caso);

    expect(contraAsDoAluno.dietaForaDasMetas).toBe(false);
    expect(contraAsDoAluno.comparativo.map((c) => c.meta)).toEqual([2325, 232.5, 116.25, 46.5]);
    expect(contraAsDeReferencia.dietaForaDasMetas).toBe(true);
    expect(contraAsDeReferencia.comparativo[0].diferencaPercentual).toBeCloseTo(-9.02, 2);
  });

  it('o resultado só depende das metas recebidas: mudar a meta do aluno muda o comparativo', () => {
    expect(um({ kcal: 100 }, 100).comparativo[0].situacao).toBe('dentro');
    expect(um({ kcal: 200 }, 100).comparativo[0].situacao).toBe('fora');
  });

  it('a tolerância é a do caso, e o limite exato ainda está dentro (±5 %)', () => {
    const caso = { toleranciaDieta: 5 };

    expect(um({ kcal: 100 }, 105, caso).comparativo[0].situacao).toBe('dentro');
    expect(um({ kcal: 100 }, 95, caso).comparativo[0].situacao).toBe('dentro');
    expect(um({ kcal: 100 }, 105.1, caso).comparativo[0].situacao).toBe('fora');
    expect(um({ kcal: 100 }, 94.9, caso).comparativo[0].situacao).toBe('fora');
    expect(um({ kcal: 100 }, 107, { toleranciaDieta: 10 }).comparativo[0].situacao).toBe('dentro');
    expect(um({ kcal: 100 }, 107, { toleranciaDieta: 5 }).comparativo[0].situacao).toBe('fora');
  });

  it('a diferença % é negativa quando a dieta fica abaixo da meta', () => {
    expect(um({ kcal: 200 }, 150).comparativo[0].diferencaPercentual).toBeCloseTo(-25, 6);
  });

  it('tolerância ausente ou inválida (dado antigo) cai no padrão, sem lançar erro', () => {
    const semTolerancia = {} as { toleranciaDieta: number };

    expect(() => um({ kcal: 100 }, 107, semTolerancia)).not.toThrow();
    expect(um({ kcal: 100 }, 107, semTolerancia).comparativo[0].situacao).toBe('dentro');
    expect(um({ kcal: 100 }, 107, { toleranciaDieta: NaN }).comparativo[0].situacao).toBe('dentro');
    expect(um({ kcal: 100 }, 107, { toleranciaDieta: -5 }).comparativo[0].situacao).toBe('dentro');
  });

  describe('meta ausente ou não finita: "sem meta", sem lançar erro', () => {
    it('undefined, null, NaN e Infinity', () => {
      for (const meta of [undefined, null, NaN, Infinity, -Infinity]) {
        expect(() => um({ kcal: meta }, 100)).not.toThrow();
        const c = um({ kcal: meta }, 100).comparativo[0];

        expect(c.situacao).toBe('sem meta');
        expect(c.total).toBe(100);
        expect(c.meta).toBeUndefined();
        expect(c.diferencaPercentual).toBeUndefined();
        expect(c.dentroDaTolerancia).toBeUndefined();
      }
    });

    it('sem nenhuma meta, tudo "sem meta" e a dieta não fica fora das metas', () => {
      const r = um(SEM_METAS, 100);

      expect(r.comparativo.map((c) => c.situacao)).toEqual(['sem meta', 'sem meta', 'sem meta', 'sem meta']);
      expect(r.dietaForaDasMetas).toBe(false);
    });

    it('"sem meta" não esconde as outras: uma meta fora ainda marca a dieta como fora das metas', () => {
      const r = um({ kcal: 100, cho: NaN, ptn: undefined, lip: 1 }, 100);

      expect(r.comparativo.map((c) => c.situacao)).toEqual(['dentro', 'sem meta', 'sem meta', 'fora']);
      expect(r.dietaForaDasMetas).toBe(true);
    });
  });

  it('meta zero: dentro só com total zero (diferença 0); com total maior, fora e diferença indefinida', () => {
    const zerado = avaliarDieta([refeicao('r1')], [], TODOS, { kcal: 0 }, CASO, SEM_RESTRICAO).comparativo[0];
    const comTotal = um({ kcal: 0 }, 100).comparativo[0];

    expect(zerado.situacao).toBe('dentro');
    expect(zerado.diferencaPercentual).toBe(0);
    expect(comTotal.situacao).toBe('fora');
    expect(comTotal.diferencaPercentual).toBeUndefined();
  });

  it('dieta vazia contra metas positivas: tudo fora (−100 %) e dieta fora das metas', () => {
    const r = avaliarDieta([], [], TODOS, { kcal: 2000, cho: 300, ptn: 100, lip: 60 }, CASO, SEM_RESTRICAO);

    expect(r.totais.dia).toEqual({ kcal: 0, cho: 0, ptn: 0, lip: 0 });
    expect(r.comparativo.map((c) => c.diferencaPercentual)).toEqual([-100, -100, -100, -100]);
    expect(r.dietaForaDasMetas).toBe(true);
  });

  it('os totais da avaliação são os de totaisDaDieta, com os itens incompletos', () => {
    const semValor = { ...BANANA, id: 'x', kcal: null as unknown as number };
    const itens = [item('i1', 'r1', 'x', 100), item('i2', 'r1', 'a-arroz', 100)];

    const r = avaliarDieta([refeicao('r1')], itens, [semValor, ARROZ], SEM_METAS, CASO, SEM_RESTRICAO);

    expect(r.totais).toEqual(totaisDaDieta([refeicao('r1')], itens, [semValor, ARROZ]));
    expect(r.totais.itensIncompletos).toEqual(['i1']);
  });
});

describe('avaliarDieta — alertas', () => {
  const alertasDe = (refeicoes: Refeicao[], itens: ItemRefeicao[], restricoes: string[] = []) =>
    avaliarDieta(refeicoes, itens, TODOS, SEM_METAS, CASO, { restricoes }).alertas;

  it('a dieta completa de exemplo não tem alerta nenhum', () => {
    expect(alertasDe(DIETA_COMPLETA.refeicoes, DIETA_COMPLETA.itens)).toEqual([]);
  });

  it('as constantes de exemplo são 3 refeições, 40 % e 5 alimentos', () => {
    expect(MIN_REFEICOES).toBe(3);
    expect(MAX_PERCENTUAL_KCAL_REFEICAO).toBe(40);
    expect(MIN_ALIMENTOS_DIFERENTES).toBe(5);
  });

  describe('pré-treino e pós-treino', () => {
    const itens = DIETA_COMPLETA.itens;

    it('falta pré-treino', () => {
      const refeicoes = DIETA_COMPLETA.refeicoes.map((r) => (r.marcador === 'pré-treino' ? { ...r, marcador: 'nenhum' as const } : r));

      const alertas = alertasDe(refeicoes, itens);

      expect(tipos(alertas)).toEqual(['falta pré-treino']);
      expect(alertas[0].texto).toContain('pré-treino');
    });

    it('falta pós-treino', () => {
      const refeicoes = DIETA_COMPLETA.refeicoes.map((r) => (r.marcador === 'pós-treino' ? { ...r, marcador: 'nenhum' as const } : r));

      const alertas = alertasDe(refeicoes, itens);

      expect(tipos(alertas)).toEqual(['falta pós-treino']);
      expect(alertas[0].texto).toContain('pós-treino');
    });

    it('faltam os dois, na ordem pré e pós', () => {
      const refeicoes = DIETA_COMPLETA.refeicoes.map((r) => ({ ...r, marcador: 'nenhum' as const }));

      expect(tipos(alertasDe(refeicoes, itens))).toEqual(['falta pré-treino', 'falta pós-treino']);
    });

    it('uma refeição basta para cada marcador, mesmo repetida', () => {
      const refeicoes = [...DIETA_COMPLETA.refeicoes, refeicao('r5', 'pré-treino')];

      expect(tipos(alertasDe(refeicoes, itens))).toEqual([]);
    });
  });

  describe('restrição violada (RN09)', () => {
    const lactose = ['Intolerância à lactose'];
    const comAlimento = (alimentoId: string, restricoes: string[]) => {
      const refeicoes = [refeicao('r1', 'pré-treino', 'Lanche'), refeicao('r2', 'pós-treino'), refeicao('r3')];
      const itens = [item('i1', 'r1', alimentoId, 100), item('i2', 'r2', 'a-arroz', 100), item('i3', 'r3', 'a-feijao', 100)];
      return alertasDe(refeicoes, itens, restricoes).filter((a) => a.tipo === 'restrição violada');
    };

    it('o mapeamento de exemplo tem a lactose com as cinco palavras', () => {
      expect(PALAVRAS_RESTRICAO['Intolerância à lactose']).toEqual(['leite', 'queijo', 'iogurte', 'requeijão', 'creme de leite']);
    });

    it('cada palavra de lactose gera o alerta, com a refeição e o alimento', () => {
      for (const alimentoId of ['a-leite', 'a-queijo', 'a-iogurte', 'a-requeijao', 'a-creme']) {
        const alertas = comAlimento(alimentoId, lactose);

        expect(alertas.length).toBe(1);
        expect(alertas[0].alimentoId).toBe(alimentoId);
        expect(alertas[0].refeicaoId).toBe('r1');
        expect(alertas[0].texto).toContain('Intolerância à lactose');
        expect(alertas[0].texto).toContain('Lanche');
      }
    });

    it('compara sem acento e sem diferenciar maiúsculas, nos dois lados', () => {
      expect(comAlimento('a-iogurte', lactose).length).toBe(1);
      expect(comAlimento('a-requeijao', lactose).length).toBe(1);
      expect(comAlimento('a-leite', ['INTOLERANCIA A LACTOSE']).length).toBe(1);
      expect(comAlimento('a-leite', ['  intolerância   à lactose '])).toHaveLength(1);
    });

    it('alimento que não tem palavra da restrição não gera alerta', () => {
      expect(comAlimento('a-banana', lactose)).toEqual([]);
    });

    it('restrição sem mapeamento é ignorada, mesmo com o alimento óbvio na dieta', () => {
      expect(comAlimento('a-amendoim', ['Alergia a amendoim'])).toEqual([]);
      expect(comAlimento('a-leite', ['Glúten'])).toEqual([]);
    });

    it('sem restrição na ficha, nada é verificado', () => {
      expect(comAlimento('a-leite', [])).toEqual([]);
    });

    it('casa pelo começo da palavra: "Queijos" vale (plural), mas "leite" no meio de outra palavra não vale', () => {
      const plural = alimento('a-plural', 'Queijos variados', 300, 1, 20, 25);
      const meioDePalavra = alimento('a-meio', 'Chocoleite em pó', 380, 80, 5, 3);
      const refeicoes = [refeicao('r1')];
      const violacoes = (a: Alimento) =>
        avaliarDieta(refeicoes, [item('i1', 'r1', a.id, 50)], [a], SEM_METAS, CASO, { restricoes: lactose }).alertas.filter(
          (x) => x.tipo === 'restrição violada',
        );

      expect(violacoes(plural).length).toBe(1);
      expect(violacoes(meioDePalavra)).toEqual([]);
    });

    it('nome com mais de uma palavra da restrição ("creme de leite" tem "leite" também) gera um alerta só', () => {
      const creme = alimento('a-composto', 'Creme de leite, light', 150, 4, 2, 14);

      const alertas = avaliarDieta([refeicao('r1')], [item('i1', 'r1', 'a-composto', 30)], [creme], SEM_METAS, CASO, { restricoes: lactose }).alertas;

      expect(alertas.filter((x) => x.tipo === 'restrição violada').length).toBe(1);
    });

    it('o mesmo alimento em duas refeições gera um alerta em cada uma', () => {
      const refeicoes = [refeicao('r1'), refeicao('r2')];
      const itens = [item('i1', 'r1', 'a-leite', 200), item('i2', 'r2', 'a-leite', 100)];

      const alertas = alertasDe(refeicoes, itens, lactose).filter((a) => a.tipo === 'restrição violada');

      expect(alertas.map((a) => a.refeicaoId)).toEqual(['r1', 'r2']);
    });
  });

  describe('menos de 3 refeições', () => {
    it('2 refeições alertam; 3 não', () => {
      const itens = (n: number) => Array.from({ length: n }, (_, i) => item(`i${i}`, `r${i + 1}`, 'a-base', 100));
      const duas = [refeicao('r1', 'pré-treino'), refeicao('r2', 'pós-treino')];
      const tres = [...duas, refeicao('r3')];

      const alertaDuas = alertasDe(duas, itens(2)).filter((a) => a.tipo === 'poucas refeições');
      expect(alertaDuas.length).toBe(1);
      expect(alertaDuas[0].texto).toContain('menos de 3 refeições');
      expect(alertaDuas[0].texto).toContain('tem 2');
      expect(tipos(alertasDe(tres, itens(3)))).not.toContain('poucas refeições');
    });
  });

  describe('refeição com mais de 40 % das kcal do dia', () => {
    const dividir = (gramas: [number, number, number]) => {
      const refeicoes = [refeicao('r1', 'pré-treino', 'Almoço'), refeicao('r2', 'pós-treino'), refeicao('r3')];
      const itens = gramas.map((g, i) => item(`i${i}`, `r${i + 1}`, 'a-base', g));
      return alertasDe(refeicoes, itens).filter((a) => a.tipo === 'refeição concentra kcal');
    };

    it('uma refeição com 50 % alerta, com a refeição e o percentual', () => {
      const alertas = dividir([300, 150, 150]);

      expect(alertas.length).toBe(1);
      expect(alertas[0].refeicaoId).toBe('r1');
      expect(alertas[0].texto).toContain('Almoço');
      expect(alertas[0].texto).toContain('50%');
    });

    it('exatamente 40 % ainda é aceitável; logo acima alerta', () => {
      expect(dividir([400, 300, 300])).toEqual([]);
      expect(dividir([401, 300, 299]).length).toBe(1);
    });

    it('mais de uma refeição acima do limite gera um alerta para cada uma', () => {
      const refeicoes = [refeicao('r1', 'pré-treino'), refeicao('r2', 'pós-treino'), refeicao('r3')];
      const itens = [item('i1', 'r1', 'a-base', 450), item('i2', 'r2', 'a-base', 450), item('i3', 'r3', 'a-base', 100)];

      const alertas = alertasDe(refeicoes, itens).filter((a) => a.tipo === 'refeição concentra kcal');

      expect(alertas.map((a) => a.refeicaoId)).toEqual(['r1', 'r2']);
    });

    it('dia sem kcal não divide por zero e não alerta', () => {
      expect(dividir([0, 0, 0])).toEqual([]);
    });
  });

  describe('menos de 5 alimentos diferentes', () => {
    const comAlimentos = (ids: string[]) => {
      const refeicoes = [refeicao('r1', 'pré-treino'), refeicao('r2', 'pós-treino'), refeicao('r3')];
      const itens = ids.map((id, i) => item(`i${i}`, `r${(i % 3) + 1}`, id, 100));
      return alertasDe(refeicoes, itens).filter((a) => a.tipo === 'pouca variedade');
    };

    it('4 diferentes alertam; 5 não', () => {
      const quatro = comAlimentos(['a-arroz', 'a-feijao', 'a-frango', 'a-banana']);
      expect(quatro.length).toBe(1);
      expect(quatro[0].texto).toContain('menos de 5 alimentos');
      expect(quatro[0].texto).toContain('tem 4');
      expect(comAlimentos(['a-arroz', 'a-feijao', 'a-frango', 'a-banana', 'a-ovo'])).toEqual([]);
    });

    it('o mesmo alimento repetido conta uma vez só', () => {
      const repetido = comAlimentos(['a-arroz', 'a-arroz', 'a-feijao', 'a-feijao', 'a-frango', 'a-frango', 'a-banana', 'a-banana']);

      expect(repetido.length).toBe(1);
      expect(repetido[0].texto).toContain('tem 4');
    });
  });

  it('dieta vazia: faltam pré, pós, refeições e variedade (e nada de restrição nem de concentração)', () => {
    const alertas = alertasDe([], [], ['Intolerância à lactose']);

    expect(tipos(alertas)).toEqual(['falta pré-treino', 'falta pós-treino', 'poucas refeições', 'pouca variedade']);
  });

  it('vários alertas saem na ordem: treino, restrição, refeições, concentração, variedade', () => {
    const refeicoes = [refeicao('r1', 'nenhum', 'Único')];
    const itens = [item('i1', 'r1', 'a-leite', 100)];

    const alertas = alertasDe(refeicoes, itens, ['Intolerância à lactose']);

    expect(tipos(alertas)).toEqual([
      'falta pré-treino',
      'falta pós-treino',
      'restrição violada',
      'poucas refeições',
      'refeição concentra kcal',
      'pouca variedade',
    ]);
  });

  it('ficha sem a lista de restrições não lança erro', () => {
    const semLista = {} as { restricoes: string[] };

    expect(() => avaliarDieta([], [], TODOS, SEM_METAS, CASO, semLista)).not.toThrow();
  });
});
