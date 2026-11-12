import { Alimento, Resolucao } from '../models';
import { AlimentoService, CarregadorTaco } from './alimento.service';
import { CasoService } from './caso.service';
import { KpiService } from './kpi.service';
import { ResolucaoService, TIPOS_ERRO } from './resolucao.service';
import { StorageService } from './storage.service';

const CASO_1 = 'exemplo-caso-1'; // Carlos: GET de referência 1,8

// Contas à mão do caso 1 (Mifflin-St Jeor): TMB 1671,25; GET 3008,25; CHO 420 g; PTN 112 g; LIP 70 g.
const CORRETAS = {
  TMB: ['Mifflin-St Jeor', 1671.25],
  GET: [1.8, 3008.25],
  CHO: [6, 420],
  PTN: [1.6, 112],
  LIP: [1, 70],
} as const;
type Tipo = keyof typeof CORRETAS;
type Respostas = Record<Tipo, readonly [string | number, number]>;

function alimento(id: string): Alimento {
  return { id, nome: `Alimento ${id}`, grupo: 'Teste', kcal: 100, carboidrato: 14, proteina: 3.7, gordura: 2.3, origem: 'TACO' };
}
const ALIMENTOS = ['a1', 'a2', 'a3', 'a4', 'a5'].map(alimento);

function abrir() {
  const storage = new StorageService();
  const casos = new CasoService(storage);
  const carregador: CarregadorTaco = async () => ALIMENTOS.map((a) => ({ ...a }));
  const alimentos = new AlimentoService(storage, carregador);
  const resolucoes = new ResolucaoService(storage, casos, alimentos);
  return { casos, resolucoes, kpis: new KpiService(resolucoes) };
}
type Servicos = ReturnType<typeof abrir>;

function responder({ resolucoes, casos }: Servicos, resolucao: Resolucao, respostas: Partial<Respostas> = {}): void {
  for (const etapa of casos.listarEtapas(resolucao.casoId)) {
    const [parametro, valor] = respostas[etapa.tipo] ?? CORRETAS[etapa.tipo];
    expect(resolucoes.salvarResposta(resolucao.id, etapa.id, parametro, valor), etapa.tipo).toBeDefined();
  }
}

function montarDieta({ resolucoes }: Servicos, resolucaoId: string): void {
  const refeicao = (nome: string, horario: string, marcador: 'pré-treino' | 'pós-treino' | 'nenhum') =>
    resolucoes.criarRefeicao(resolucaoId, { nome, horario, marcador })!;
  const cafe = refeicao('Café', '06:30', 'pré-treino');
  const almoco = refeicao('Almoço', '12:00', 'nenhum');
  const lanche = refeicao('Lanche', '16:00', 'pós-treino');
  const jantar = refeicao('Jantar', '19:30', 'nenhum');
  const item = (r: { id: string }, alimentoId: string, quantidadeGramas: number) =>
    resolucoes.criarItem(r.id, { alimentoId, quantidadeGramas });
  item(cafe, 'a1', 500);
  item(cafe, 'a2', 500);
  item(almoco, 'a3', 600);
  item(almoco, 'a4', 500);
  item(lanche, 'a5', 500);
  item(jantar, 'a1', 400);
}

/** Inicia, responde, monta a dieta e submete o caso 1; `respostas` troca as etapas passadas. */
async function submeter(s: Servicos, respostas: Partial<Respostas> = {}): Promise<Resolucao> {
  const resolucao = s.resolucoes.iniciar(CASO_1)!;
  responder(s, resolucao, respostas);
  montarDieta(s, resolucao.id);
  expect(await s.resolucoes.submeter(resolucao.id)).toBeDefined();
  return resolucao;
}

