import tacoJson from '../data/taco.json';
import { CASOS_EXEMPLO, etapasPadrao } from '../data/casos-exemplo';
import { calcularKpis, conquistas, maiorOfensiva, ofensiva, ultimosDias } from '../kpis/kpis';
import { AlimentoService, CarregadorTaco } from './alimento.service';
import { CasoService } from './caso.service';
import { KpiService } from './kpi.service';
import { montarResolucoesDemo } from './resolucoes-demo';
import { ResolucaoService } from './resolucao.service';
import { StorageService } from './storage.service';

// Quinta, 19/11/2026, 10:00 no horário local: de manhã, antes das 14:40 em que a tentativa de "hoje" foi feita.
const MANHA = new Date(2026, 10, 19, 10, 0, 0, 0);
const TARDE = new Date(2026, 10, 19, 20, 0, 0, 0);
const dia = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

describe('montarResolucoesDemo', () => {
  it('são 5 tentativas submetidas, em 5 casos de exemplo, hoje, ontem, anteontem, 5 e 12 dias atrás (pelo dia local)', () => {
    const { resolucoes } = montarResolucoesDemo(1, TARDE);

    expect(resolucoes.map((r) => r.status)).toEqual(Array(5).fill('submetida'));
    expect(resolucoes.map((r) => r.casoId)).toEqual(['exemplo-caso-1', 'exemplo-caso-2', 'exemplo-caso-3', 'exemplo-caso-4', 'exemplo-caso-5']);
    expect(resolucoes.map((r) => dia(r.submetidaEm!))).toEqual(['2026-11-19', '2026-11-18', '2026-11-17', '2026-11-14', '2026-11-7']);
  });

  it('mantém a hora da tentativa (14:40 local) e nada nasce no futuro: de manhã, a de hoje fica em "agora"', () => {
    const [hoje, ontem] = montarResolucoesDemo(1, TARDE).resolucoes;
    const [hojeManha, ontemManha] = montarResolucoesDemo(1, MANHA).resolucoes;

    expect(new Date(hoje.data).getHours()).toBe(14);
    expect(new Date(hoje.data).getMinutes()).toBe(40);
    expect(new Date(ontem.data).getHours()).toBe(14);
    expect(new Date(hojeManha.submetidaEm!).getTime()).toBe(MANHA.getTime());
    expect(new Date(hojeManha.data).getTime()).toBeLessThan(new Date(hojeManha.submetidaEm!).getTime());
    expect(new Date(ontemManha.data).getHours()).toBe(14); // os outros dias não mudam
  });

  it('os ids batem: respostas, refeições, itens e submissões apontam para o que existe nos exemplos e na TACO', () => {
    const d = montarResolucoesDemo(1, TARDE);
    const resolucaoIds = new Set(d.resolucoes.map((r) => r.id));
    const refeicaoIds = new Set(d.refeicoes.map((r) => r.id));
    const tacoIds = new Set((tacoJson as { id: string }[]).map((a) => a.id));
    const casosExemplo = new Set(CASOS_EXEMPLO.map((c) => c.id));

    expect(d.resolucoes.every((r) => casosExemplo.has(r.casoId))).toBe(true);
    expect(d.respostas).toHaveLength(25); // 5 etapas x 5 tentativas
    expect(d.respostas.every((r) => resolucaoIds.has(r.resolucaoId))).toBe(true);
    for (const r of d.resolucoes) {
      const etapas = new Set(etapasPadrao(r.casoId).map((e) => e.id));
      expect(d.respostas.filter((x) => x.resolucaoId === r.id).map((x) => x.etapaId).sort(), r.id).toEqual([...etapas].sort());
    }
    expect(d.refeicoes.every((r) => resolucaoIds.has(r.resolucaoId))).toBe(true);
    expect(d.itens.every((i) => refeicaoIds.has(i.refeicaoId) && tacoIds.has(i.alimentoId))).toBe(true);
    expect(d.submissoes.map((s) => s.resolucaoId)).toEqual(d.resolucoes.map((r) => r.id));
    expect(d.submissoes.every((s) => s.etapas.length === 5 && s.avaliacoes.length === 5)).toBe(true);
    expect(new Set([...d.respostas.map((x) => x.id), ...d.itens.map((x) => x.id)]).size).toBe(d.respostas.length + d.itens.length);
  });

  it('ofensiva de 3 dias, 5 casos distintos e a conquista da ofensiva; os KPIs de 7 e 30 dias têm dados', () => {
    const d = montarResolucoesDemo(1, TARDE);
    const resumosErros = new Map(
      d.resolucoes.map((r) => {
        const sub = d.submissoes.find((s) => s.resolucaoId === r.id)!;
        return [r.id, { 'conversão de unidade': 0, 'escolha de equação': 0, aritmética: 0, 'meta fora de faixa': 0, 'dieta fora das metas': sub.dietaForaDasMetas ? 1 : 0 }] as const;
      }),
    );
    const entrada = { resolucoes: d.resolucoes, respostas: d.respostas, resumosErros };

    expect(ofensiva(TARDE, d.resolucoes)).toBe(3);
    expect(maiorOfensiva(d.resolucoes)).toBe(3);
    expect(conquistas(entrada).filter((c) => c.obtida).map((c) => c.id)).toEqual(['primeiro-caso', 'cinco-casos', 'ofensiva-3', 'cem-por-cento']);
    const sete = calcularKpis(entrada, { tipo: 'calculos', ...ultimosDias(7, TARDE) });
    const trinta = calcularKpis(entrada, { tipo: 'calculos', ...ultimosDias(30, TARDE) });
    expect(sete.casosResolvidos.tentativas).toBe(4); // as de 12 dias atrás ficam de fora
    expect(trinta.casosResolvidos.tentativas).toBe(5);
    expect(sete.total).toBe(20);
    expect(trinta.total).toBe(25);
    expect(calcularKpis(entrada, { tipo: 'dieta', ...ultimosDias(30, TARDE) })).toMatchObject({ total: 5, errosDeFato: 2 }); // 2 com a dieta fora das metas
  });
});

