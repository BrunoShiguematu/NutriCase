import { Alimento, Resolucao } from '../models';
import { AlimentoService, CarregadorTaco } from './alimento.service';
import { CasoService } from './caso.service';
import { KpiService } from './kpi.service';
import { TipoKpi } from '../kpis/kpis';
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

const TIPOS_CALCULO = TIPOS_ERRO.filter((t) => t !== 'dieta fora das metas');

/** Lê os KPIs num período largo, para o teste não depender da data de hoje. */
function ler({ kpis }: Servicos, tipo: TipoKpi = 'calculos') {
  kpis.filtro.set({ tipo, inicio: new Date(2000, 0, 1), fim: new Date(2100, 0, 1) });
  return kpis.kpis();
}

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

  it('sem nenhuma resolução: sem casos, sem aproveitamento e os 4 tipos de cálculo zerados', () => {
    const resultado = ler(abrir());

    expect(resultado.casosResolvidos).toEqual({ tentativas: 0, casosDistintos: 0 });
    expect(resultado.aproveitamento).toBeNull();
    expect(resultado.errosPorTipo.tipos.map((t) => t.tipo)).toEqual(TIPOS_CALCULO);
    expect(resultado.errosPorTipo.total).toBe(0);
  });

  it('só em andamento: nada conta, mesmo com respostas salvas', () => {
    const s = abrir();
    responder(s, s.resolucoes.iniciar(CASO_1)!);

    const resultado = ler(s);

    expect(resultado.casosResolvidos.tentativas).toBe(0);
    expect(resultado.aproveitamento).toBeNull();
  });

  it('uma submetida toda correta: 100% e nenhum erro', async () => {
    const s = abrir();
    await submeter(s);

    const resultado = ler(s);

    expect(resultado.casosResolvidos).toEqual({ tentativas: 1, casosDistintos: 1 });
    expect(resultado).toMatchObject({ aproveitamento: 100, corretas: 5, aceitaveis: 0, total: 5, errosDeFato: 0 });
    expect(ler(s, 'dieta')).toMatchObject({ aproveitamento: expect.any(Number), total: 1 });
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

    const resultado = ler(s);

    expect(resultado.errosPorTipo.tipos).toEqual(TIPOS_CALCULO.map((tipo) => ({ tipo, quantidade: resumo[tipo] })));
    expect(resultado.errosPorTipo.total).toBe(3);
    expect(resultado).toMatchObject({ aproveitamento: 40, corretas: contagem.corretas, aceitaveis: contagem.divergentes, total: 5, errosDeFato: 3 });
    // A dieta fora das metas do aluno aparece no tipo 'dieta', não nos cálculos.
    expect(resumo['dieta fora das metas']).toBe(1);
    expect(ler(s, 'dieta')).toMatchObject({ aproveitamento: 0, corretas: 0, total: 1, aceitaveis: null, errosDeFato: 1 });
  });

  it('várias tentativas do mesmo caso: todas contam, o caso uma vez, e os erros se somam', async () => {
    const s = abrir();
    await submeter(s);
    await submeter(s, { CHO: [6, 420000] }); // 1 conversão de unidade
    await submeter(s, { CHO: [6, 420000] });
    s.resolucoes.iniciar(CASO_1); // em andamento: não entra

    const resultado = ler(s);

    expect(resultado.casosResolvidos).toEqual({ tentativas: 3, casosDistintos: 1 });
    expect(resultado.errosPorTipo.tipos.find((t) => t.tipo === 'conversão de unidade')?.quantidade).toBe(2);
    expect(resultado).toMatchObject({ aproveitamento: 87, corretas: 13, aceitaveis: 0, total: 15 }); // 86,67 → 87
  });

  it('excluir uma submetida tira ela dos KPIs na próxima leitura', async () => {
    const s = abrir();
    const primeira = await submeter(s);
    await submeter(s, { CHO: [6, 420000] });
    expect(ler(s).casosResolvidos.tentativas).toBe(2);

    s.resolucoes.excluir(primeira.id);

    const resultado = ler(s);
    expect(resultado.casosResolvidos.tentativas).toBe(1);
    expect(resultado.total).toBe(5);
  });

  it('uma submetida cujo caso foi excluído depois continua contando: os KPIs não mudam', async () => {
    const s = abrir();
    await submeter(s, { CHO: [6, 420000] });
    const antes = ler(s);
    expect(antes.casosResolvidos.tentativas).toBe(1);

    expect(s.casos.excluir(CASO_1)).toBe(true);

    expect(s.casos.buscarPorId(CASO_1)).toBeUndefined();
    expect(ler(s)).toEqual(antes);
  });

  it('o filtro padrão é cálculos nos últimos 7 dias, e os KPIs recalculam sozinhos com uma nova submissão', async () => {
    const s = abrir();
    const { tipo, inicio, fim } = s.kpis.filtro();

    expect(tipo).toBe('calculos');
    expect(fim.getTime() - inicio.getTime()).toBeGreaterThan(6 * 24 * 3600 * 1000);
    expect(fim.getTime() - inicio.getTime()).toBeLessThan(7 * 24 * 3600 * 1000);
    expect(s.kpis.kpis().casosResolvidos.tentativas).toBe(0);

    await submeter(s); // agora: está dentro do padrão

    expect(s.kpis.kpis().casosResolvidos.tentativas).toBe(1);
  });

  it('um período que não pega a submissão mostra tudo vazio', async () => {
    const s = abrir();
    await submeter(s);

    s.kpis.filtro.set({ tipo: 'calculos', inicio: new Date(2000, 0, 1), fim: new Date(2000, 0, 2) });

    expect(s.kpis.kpis()).toMatchObject({ casosResolvidos: { tentativas: 0, casosDistintos: 0 }, aproveitamento: null, total: null });
  });

  it('ofensiva, nível, conquistas e série vêm do serviço e ignoram o tipo do filtro (menos a série)', async () => {
    const s = abrir();
    expect(s.kpis.ofensiva()).toBe(0);
    expect(s.kpis.nivel()).toMatchObject({ nome: 'Bronze', casos: 0, faltam: 3 });
    expect(s.kpis.conquistas().filter((c) => c.obtida)).toEqual([]);

    await submeter(s); // agora, toda correta

    expect(s.kpis.ofensiva()).toBe(1);
    expect(s.kpis.nivel()).toMatchObject({ nome: 'Bronze', casos: 1, faltam: 2 });
    expect(s.kpis.conquistas().filter((c) => c.obtida).map((c) => c.id)).toEqual(['primeiro-caso', 'cem-por-cento']);
    expect(s.kpis.serie()).toHaveLength(7); // padrão: 7 dias, 1 ponto por dia
    expect(s.kpis.serie().at(-1)).toMatchObject({ percentual: 100, casos: 1 }); // hoje
    s.kpis.filtro.set({ tipo: 'dieta', inicio: new Date(2000, 0, 1), fim: new Date(2000, 0, 1, 23) });
    expect(s.kpis.ofensiva()).toBe(1); // o filtro não mexe nela
    expect(s.kpis.serie()).toEqual([{ rotulo: '01/01', percentual: null, casos: 0 }]);
  });

  it('atualizarHoje põe o dia de agora, usa na ofensiva e volta ao filtro padrão', async () => {
    const s = abrir();
    await submeter(s); // submetida agora
    s.kpis.hoje.set(new Date(2000, 0, 1)); // o app "ficou aberto" e o relógio do serviço ficou para trás
    s.kpis.filtro.set({ tipo: 'dieta', inicio: new Date(2000, 0, 1), fim: new Date(2000, 0, 1, 23) });
    expect(s.kpis.ofensiva()).toBe(0); // hoje (2000) e ontem não têm submissão

    s.kpis.atualizarHoje();

    expect(s.kpis.ofensiva()).toBe(1);
    expect(s.kpis.filtro().tipo).toBe('calculos');
    expect(s.kpis.kpis().casosResolvidos.tentativas).toBe(1); // o padrão (7 dias até o fim de hoje) pega a submissão
  });

  it('não grava nada no navegador ao calcular', async () => {
    const s = abrir();
    await submeter(s);
    const antes = JSON.stringify({ ...localStorage });

    ler(s);

    expect(JSON.stringify({ ...localStorage })).toBe(antes);
  });
});
