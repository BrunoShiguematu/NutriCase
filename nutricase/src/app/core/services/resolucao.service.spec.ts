import { ATLETAS_EXEMPLO, CASOS_EXEMPLO } from '../data/casos-exemplo';
import { tmb } from '../avaliacao/formulas';
import { Alimento, Resolucao, TipoErro } from '../models';
import { AlimentoService, CarregadorTaco } from './alimento.service';
import { CasoService } from './caso.service';
import { ResolucaoService, TIPOS_ERRO } from './resolucao.service';
import { StorageService } from './storage.service';

const CHAVE = 'nutricase.resolucoes';
const CASO_ID = 'exemplo-caso-1'; // Carlos: homem, 28 anos, 70 kg, 177 cm, 14 % de gordura; GET de referência 1,8
const ATLETA = ATLETAS_EXEMPLO[0];

// Contas à mão do caso 1 (Mifflin-St Jeor): 10×70 + 6,25×177 − 5×28 + 5 = 700 + 1106,25 − 140 + 5 = 1671,25
//   GET = 1671,25 × 1,8 = 3008,25 | CHO 6 g/kg = 420 g | PTN 1,6 g/kg = 112 g | LIP 1 g/kg = 70 g
const CORRETAS = {
  TMB: ['Mifflin-St Jeor', 1671.25],
  GET: [1.8, 3008.25],
  CHO: [6, 420],
  PTN: [1.6, 112],
  LIP: [1, 70],
} as const;

type Tipo = keyof typeof CORRETAS;
type Respostas = Record<Tipo, readonly [string | number, number]>;

// Cinco alimentos iguais (por 100 g: 100 kcal, 14 g CHO, 3,7 g PTN, 2,3 g LIP); 3000 g deles dão
// 3000 kcal, 420 g CHO, 111 g PTN e 69 g LIP: dentro de 10 % das metas acima.
function alimento(id: string): Alimento {
  return { id, nome: `Alimento ${id}`, grupo: 'Teste', kcal: 100, carboidrato: 14, proteina: 3.7, gordura: 2.3, origem: 'TACO' };
}
const ALIMENTOS = ['a1', 'a2', 'a3', 'a4', 'a5'].map(alimento);

function carregadorOk() {
  return vi.fn<CarregadorTaco>(async () => ALIMENTOS.map((a) => ({ ...a })));
}

const carregadorQueFalha: CarregadorTaco = async () => {
  throw new Error('sem TACO');
};

/** Abre os serviços como o app faz; um conjunto novo só enxerga o que está no localStorage. */
function abrir(carregarTaco: CarregadorTaco = carregadorOk()) {
  const storage = new StorageService();
  const casos = new CasoService(storage);
  const alimentos = new AlimentoService(storage, carregarTaco);
  const service = new ResolucaoService(storage, casos, alimentos);
  return { storage, casos, alimentos, service };
}

type Servicos = ReturnType<typeof abrir>;

function lerSalvos(): Record<string, unknown[]> | null {
  const texto = localStorage.getItem(CHAVE);
  return texto === null ? null : (JSON.parse(texto) as Record<string, unknown[]>);
}

/** Responde as 5 etapas do caso 1; `respostas` troca as que forem passadas. */
function responder({ service, casos }: Servicos, resolucaoId: string, respostas: Partial<Respostas> = {}): void {
  for (const etapa of casos.listarEtapas(CASO_ID)) {
    const [parametro, valor] = respostas[etapa.tipo] ?? CORRETAS[etapa.tipo];
    expect(service.salvarResposta(resolucaoId, etapa.id, parametro, valor), etapa.tipo).toBeDefined();
  }
}

/** Dieta de 4 refeições, pré e pós-treino, 5 alimentos, 3000 g; nenhuma refeição passa de 40 % das kcal. */
function montarDietaBoa({ service }: Servicos, resolucaoId: string): void {
  const refeicao = (nome: string, horario: string, marcador: 'pré-treino' | 'pós-treino' | 'nenhum') =>
    service.criarRefeicao(resolucaoId, { nome, horario, marcador })!;
  const cafe = refeicao('Café', '06:30', 'pré-treino');
  const almoco = refeicao('Almoço', '12:00', 'nenhum');
  const lanche = refeicao('Lanche', '16:00', 'pós-treino');
  const jantar = refeicao('Jantar', '19:30', 'nenhum');
  const item = (r: { id: string }, alimentoId: string, quantidadeGramas: number) =>
    expect(service.criarItem(r.id, { alimentoId, quantidadeGramas })).toBeDefined();
  item(cafe, 'a1', 500);
  item(cafe, 'a2', 500);
  item(almoco, 'a3', 600);
  item(almoco, 'a4', 500);
  item(lanche, 'a5', 500);
  item(jantar, 'a1', 400);
}

/** Uma refeição com 100 g: dieta que fica longe das metas. */
function montarDietaRuim({ service }: Servicos, resolucaoId: string): void {
  const unica = service.criarRefeicao(resolucaoId, { nome: 'Único', horario: '12:00', marcador: 'nenhum' })!;
  service.criarItem(unica.id, { alimentoId: 'a1', quantidadeGramas: 100 });
}

function tentativaCompleta(s: Servicos, respostas: Partial<Respostas> = {}, dieta: 'boa' | 'ruim' = 'boa'): Resolucao {
  const resolucao = s.service.iniciar(CASO_ID)!;
  responder(s, resolucao.id, respostas);
  (dieta === 'boa' ? montarDietaBoa : montarDietaRuim)(s, resolucao.id);
  return resolucao;
}