describe('ResolucaoService: semente na primeira abertura', () => {
  const abrir = () => {
    const storage = new StorageService();
    const casos = new CasoService(storage);
    const carregador: CarregadorTaco = async () => [];
    return { storage, resolucoes: new ResolucaoService(storage, casos, new AlimentoService(storage, carregador)) };
  };
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('sem nada salvo, lista as 5 tentativas e grava no navegador', () => {
    const { storage, resolucoes } = abrir();

    expect(resolucoes.listar()).toHaveLength(5);
    expect(resolucoes.listar().every((r) => r.status === 'submetida')).toBe(true);
    expect(storage.ler<{ resolucoes: unknown[] }>('nutricase.resolucoes')?.resolucoes).toHaveLength(5);
    expect(new KpiService(resolucoes).nivel()).toMatchObject({ casos: 5, nome: 'Prata' });
  });

  it('com algo salvo, não mexe: nem junta a semente a uma lista vazia que a pessoa deixou', () => {
    localStorage.setItem('nutricase.resolucoes', JSON.stringify({ versao: 1, resolucoes: [], respostas: [], refeicoes: [], itens: [], submissoes: [] }));

    const { resolucoes } = abrir();

    expect(resolucoes.listar()).toEqual([]);
  });

  it('uma tentativa da semente abre o resultado completo (avaliação gravada e metas do aluno)', async () => {
    const { resolucoes } = abrir();
    const [maisRecente] = resolucoes.listar();

    const resultado = await resolucoes.resultado(maisRecente.id);

    expect(resultado?.etapas).toHaveLength(5);
    expect(resultado?.resumoErros).toBeDefined();
  });
});