describe('KpiService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('sem nenhuma resolução: sem casos, sem aproveitamento e os 5 tipos zerados', () => {
    const { kpis } = abrir();

    const resultado = kpis.calcular();

    expect(resultado.casosConcluidos).toEqual({ tentativas: 0, casosDistintos: 0 });
    expect(resultado.aproveitamento).toBeNull();
    expect(resultado.errosPorTipo.tipos.map((t) => t.tipo)).toEqual([...TIPOS_ERRO]);
    expect(resultado.errosPorTipo.total).toBe(0);
  });

  it('só em andamento: nada conta, mesmo com respostas salvas', () => {
    const s = abrir();
    responder(s, s.resolucoes.iniciar(CASO_1)!);

    const resultado = s.kpis.calcular();

    expect(resultado.casosConcluidos.tentativas).toBe(0);
    expect(resultado.aproveitamento).toBeNull();
  });

  it('uma submetida toda correta: 100% e nenhum erro', async () => {
    const s = abrir();
    await submeter(s);

    const resultado = s.kpis.calcular();

    expect(resultado.casosConcluidos).toEqual({ tentativas: 1, casosDistintos: 1 });
    expect(resultado.aproveitamento).toEqual({ corretas: 5, divergentes: 0, total: 5, percentual: 100 });
    expect(resultado.errosPorTipo.total).toBe(0);
  });

  it('bate com a contagem e o resumo de erros da tela de resultado', async () => {
    const s = abrir();
    // TMB 1500 (aritmética); CHO em mg (conversão); PTN 3 g/kg (fora da faixa); GET e LIP certos; dieta fora da meta do aluno.
    const resolucao = await submeter(s, {
      TMB: ['Mifflin-St Jeor', 1500],
      GET: [1.8, 2700],
      CHO: [6, 420000],
      PTN: [3, 210],
      LIP: [1, 70],
    });
    const resumo = s.resolucoes.resumoErros(resolucao.id)!;
    const contagem = s.resolucoes.contagemEtapas(resolucao.id)!;

    const resultado = s.kpis.calcular();

    expect(resultado.errosPorTipo.tipos).toEqual(TIPOS_ERRO.map((tipo) => ({ tipo, quantidade: resumo[tipo] })));
    expect(resultado.errosPorTipo.total).toBe(4);
    expect(resultado.aproveitamento).toEqual({ corretas: contagem.corretas, divergentes: contagem.divergentes, total: 5, percentual: 40 });
  });

  it('várias tentativas do mesmo caso: todas contam, o caso uma vez, e os erros se somam', async () => {
    const s = abrir();
    await submeter(s);
    await submeter(s, { CHO: [6, 420000] }); // 1 conversão de unidade
    await submeter(s, { CHO: [6, 420000] });
    s.resolucoes.iniciar(CASO_1); // em andamento: não entra

    const resultado = s.kpis.calcular();

    expect(resultado.casosConcluidos).toEqual({ tentativas: 3, casosDistintos: 1 });
    expect(resultado.errosPorTipo.tipos.find((t) => t.tipo === 'conversão de unidade')?.quantidade).toBe(2);
    expect(resultado.aproveitamento).toEqual({ corretas: 13, divergentes: 0, total: 15, percentual: 87 }); // 86,67 → 87
  });

  it('excluir uma submetida tira ela dos KPIs na próxima leitura', async () => {
    const s = abrir();
    const primeira = await submeter(s);
    await submeter(s, { CHO: [6, 420000] });
    expect(s.kpis.calcular().casosConcluidos.tentativas).toBe(2);

    s.resolucoes.excluir(primeira.id);

    const resultado = s.kpis.calcular();
    expect(resultado.casosConcluidos.tentativas).toBe(1);
    expect(resultado.aproveitamento?.total).toBe(5);
  });

  it('uma submetida cujo caso foi excluído depois continua contando: os KPIs não mudam', async () => {
    const s = abrir();
    await submeter(s, { CHO: [6, 420000] });
    const antes = s.kpis.calcular();
    expect(antes.casosConcluidos.tentativas).toBe(1);

    expect(s.casos.excluir(CASO_1)).toBe(true);

    expect(s.casos.buscarPorId(CASO_1)).toBeUndefined();
    expect(s.kpis.calcular()).toEqual(antes);
  });

  it('não grava nada no navegador ao calcular', async () => {
    const s = abrir();
    await submeter(s);
    const antes = JSON.stringify({ ...localStorage });

    s.kpis.calcular();

    expect(JSON.stringify({ ...localStorage })).toBe(antes);
  });
});