describe('ResolucaoService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('iniciar, buscar e listar', () => {
    it('cria uma tentativa "em andamento", com data ISO e justificativa vazia, e guarda no navegador', () => {
      const { service } = abrir();

      const resolucao = service.iniciar(CASO_ID)!;

      expect(resolucao.casoId).toBe(CASO_ID);
      expect(resolucao.status).toBe('em andamento');
      expect(resolucao.justificativa).toBe('');
      expect(resolucao.submetidaEm).toBeUndefined();
      expect(new Date(resolucao.data).toISOString()).toBe(resolucao.data);
      expect(lerSalvos()?.['resolucoes']).toEqual([resolucao]);
    });

    it('caso que não existe: devolve undefined e não guarda nada', () => {
      const { service } = abrir();

      expect(service.iniciar('inexistente')).toBeUndefined();
      expect(service.listar()).toEqual([]);
      expect(localStorage.getItem(CHAVE)).toBeNull();
    });

    it('cada tentativa tem id próprio, e buscar devolve uma cópia', () => {
      const { service } = abrir();
      const a = service.iniciar(CASO_ID)!;
      const b = service.iniciar(CASO_ID)!;

      expect(a.id).not.toBe(b.id);
      const achada = service.buscar(a.id)!;
      achada.justificativa = 'mudei por fora';
      achada.status = 'submetida';
      expect(service.buscar(a.id)?.justificativa).toBe('');
      expect(service.buscar(a.id)?.status).toBe('em andamento');
      expect(service.buscar('inexistente')).toBeUndefined();
    });

    it('listar traz a mais recente primeiro, inclusive quando duas nascem no mesmo instante', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      const { service } = abrir();
      vi.setSystemTime(new Date('2026-11-12T10:00:00.000Z'));
      const primeira = service.iniciar(CASO_ID)!;
      vi.setSystemTime(new Date('2026-11-12T11:00:00.000Z'));
      const segunda = service.iniciar('exemplo-caso-2')!;
      const empatada = service.iniciar(CASO_ID)!; // mesmo instante da segunda

      expect(service.listar().map((r) => r.id)).toEqual([empatada.id, segunda.id, primeira.id]);
    });

    it('listar entrega cópias novas, e o signal `resolucoes` acompanha as mudanças', () => {
      const { service } = abrir();
      expect(service.resolucoes()).toEqual([]);

      const resolucao = service.iniciar(CASO_ID)!;
      service.listar()[0].justificativa = 'mudei por fora';

      expect(service.resolucoes().map((r) => r.id)).toEqual([resolucao.id]);
      expect(service.listar()[0].justificativa).toBe('');
    });
  });

  describe('salvarResposta', () => {
    it('guarda a resposta da etapa, sem classificação (nada de certo ou errado antes da submissão, RF09)', () => {
      const s = abrir();
      const resolucao = s.service.iniciar(CASO_ID)!;
      const [tmbEtapa] = s.casos.listarEtapas(CASO_ID);

      const resposta = s.service.salvarResposta(resolucao.id, tmbEtapa.id, 'Mifflin-St Jeor', 1671.25)!;

      expect(resposta).toMatchObject({ resolucaoId: resolucao.id, etapaId: tmbEtapa.id, parametro: 'Mifflin-St Jeor', valor: 1671.25 });
      expect(resposta.classificacao).toBeUndefined();
      expect(resposta.tipoErro).toBeUndefined();
      expect(s.service.listarRespostas(resolucao.id)).toEqual([resposta]);
    });

    it('substitui a resposta anterior da mesma etapa, sem duplicar', () => {
      const s = abrir();
      const resolucao = s.service.iniciar(CASO_ID)!;
      const [, getEtapa] = s.casos.listarEtapas(CASO_ID);
      const primeira = s.service.salvarResposta(resolucao.id, getEtapa.id, 1.5, 2500)!;

      const segunda = s.service.salvarResposta(resolucao.id, getEtapa.id, 1.8, 3008.25)!;

      expect(segunda.id).toBe(primeira.id);
      const guardadas = s.service.listarRespostas(resolucao.id);
      expect(guardadas.length).toBe(1);
      expect(guardadas[0]).toMatchObject({ parametro: 1.8, valor: 3008.25 });
    });

    it('listarRespostas vem na ordem das etapas do caso e só da tentativa pedida', () => {
      const s = abrir();
      const a = s.service.iniciar(CASO_ID)!;
      const b = s.service.iniciar(CASO_ID)!;
      const etapas = s.casos.listarEtapas(CASO_ID);
      // respondidas de trás para frente
      for (const etapa of [...etapas].reverse()) {
        const [parametro, valor] = CORRETAS[etapa.tipo];
        s.service.salvarResposta(a.id, etapa.id, parametro, valor);
      }
      s.service.salvarResposta(b.id, etapas[0].id, 'Mifflin-St Jeor', 1500);

      expect(s.service.listarRespostas(a.id).map((r) => r.etapaId)).toEqual(etapas.map((e) => e.id));
      expect(s.service.listarRespostas(b.id).length).toBe(1);
    });

    it('recusa, sem guardar nada: tentativa inexistente, etapa de outro caso e etapa inexistente', () => {
      const s = abrir();
      const resolucao = s.service.iniciar(CASO_ID)!;
      const [tmbEtapa] = s.casos.listarEtapas(CASO_ID);
      const [outraEtapa] = s.casos.listarEtapas('exemplo-caso-2');

      expect(s.service.salvarResposta('inexistente', tmbEtapa.id, 'Mifflin-St Jeor', 1500)).toBeUndefined();
      expect(s.service.salvarResposta(resolucao.id, outraEtapa.id, 'Mifflin-St Jeor', 1500)).toBeUndefined();
      expect(s.service.salvarResposta(resolucao.id, 'etapa-inexistente', 'Mifflin-St Jeor', 1500)).toBeUndefined();
      expect(s.service.listarRespostas(resolucao.id)).toEqual([]);
    });

    it('recusa parâmetro ou valor inválidos (NaN, infinito, texto vazio), sem apagar a resposta anterior', () => {
      const s = abrir();
      const resolucao = s.service.iniciar(CASO_ID)!;
      const [, getEtapa] = s.casos.listarEtapas(CASO_ID);
      s.service.salvarResposta(resolucao.id, getEtapa.id, 1.8, 3008.25);

      expect(s.service.salvarResposta(resolucao.id, getEtapa.id, 1.8, NaN)).toBeUndefined();
      expect(s.service.salvarResposta(resolucao.id, getEtapa.id, 1.8, Infinity)).toBeUndefined();
      expect(s.service.salvarResposta(resolucao.id, getEtapa.id, NaN, 3000)).toBeUndefined();
      expect(s.service.salvarResposta(resolucao.id, getEtapa.id, '   ', 3000)).toBeUndefined();
      expect(s.service.listarRespostas(resolucao.id)).toEqual([expect.objectContaining({ parametro: 1.8, valor: 3008.25 })]);
    });

    it('apara o texto do parâmetro', () => {
      const s = abrir();
      const resolucao = s.service.iniciar(CASO_ID)!;
      const [tmbEtapa] = s.casos.listarEtapas(CASO_ID);

      expect(s.service.salvarResposta(resolucao.id, tmbEtapa.id, '  Mifflin-St Jeor ', 1500)?.parametro).toBe('Mifflin-St Jeor');
    });
  });

  describe('refeições e itens', () => {
    const refeicaoOk = { nome: 'Café da manhã', horario: '06:30', marcador: 'pré-treino' } as const;

    it('criar refeição: guarda, apara o nome e mantém a ordem de criação', () => {
      const s = abrir();
      const resolucao = s.service.iniciar(CASO_ID)!;

      const a = s.service.criarRefeicao(resolucao.id, { ...refeicaoOk, nome: '  Café da manhã  ' })!;
      const b = s.service.criarRefeicao(resolucao.id, { nome: 'Almoço', horario: '12:00', marcador: 'nenhum' })!;

      expect(a).toMatchObject({ resolucaoId: resolucao.id, nome: 'Café da manhã', horario: '06:30', marcador: 'pré-treino' });
      expect(s.service.listarRefeicoes(resolucao.id).map((r) => r.id)).toEqual([a.id, b.id]);
    });

    it('recusa refeição inválida (nome vazio, horário fora de HH:mm, marcador desconhecido) e tentativa inexistente', () => {
      const s = abrir();
      const resolucao = s.service.iniciar(CASO_ID)!;

      expect(s.service.criarRefeicao(resolucao.id, { ...refeicaoOk, nome: '   ' })).toBeUndefined();
      for (const horario of ['8:00', '25:00', '12:60', '12h00', '']) {
        expect(s.service.criarRefeicao(resolucao.id, { ...refeicaoOk, horario }), horario).toBeUndefined();
      }
      expect(s.service.criarRefeicao(resolucao.id, { ...refeicaoOk, marcador: 'depois' as 'nenhum' })).toBeUndefined();
      expect(s.service.criarRefeicao('inexistente', refeicaoOk)).toBeUndefined();
      expect(s.service.listarRefeicoes(resolucao.id)).toEqual([]);
    });

    it('atualizar refeição troca nome, horário e marcador, e recusa dado inválido sem mexer', () => {
      const s = abrir();
      const resolucao = s.service.iniciar(CASO_ID)!;
      const refeicao = s.service.criarRefeicao(resolucao.id, refeicaoOk)!;

      const nova = s.service.atualizarRefeicao(refeicao.id, { nome: 'Lanche', horario: '16:00', marcador: 'pós-treino' })!;

      expect(nova).toMatchObject({ id: refeicao.id, nome: 'Lanche', horario: '16:00', marcador: 'pós-treino' });
      expect(s.service.atualizarRefeicao(refeicao.id, { nome: '', horario: '16:00', marcador: 'nenhum' })).toBeUndefined();
      expect(s.service.atualizarRefeicao('inexistente', refeicaoOk)).toBeUndefined();
      expect(s.service.listarRefeicoes(resolucao.id)).toEqual([nova]);
    });

    it('criar item: guarda alimento e gramas; recusa quantidade que não é maior que zero e alimento vazio', () => {
      const s = abrir();
      const resolucao = s.service.iniciar(CASO_ID)!;
      const refeicao = s.service.criarRefeicao(resolucao.id, refeicaoOk)!;

      const item = s.service.criarItem(refeicao.id, { alimentoId: 'a1', quantidadeGramas: 150 })!;

      expect(item).toMatchObject({ refeicaoId: refeicao.id, alimentoId: 'a1', quantidadeGramas: 150 });
      for (const quantidadeGramas of [0, -10, NaN, Infinity]) {
        expect(s.service.criarItem(refeicao.id, { alimentoId: 'a1', quantidadeGramas }), String(quantidadeGramas)).toBeUndefined();
      }
      expect(s.service.criarItem(refeicao.id, { alimentoId: '  ', quantidadeGramas: 100 })).toBeUndefined();
      expect(s.service.criarItem('inexistente', { alimentoId: 'a1', quantidadeGramas: 100 })).toBeUndefined();
      expect(s.service.listarItens(refeicao.id)).toEqual([item]);
    });

    it('atualizar item muda só o que vier, e valida o que vier', () => {
      const s = abrir();
      const resolucao = s.service.iniciar(CASO_ID)!;
      const refeicao = s.service.criarRefeicao(resolucao.id, refeicaoOk)!;
      const item = s.service.criarItem(refeicao.id, { alimentoId: 'a1', quantidadeGramas: 150 })!;

      expect(s.service.atualizarItem(item.id, { quantidadeGramas: 200 })).toMatchObject({ alimentoId: 'a1', quantidadeGramas: 200 });
      expect(s.service.atualizarItem(item.id, { alimentoId: 'a2' })).toMatchObject({ alimentoId: 'a2', quantidadeGramas: 200 });
      expect(s.service.atualizarItem(item.id, { quantidadeGramas: 0 })).toBeUndefined();
      expect(s.service.atualizarItem(item.id, { alimentoId: '' })).toBeUndefined();
      expect(s.service.atualizarItem('inexistente', { quantidadeGramas: 10 })).toBeUndefined();
      expect(s.service.listarItens(refeicao.id)).toEqual([{ ...item, alimentoId: 'a2', quantidadeGramas: 200 }]);
    });

    it('excluir item tira só ele; excluir refeição leva os itens dela e só os dela', () => {
      const s = abrir();
      const resolucao = s.service.iniciar(CASO_ID)!;
      const r1 = s.service.criarRefeicao(resolucao.id, refeicaoOk)!;
      const r2 = s.service.criarRefeicao(resolucao.id, { nome: 'Almoço', horario: '12:00', marcador: 'nenhum' })!;
      const i1 = s.service.criarItem(r1.id, { alimentoId: 'a1', quantidadeGramas: 100 })!;
      s.service.criarItem(r1.id, { alimentoId: 'a2', quantidadeGramas: 100 });
      s.service.criarItem(r2.id, { alimentoId: 'a3', quantidadeGramas: 100 });

      expect(s.service.excluirItem(i1.id)).toBe(true);
      expect(s.service.excluirItem(i1.id)).toBe(false);
      expect(s.service.listarItens(r1.id).length).toBe(1);

      expect(s.service.excluirRefeicao(r1.id)).toBe(true);
      expect(s.service.excluirRefeicao(r1.id)).toBe(false);
      expect(s.service.listarRefeicoes(resolucao.id).map((r) => r.id)).toEqual([r2.id]);
      expect(s.service.listarItens(r1.id)).toEqual([]);
      expect(s.service.listarItensDaResolucao(resolucao.id).length).toBe(1);
      expect((lerSalvos()?.['itens'] ?? []).length).toBe(1);
    });

    it('listarItensDaResolucao junta os itens de todas as refeições e só da tentativa pedida', () => {
      const s = abrir();
      const a = s.service.iniciar(CASO_ID)!;
      const b = s.service.iniciar(CASO_ID)!;
      for (const [resolucao, quantos] of [[a, 2], [b, 1]] as const) {
        const refeicao = s.service.criarRefeicao(resolucao.id, refeicaoOk)!;
        for (let i = 0; i < quantos; i++) {
          s.service.criarItem(refeicao.id, { alimentoId: 'a1', quantidadeGramas: 100 + i });
        }
      }

      expect(s.service.listarItensDaResolucao(a.id).length).toBe(2);
      expect(s.service.listarItensDaResolucao(b.id).length).toBe(1);
    });

    it('devolve cópias: mudar o que veio não altera o estado', () => {
      const s = abrir();
      const resolucao = s.service.iniciar(CASO_ID)!;
      const refeicao = s.service.criarRefeicao(resolucao.id, refeicaoOk)!;
      const item = s.service.criarItem(refeicao.id, { alimentoId: 'a1', quantidadeGramas: 100 })!;

      s.service.listarRefeicoes(resolucao.id)[0].nome = 'mudei';
      s.service.listarItens(refeicao.id)[0].quantidadeGramas = 9999;
      refeicao.nome = 'mudei também';
      item.quantidadeGramas = 1;

      expect(s.service.listarRefeicoes(resolucao.id)[0].nome).toBe('Café da manhã');
      expect(s.service.listarItens(refeicao.id)[0].quantidadeGramas).toBe(100);
    });
  });

  describe('justificativa', () => {
    it('guarda o texto como veio e devolve a tentativa atualizada; não é avaliada (RN10)', () => {
      const s = abrir();
      const resolucao = s.service.iniciar(CASO_ID)!;

      const atualizada = s.service.salvarJustificativa(resolucao.id, '  Escolhi Mifflin porque...  ')!;

      expect(atualizada.justificativa).toBe('  Escolhi Mifflin porque...  ');
      expect(s.service.buscar(resolucao.id)?.justificativa).toBe('  Escolhi Mifflin porque...  ');
      expect(s.service.salvarJustificativa('inexistente', 'x')).toBeUndefined();
      expect(s.service.salvarJustificativa(resolucao.id, 42 as unknown as string)).toBeUndefined();
    });
  });

  describe('pendências', () => {
    it('tentativa vazia: as 5 etapas, na ordem, e a dieta sem itens', () => {
      const s = abrir();
      const resolucao = s.service.iniciar(CASO_ID)!;
      const etapas = s.casos.listarEtapas(CASO_ID);

      const pendencias = s.service.pendencias(resolucao.id)!;

      expect(pendencias.map((p) => p.tipo)).toEqual(['etapa', 'etapa', 'etapa', 'etapa', 'etapa', 'dieta']);
      expect(pendencias.slice(0, 5).map((p) => p.etapaId)).toEqual(etapas.map((e) => e.id));
      expect(pendencias[0].texto).toBe('Etapa 1 (TMB) sem resposta.');
      expect(pendencias[5].texto).toBe('A dieta não tem nenhum item.');
    });

    it('cada resposta e a dieta tiram a pendência correspondente; sem nenhuma, vazio', () => {
      const s = abrir();
      const resolucao = s.service.iniciar(CASO_ID)!;
      const [tmbEtapa, getEtapa] = s.casos.listarEtapas(CASO_ID);

      s.service.salvarResposta(resolucao.id, tmbEtapa.id, 'Mifflin-St Jeor', 1671.25);
      s.service.salvarResposta(resolucao.id, getEtapa.id, 1.8, 3008.25);
      expect(s.service.pendencias(resolucao.id)?.map((p) => p.texto)).toEqual([
        'Etapa 3 (CHO) sem resposta.',
        'Etapa 4 (PTN) sem resposta.',
        'Etapa 5 (LIP) sem resposta.',
        'A dieta não tem nenhum item.',
      ]);

      responder(s, resolucao.id);
      expect(s.service.pendencias(resolucao.id)?.map((p) => p.tipo)).toEqual(['dieta']);

      montarDietaBoa(s, resolucao.id);
      expect(s.service.pendencias(resolucao.id)).toEqual([]);
    });

    it('refeição sem itens não conta como dieta: a pendência continua até haver um item', () => {
      const s = abrir();
      const resolucao = s.service.iniciar(CASO_ID)!;
      responder(s, resolucao.id);
      const refeicao = s.service.criarRefeicao(resolucao.id, { nome: 'Café', horario: '07:00', marcador: 'nenhum' })!;

      expect(s.service.pendencias(resolucao.id)?.map((p) => p.tipo)).toEqual(['dieta']);

      s.service.criarItem(refeicao.id, { alimentoId: 'a1', quantidadeGramas: 100 });
      expect(s.service.pendencias(resolucao.id)).toEqual([]);
    });

    it('resposta que ficou inválida no dado salvo não vale como resposta', () => {
      const s = abrir();
      const resolucao = s.service.iniciar(CASO_ID)!;
      responder(s, resolucao.id);
      montarDietaBoa(s, resolucao.id);
      const salvos = lerSalvos()!;
      (salvos['respostas'][2] as { valor: unknown }).valor = null; // JSON de NaN: volta como null
      localStorage.setItem(CHAVE, JSON.stringify(salvos));

      const reaberto = abrir();

      expect(reaberto.service.pendencias(resolucao.id)?.map((p) => p.texto)).toEqual(['Etapa 3 (CHO) sem resposta.']);
    });

    it('tentativa inexistente: undefined', () => {
      expect(abrir().service.pendencias('inexistente')).toBeUndefined();
    });
  });

  describe('submeter', () => {
    it('com pendência não submete: devolve undefined e não muda nada', async () => {
      const s = abrir();
      const resolucao = s.service.iniciar(CASO_ID)!;
      responder(s, resolucao.id); // falta a dieta
      const antes = localStorage.getItem(CHAVE);

      expect(await s.service.submeter(resolucao.id)).toBeUndefined();

      expect(s.service.buscar(resolucao.id)?.status).toBe('em andamento');
      expect(localStorage.getItem(CHAVE)).toBe(antes);
      expect(s.service.listarRespostas(resolucao.id).every((r) => r.classificacao === undefined)).toBe(true);
    });

    it('tentativa inexistente: undefined', async () => {
      expect(await abrir().service.submeter('inexistente')).toBeUndefined();
    });

    it('tentativa já submetida: a segunda vez devolve undefined e não muda nada', async () => {
      const s = abrir();
      const resolucao = tentativaCompleta(s);
      expect(await s.service.submeter(resolucao.id)).toBeDefined();
      const antes = localStorage.getItem(CHAVE);

      expect(await s.service.submeter(resolucao.id)).toBeUndefined();

      expect(localStorage.getItem(CHAVE)).toBe(antes);
    });

    it('caso que sumiu depois de a tentativa ficar completa: não submete e não muda nada', async () => {
      const s = abrir();
      const resolucao = tentativaCompleta(s);
      s.casos.excluir(CASO_ID);
      const antes = localStorage.getItem(CHAVE);

      expect(await s.service.submeter(resolucao.id)).toBeUndefined();

      expect(s.service.buscar(resolucao.id)?.status).toBe('em andamento');
      expect(localStorage.getItem(CHAVE)).toBe(antes);
    });

    it('sem pendência: corrige, grava a classificação nas respostas e deixa "submetida", com submetidaEm', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-11-12T10:00:00.000Z'));
      const s = abrir();
      const resolucao = tentativaCompleta(s);
      vi.setSystemTime(new Date('2026-11-12T10:30:00.000Z'));

      const submetida = (await s.service.submeter(resolucao.id))!;

      expect(submetida.status).toBe('submetida');
      expect(submetida.submetidaEm).toBe('2026-11-12T10:30:00.000Z');
      expect(submetida.data).toBe('2026-11-12T10:00:00.000Z');
      expect(s.service.buscar(resolucao.id)).toEqual(submetida);
      const respostas = s.service.listarRespostas(resolucao.id);
      expect(respostas.map((r) => r.classificacao)).toEqual(['correta', 'correta', 'correta', 'correta', 'correta']);
      expect(respostas.every((r) => r.tipoErro === undefined)).toBe(true);
    });

    it('espera a base de alimentos carregar (uma vez) antes de avaliar a dieta', async () => {
      const carregarTaco = carregadorOk();
      const s = abrir(carregarTaco);
      const resolucao = tentativaCompleta(s);
      expect(s.alimentos.estado()).toBe('nao-carregado');

      const submetida = await s.service.submeter(resolucao.id);

      expect(submetida?.status).toBe('submetida');
      expect(s.alimentos.estado()).toBe('pronto');
      expect(carregarTaco).toHaveBeenCalledTimes(1);
    });

    it('se a base de alimentos não carrega, não submete e não muda nada', async () => {
      const s = abrir(carregadorQueFalha);
      const resolucao = tentativaCompleta(s);
      const antes = localStorage.getItem(CHAVE);

      expect(await s.service.submeter(resolucao.id)).toBeUndefined();

      expect(s.alimentos.estado()).toBe('erro');
      expect(s.service.buscar(resolucao.id)?.status).toBe('em andamento');
      expect(localStorage.getItem(CHAVE)).toBe(antes);
    });

    it('classifica o erro de cada tipo e conta o resumo (RF34), com a dieta fora das metas do ALUNO', async () => {
      const s = abrir();
      // TMB 1500 (aritmética); GET 1500 × 1,8 = 2700 (coerente com a TMB dele: correta); CHO em mg (conversão);
      // PTN 3 g/kg (fora da faixa 1,2–2,2); LIP certa. Metas dele: 2700 kcal, 420000 g, 210 g, 70 g.
      const resolucao = tentativaCompleta(s, {
        TMB: ['Mifflin-St Jeor', 1500],
        GET: [1.8, 2700],
        CHO: [6, 420000],
        PTN: [3, 210],
        LIP: [1, 70],
      });

      await s.service.submeter(resolucao.id);

      const respostas = s.service.listarRespostas(resolucao.id);
      expect(respostas.map((r) => [r.classificacao, r.tipoErro])).toEqual([
        ['erro de fato', 'aritmética'],
        ['correta', undefined],
        ['erro de fato', 'conversão de unidade'],
        ['erro de fato', 'meta fora de faixa'],
        ['correta', undefined],
      ]);
      expect(s.service.contagemEtapas(resolucao.id)).toEqual({ corretas: 2, divergentes: 0, comErro: 3 });
      expect(s.service.resumoErros(resolucao.id)).toEqual({
        'conversão de unidade': 1,
        'escolha de equação': 0,
        aritmética: 1,
        'meta fora de faixa': 1,
        'dieta fora das metas': 1, // 3000 kcal contra a meta de 2700 do aluno: +11 %
      });
    });

    it('divergente conta como divergente, não como erro', async () => {
      const s = abrir();
      const harris = tmb('Harris-Benedict revisada', ATLETA);
      const resolucao = tentativaCompleta(s, { TMB: ['Harris-Benedict revisada', harris], GET: [1.8, harris * 1.8] });

      await s.service.submeter(resolucao.id);

      expect(s.service.listarRespostas(resolucao.id)[0].classificacao).toBe('divergente');
      expect(s.service.contagemEtapas(resolucao.id)).toEqual({ corretas: 4, divergentes: 1, comErro: 0 });
      expect(Object.values(s.service.resumoErros(resolucao.id)!).reduce((a, b) => a + b, 0)).toBe(0);
    });

    it('as metas da dieta saem das respostas do aluno, não da referência', async () => {
      const s = abrir();
      // O aluno errou a TMB e chegou a 2700 kcal / 420 / 112 / 70; a dieta boa (3000 kcal) fica fora de 2700 por mais de 10 %.
      const resolucao = tentativaCompleta(s, { TMB: ['Mifflin-St Jeor', 1500], GET: [1.8, 2700] });

      await s.service.submeter(resolucao.id);
      const resultado = (await s.service.resultado(resolucao.id))!;

      expect(resultado.metasDoAluno).toEqual({ kcal: 2700, cho: 420, ptn: 112, lip: 70 });
      expect(resultado.dieta?.comparativo[0]).toMatchObject({ nutriente: 'kcal', meta: 2700, situacao: 'fora' });
      expect(resultado.resumoErros['dieta fora das metas']).toBe(1);
    });
  });

  describe('resultado', () => {
    it('só para tentativa submetida: em andamento e inexistente dão undefined', async () => {
      const s = abrir();
      const resolucao = tentativaCompleta(s);

      expect(await s.service.resultado(resolucao.id)).toBeUndefined();
      expect(await s.service.resultado('inexistente')).toBeUndefined();
      expect(s.service.contagemEtapas(resolucao.id)).toBeUndefined();
      expect(s.service.resumoErros(resolucao.id)).toBeUndefined();
    });

    it('traz as etapas avaliadas na ordem, a dieta recalculada, o resumo e o comentário de referência', async () => {
      const s = abrir();
      const resolucao = tentativaCompleta(s);
      await s.service.submeter(resolucao.id);

      const resultado = (await s.service.resultado(resolucao.id))!;

      expect(resultado.resolucao.status).toBe('submetida');
      expect(resultado.etapas.map((e) => e.etapa.tipo)).toEqual(['TMB', 'GET', 'CHO', 'PTN', 'LIP']);
      expect(resultado.etapas.map((e) => e.avaliacao.classificacao)).toEqual(['correta', 'correta', 'correta', 'correta', 'correta']);
      expect(resultado.etapas.map((e) => e.resposta.classificacao)).toEqual(['correta', 'correta', 'correta', 'correta', 'correta']);
      expect(resultado.etapas[1].avaliacao.valorEsperado).toBeCloseTo(3008.25, 6);
      expect(resultado.etapas[0].etapa.criterioReferencia).toContain('Mifflin-St Jeor');
      expect(resultado.metasDoAluno).toEqual({ kcal: 3008.25, cho: 420, ptn: 112, lip: 70 });
      expect(resultado.dieta?.dietaForaDasMetas).toBe(false);
      expect(resultado.dieta?.comparativo.map((c) => c.situacao)).toEqual(['dentro', 'dentro', 'dentro', 'dentro']);
      expect(resultado.dieta?.totais.dia.kcal).toBeCloseTo(3000, 6);
      expect(resultado.dieta?.alertas).toEqual([]);
      expect(resultado.resumoErros).toEqual({ 'conversão de unidade': 0, 'escolha de equação': 0, aritmética: 0, 'meta fora de faixa': 0, 'dieta fora das metas': 0 });
      expect(Object.keys(resultado.resumoErros)).toEqual([...TIPOS_ERRO]);
      expect(resultado.comentarioReferencia).toBe(CASOS_EXEMPLO[0].comentarioReferencia);
    });

    it('os alertas da dieta aparecem no resultado (dieta fraca: refeições, variedade, pré e pós-treino)', async () => {
      const s = abrir();
      const resolucao = tentativaCompleta(s, {}, 'ruim');
      await s.service.submeter(resolucao.id);

      const resultado = (await s.service.resultado(resolucao.id))!;

      expect(resultado.dieta?.alertas.map((a) => a.tipo)).toEqual([
        'falta pré-treino',
        'falta pós-treino',
        'poucas refeições',
        'refeição concentra kcal',
        'pouca variedade',
      ]);
      expect(resultado.dieta?.dietaForaDasMetas).toBe(true);
      expect(resultado.resumoErros['dieta fora das metas']).toBe(1);
    });

    it('o resultado não muda se o docente editar as etapas do caso depois da submissão', async () => {
      const s = abrir();
      const resolucao = tentativaCompleta(s);
      await s.service.submeter(resolucao.id);
      const antes = (await s.service.resultado(resolucao.id))!;

      const editadas = s.casos.listarEtapas(CASO_ID).map((e) =>
        e.tipo === 'TMB' ? { ...e, parametroReferencia: 'Cunningham', opcoesAceitaveis: ['Cunningham'], criterioReferencia: 'Critério novo.' } : e,
      );
      s.casos.atualizarEtapas(CASO_ID, editadas);
      const depois = (await s.service.resultado(resolucao.id))!;

      expect(depois.etapas).toEqual(antes.etapas);
      expect(depois.etapas[0].etapa.criterioReferencia).toContain('Mifflin-St Jeor');
      expect(depois.etapas[0].avaliacao.classificacao).toBe('correta');
    });

    it('o resumo de erros usa o que foi gravado na submissão, mesmo se a tolerância do caso mudar depois', async () => {
      const s = abrir();
      const resolucao = tentativaCompleta(s, {}, 'ruim');
      await s.service.submeter(resolucao.id);
      const { caso, atleta } = s.casos.buscarPorId(CASO_ID)!;
      const { id: _id, atletaId: _atletaId, ...dadosCaso } = caso;
      const { id: _atletaIdPropria, ...dadosAtleta } = atleta;
      s.casos.atualizar(CASO_ID, { ...dadosCaso, toleranciaDieta: 100000 }, dadosAtleta);

      const resultado = (await s.service.resultado(resolucao.id))!;

      expect(resultado.dieta?.dietaForaDasMetas).toBe(false); // recalculada com a tolerância nova
      expect(resultado.resumoErros['dieta fora das metas']).toBe(1); // gravada na submissão
      expect(s.service.resumoErros(resolucao.id)?.['dieta fora das metas']).toBe(1);
    });

    it('espera a base de alimentos carregar antes de recalcular a dieta', async () => {
      const s = abrir();
      const resolucao = tentativaCompleta(s);
      await s.service.submeter(resolucao.id);
      localStorage.removeItem('nutricase.alimentos');
      const reaberto = abrir(); // base ainda não carregada neste conjunto
      expect(reaberto.alimentos.estado()).toBe('nao-carregado');

      const resultado = await reaberto.service.resultado(resolucao.id);

      expect(reaberto.alimentos.estado()).toBe('pronto');
      expect(resultado?.dieta?.totais.dia.kcal).toBeCloseTo(3000, 6);
    });

    it('se a base de alimentos não carrega, o resultado vem sem a dieta e o resto continua valendo', async () => {
      const s = abrir();
      const resolucao = tentativaCompleta(s);
      await s.service.submeter(resolucao.id);
      localStorage.removeItem('nutricase.alimentos');
      const semTaco = abrir(carregadorQueFalha);

      const resultado = (await semTaco.service.resultado(resolucao.id))!;

      expect(semTaco.alimentos.estado()).toBe('erro');
      expect(resultado.dieta).toBeUndefined();
      expect(resultado.etapas.length).toBe(5);
      expect(resultado.resumoErros['dieta fora das metas']).toBe(0);
      expect(resultado.comentarioReferencia).toBe(CASOS_EXEMPLO[0].comentarioReferencia);
    });

    it('se o caso foi excluído depois da submissão, o resultado não existe mais, mas as contagens guardadas sim', async () => {
      const s = abrir();
      const resolucao = tentativaCompleta(s);
      await s.service.submeter(resolucao.id);

      s.casos.excluir(CASO_ID);

      expect(await s.service.resultado(resolucao.id)).toBeUndefined();
      expect(s.service.contagemEtapas(resolucao.id)).toEqual({ corretas: 5, divergentes: 0, comErro: 0 });
      expect(s.service.excluir(resolucao.id)).toBe(true);
    });

    it('devolve cópias: mudar o resultado não altera o que está guardado', async () => {
      const s = abrir();
      const resolucao = tentativaCompleta(s);
      await s.service.submeter(resolucao.id);

      const primeiro = (await s.service.resultado(resolucao.id))!;
      primeiro.etapas[0].etapa.criterioReferencia = 'mudei';
      primeiro.etapas[0].avaliacao.motivo = 'mudei';
      primeiro.resumoErros.aritmética = 99;

      const segundo = (await s.service.resultado(resolucao.id))!;
      expect(segundo.etapas[0].etapa.criterioReferencia).not.toBe('mudei');
      expect(segundo.etapas[0].avaliacao.motivo).not.toBe('mudei');
      expect(segundo.resumoErros.aritmética).toBe(0);
    });
  });

  describe('tentativa submetida não aceita edição', () => {
    it('nenhuma função de edição muda nada: devolve undefined ou false e o armazenamento fica igual', async () => {
      const s = abrir();
      const resolucao = tentativaCompleta(s);
      const refeicao = s.service.listarRefeicoes(resolucao.id)[0];
      const item = s.service.listarItens(refeicao.id)[0];
      const [tmbEtapa] = s.casos.listarEtapas(CASO_ID);
      await s.service.submeter(resolucao.id);
      const antes = localStorage.getItem(CHAVE);

      expect(s.service.salvarResposta(resolucao.id, tmbEtapa.id, 'Cunningham', 1)).toBeUndefined();
      expect(s.service.salvarJustificativa(resolucao.id, 'mudei')).toBeUndefined();
      expect(s.service.criarRefeicao(resolucao.id, { nome: 'Nova', horario: '10:00', marcador: 'nenhum' })).toBeUndefined();
      expect(s.service.atualizarRefeicao(refeicao.id, { nome: 'Outra', horario: '10:00', marcador: 'nenhum' })).toBeUndefined();
      expect(s.service.excluirRefeicao(refeicao.id)).toBe(false);
      expect(s.service.criarItem(refeicao.id, { alimentoId: 'a1', quantidadeGramas: 10 })).toBeUndefined();
      expect(s.service.atualizarItem(item.id, { quantidadeGramas: 1 })).toBeUndefined();
      expect(s.service.excluirItem(item.id)).toBe(false);
      expect(await s.service.submeter(resolucao.id)).toBeUndefined();

      expect(localStorage.getItem(CHAVE)).toBe(antes);
    });

    it('mas pode ser excluída e refeita', async () => {
      const s = abrir();
      const resolucao = tentativaCompleta(s);
      await s.service.submeter(resolucao.id);

      expect(s.service.refazer(resolucao.id)?.status).toBe('em andamento');
      expect(s.service.excluir(resolucao.id)).toBe(true);
    });
  });

  describe('refazer', () => {
    it('cria outra tentativa do mesmo caso, sem copiar nada, e deixa a anterior como estava', async () => {
      const s = abrir();
      const anterior = tentativaCompleta(s);
      s.service.salvarJustificativa(anterior.id, 'texto da primeira');
      await s.service.submeter(anterior.id);
      const salvaAntes = JSON.stringify([
        s.service.buscar(anterior.id),
        s.service.listarRespostas(anterior.id),
        s.service.listarRefeicoes(anterior.id),
        s.service.listarItensDaResolucao(anterior.id),
      ]);

      const nova = s.service.refazer(anterior.id)!;

      expect(nova.id).not.toBe(anterior.id);
      expect(nova.casoId).toBe(anterior.casoId);
      expect(nova.status).toBe('em andamento');
      expect(nova.justificativa).toBe('');
      expect(nova.submetidaEm).toBeUndefined();
      expect(s.service.listarRespostas(nova.id)).toEqual([]);
      expect(s.service.listarRefeicoes(nova.id)).toEqual([]);
      expect(s.service.listarItensDaResolucao(nova.id)).toEqual([]);
      expect(s.service.pendencias(nova.id)?.length).toBe(6);
      expect(
        JSON.stringify([
          s.service.buscar(anterior.id),
          s.service.listarRespostas(anterior.id),
          s.service.listarRefeicoes(anterior.id),
          s.service.listarItensDaResolucao(anterior.id),
        ]),
      ).toBe(salvaAntes);
    });

    it('tentativa inexistente ou de um caso que sumiu: undefined', () => {
      const s = abrir();
      const resolucao = s.service.iniciar(CASO_ID)!;

      expect(s.service.refazer('inexistente')).toBeUndefined();
      s.casos.excluir(CASO_ID);
      expect(s.service.refazer(resolucao.id)).toBeUndefined();
    });
  });

  describe('excluir em cascata', () => {
    it('apaga a tentativa, as respostas, as refeições, os itens e a avaliação dela, e só as dela', async () => {
      const s = abrir();
      const alvo = tentativaCompleta(s);
      const outra = tentativaCompleta(s);
      await s.service.submeter(alvo.id);
      await s.service.submeter(outra.id);

      expect(s.service.excluir(alvo.id)).toBe(true);

      expect(s.service.buscar(alvo.id)).toBeUndefined();
      expect(s.service.listarRespostas(alvo.id)).toEqual([]);
      expect(s.service.listarRefeicoes(alvo.id)).toEqual([]);
      expect(s.service.listarItensDaResolucao(alvo.id)).toEqual([]);
      expect(await s.service.resultado(alvo.id)).toBeUndefined();
      const salvos = lerSalvos()!;
      expect(salvos['resolucoes'].length).toBe(1);
      expect(salvos['respostas'].length).toBe(5);
      expect(salvos['refeicoes'].length).toBe(4);
      expect(salvos['itens'].length).toBe(6);
      expect(salvos['submissoes'].length).toBe(1);
      // a outra continua inteira
      expect((await s.service.resultado(outra.id))?.etapas.length).toBe(5);
    });

    it('tentativa que não existe: false, sem mudar nada', () => {
      const s = abrir();
      s.service.iniciar(CASO_ID);
      const antes = localStorage.getItem(CHAVE);

      expect(s.service.excluir('inexistente')).toBe(false);
      expect(localStorage.getItem(CHAVE)).toBe(antes);
    });
  });

  describe('ciclo completo', () => {
    it('iniciar → responder 5 etapas → dieta → justificativa → pendências vazias → submeter → resultado → refazer → excluir', async () => {
      const s = abrir();

      const resolucao = s.service.iniciar(CASO_ID)!;
      expect(s.service.pendencias(resolucao.id)?.length).toBe(6);
      responder(s, resolucao.id);
      montarDietaBoa(s, resolucao.id);
      s.service.salvarJustificativa(resolucao.id, 'Usei Mifflin-St Jeor e o fator do volume de treino.');
      expect(s.service.pendencias(resolucao.id)).toEqual([]);

      const submetida = await s.service.submeter(resolucao.id);
      expect(submetida?.status).toBe('submetida');

      const resultado = (await s.service.resultado(resolucao.id))!;
      expect(resultado.etapas.every((e) => e.avaliacao.classificacao === 'correta')).toBe(true);
      expect(s.service.contagemEtapas(resolucao.id)).toEqual({ corretas: 5, divergentes: 0, comErro: 0 });
      expect(resultado.resolucao.justificativa).toBe('Usei Mifflin-St Jeor e o fator do volume de treino.');
      expect(resultado.dieta?.dietaForaDasMetas).toBe(false);

      const nova = s.service.refazer(resolucao.id)!;
      expect(s.service.listar().map((r) => r.id)).toEqual([nova.id, resolucao.id]);

      expect(s.service.excluir(resolucao.id)).toBe(true);
      expect(s.service.listar().map((r) => r.id)).toEqual([nova.id]);
      const salvos = lerSalvos()!;
      expect([salvos['respostas'], salvos['refeicoes'], salvos['itens'], salvos['submissoes']].map((l) => l.length)).toEqual([0, 0, 0, 0]);
    });
  });

  describe('persistência', () => {
    it('um serviço novo lê o que o anterior gravou: tentativas, respostas, dieta e resultado', async () => {
      const a = abrir();
      const andamento = a.service.iniciar(CASO_ID)!;
      responder(a, andamento.id);
      a.service.salvarJustificativa(andamento.id, 'rascunho');
      const feita = tentativaCompleta(a, { CHO: [6, 420000] });
      await a.service.submeter(feita.id);

      const b = abrir(); // storage e serviços novos: só enxergam o localStorage

      expect(b.service.listar()).toEqual(a.service.listar());
      expect(b.service.buscar(andamento.id)?.justificativa).toBe('rascunho');
      expect(b.service.listarRespostas(andamento.id)).toEqual(a.service.listarRespostas(andamento.id));
      expect(b.service.listarRefeicoes(feita.id)).toEqual(a.service.listarRefeicoes(feita.id));
      expect(b.service.listarItensDaResolucao(feita.id)).toEqual(a.service.listarItensDaResolucao(feita.id));
      expect(b.service.contagemEtapas(feita.id)).toEqual(a.service.contagemEtapas(feita.id));
      expect(await b.service.resultado(feita.id)).toEqual(await a.service.resultado(feita.id));
      expect(b.service.pendencias(andamento.id)?.map((p) => p.tipo)).toEqual(['dieta']);
    });

    it('a tentativa em andamento continua de onde parou depois de reabrir', () => {
      const a = abrir();
      const resolucao = a.service.iniciar(CASO_ID)!;
      responder(a, resolucao.id);

      const b = abrir();
      montarDietaBoa(b, resolucao.id);

      expect(b.service.pendencias(resolucao.id)).toEqual([]);
    });

    it('o que foi excluído não volta ao reabrir', () => {
      const a = abrir();
      const resolucao = tentativaCompleta(a);
      a.service.excluir(resolucao.id);

      expect(abrir().service.listar()).toEqual([]);
    });
  });

  describe('dado salvo ruim', () => {
    /** Uma tentativa completa e submetida, guardada; devolve o JSON salvo para estragar. */
    async function salvoSubmetido() {
      const s = abrir();
      const resolucao = tentativaCompleta(s);
      await s.service.submeter(resolucao.id);
      return { id: resolucao.id, salvos: lerSalvos()! };
    }
    const gravar = (dados: unknown): void => localStorage.setItem(CHAVE, JSON.stringify(dados));

    it('JSON inválido ou que não é objeto vale como sem dados, e o serviço funciona', () => {
      for (const texto of ['{não é json', '"texto"', '42', 'null', '[1,2]']) {
        localStorage.setItem(CHAVE, texto);

        const s = abrir();

        expect(s.service.listar(), texto).toEqual([]);
        expect(s.service.iniciar(CASO_ID), texto).toBeDefined();
      }
    });

    it('lista ausente, que não é lista ou com itens tortos: descarta o torto e mantém o bom', async () => {
      const { id, salvos } = await salvoSubmetido();
      gravar({ ...salvos, respostas: 'texto', refeicoes: null, itens: [null, 3, 'x', { id: 1 }, ...salvos['itens']], submissoes: undefined });

      const s = abrir();

      expect(s.service.buscar(id)?.status).toBe('em andamento'); // submetida sem avaliação guardada volta a em andamento
      expect(s.service.listarRespostas(id)).toEqual([]);
      expect(s.service.listarRefeicoes(id)).toEqual([]);
      expect(s.service.listarItensDaResolucao(id)).toEqual([]);
      expect(() => s.service.pendencias(id)).not.toThrow();
    });

    it('tentativa torta é descartada; respostas, refeições e itens sem pai também', async () => {
      const { id, salvos } = await salvoSubmetido();
      const refeicaoOrfa = { id: 'r-orfa', resolucaoId: 'nao-existe', nome: 'X', horario: '10:00', marcador: 'nenhum' };
      gravar({
        ...salvos,
        resolucoes: [...(salvos['resolucoes'] as unknown[]), { id: 'torta' }, null],
        respostas: [...(salvos['respostas'] as unknown[]), { id: 'r-x', resolucaoId: 'nao-existe', etapaId: 'e', parametro: 1, valor: 1 }],
        refeicoes: [...(salvos['refeicoes'] as unknown[]), refeicaoOrfa],
        itens: [...(salvos['itens'] as unknown[]), { id: 'i-x', refeicaoId: 'r-orfa', alimentoId: 'a1', quantidadeGramas: 10 }],
      });

      const s = abrir();

      expect(s.service.listar().map((r) => r.id)).toEqual([id]);
      const regravado = lerSalvos()!;
      expect(regravado['respostas'].length).toBe(5);
      expect(regravado['refeicoes'].length).toBe(4);
      expect(regravado['itens'].length).toBe(6);
    });

    it('etapa respondida duas vezes: fica a última', async () => {
      const { id, salvos } = await salvoSubmetido();
      const respostas = salvos['respostas'] as { id: string; valor: number }[];
      gravar({ ...salvos, respostas: [{ ...respostas[2], id: 'duplicada', valor: 1 }, ...respostas] });

      const s = abrir();

      expect(s.service.listarRespostas(id).length).toBe(5);
      expect(s.service.listarRespostas(id)[2].valor).toBe(420); // a última da lista é a original
    });

    it('resposta com valor ou parâmetro inválido é descartada e vira pendência', async () => {
      const { id, salvos } = await salvoSubmetido();
      const respostas = (salvos['respostas'] as Record<string, unknown>[]).map((r, i) =>
        i === 0 ? { ...r, valor: 'texto' } : i === 1 ? { ...r, parametro: null } : r,
      );
      gravar({ ...salvos, respostas });

      const s = abrir();

      expect(s.service.listarRespostas(id).length).toBe(3);
      expect(s.service.pendencias(id)?.filter((p) => p.tipo === 'etapa').length).toBe(2);
    });

    it('tentativa "submetida" sem a avaliação guardada volta a "em andamento", sem data de submissão nem veredito', async () => {
      const { id, salvos } = await salvoSubmetido();
      gravar({ ...salvos, submissoes: [] });

      const s = abrir();

      expect(s.service.buscar(id)?.status).toBe('em andamento');
      expect(s.service.buscar(id)?.submetidaEm).toBeUndefined();
      expect(s.service.listarRespostas(id).every((r) => r.classificacao === undefined && r.tipoErro === undefined)).toBe(true);
      expect(await s.service.resultado(id)).toBeUndefined();
      expect(s.service.pendencias(id)).toEqual([]); // tudo o mais está lá: dá para submeter de novo
      expect((await s.service.submeter(id))?.status).toBe('submetida');
    });

    it('tentativa "em andamento" não guarda veredito nem avaliação (RF09)', () => {
      const s0 = abrir();
      const resolucao = tentativaCompleta(s0);
      const salvos = lerSalvos()!;
      gravar({
        ...salvos,
        respostas: (salvos['respostas'] as Record<string, unknown>[]).map((r) => ({ ...r, classificacao: 'correta', tipoErro: 'aritmética' })),
        submissoes: [{ resolucaoId: resolucao.id, dietaForaDasMetas: true, etapas: [], avaliacoes: [] }],
      });

      const s = abrir();

      expect(s.service.listarRespostas(resolucao.id).every((r) => r.classificacao === undefined && r.tipoErro === undefined)).toBe(true);
      expect(lerSalvos()?.['submissoes']).toEqual([]);
      expect(s.service.resumoErros(resolucao.id)).toBeUndefined();
    });

    it('submetida com a avaliação incompleta: não há resultado (e não quebra)', async () => {
      const { id, salvos } = await salvoSubmetido();
      const submissao = (salvos['submissoes'] as { avaliacoes: unknown[] }[])[0];
      gravar({ ...salvos, submissoes: [{ ...submissao, avaliacoes: submissao.avaliacoes.slice(0, 2) }] });

      const s = abrir();

      await expect(s.service.resultado(id)).resolves.toBeUndefined();
    });

    it('só regrava quando consertou algo', async () => {
      await salvoSubmetido();
      const limpo = localStorage.getItem(CHAVE);
      const setItem = vi.spyOn(Storage.prototype, 'setItem');

      abrir();
      expect(setItem).not.toHaveBeenCalled();
      expect(localStorage.getItem(CHAVE)).toBe(limpo);

      localStorage.setItem(CHAVE, JSON.stringify({ ...JSON.parse(limpo!), itens: [null] }));
      setItem.mockClear();
      abrir();
      expect(setItem).toHaveBeenCalledTimes(1);
      expect(lerSalvos()?.['itens']).toEqual([]);
    });
  });

  describe('quando o localStorage falha', () => {
    it('usa dados vazios se a leitura falha, e continua funcionando', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('bloqueado');
      });

      const s = abrir();

      expect(s.service.listar()).toEqual([]);
      expect(s.service.iniciar(CASO_ID)).toBeDefined();
    });

    it('guarda em memória se a gravação falha: o mesmo StorageService ainda enxerga tudo', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('cheio');
      });
      const storage = new StorageService();
      const casos = new CasoService(storage);
      const alimentos = new AlimentoService(storage, carregadorOk());
      const servico = new ResolucaoService(storage, casos, alimentos);

      const resolucao = servico.iniciar(CASO_ID)!;
      const reaberto = new ResolucaoService(storage, casos, alimentos);

      expect(reaberto.buscar(resolucao.id)).toBeDefined();
      expect(localStorage.getItem(CHAVE)).toBeNull();
    });
  });

  describe('tipos de erro', () => {
    it('são os 5 da RF34', () => {
      const esperados: TipoErro[] = ['conversão de unidade', 'escolha de equação', 'aritmética', 'meta fora de faixa', 'dieta fora das metas'];
      expect([...TIPOS_ERRO]).toEqual(esperados);
    });
  });
});
