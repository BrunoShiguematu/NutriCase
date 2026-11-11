import { TestBed } from '@angular/core/testing';
import { Alimento } from '../models';
import { AlimentoService, CarregadorTaco, VERSAO_TACO } from './alimento.service';
import { StorageService } from './storage.service';

const CHAVE = 'nutricase.alimentos';

interface Salvos {
  versao: number;
  alimentos: Alimento[];
}

function alimento(id: string, nome: string, grupo: string, origem: Alimento['origem'] = 'TACO'): Alimento {
  return { id, nome, grupo, kcal: 100, carboidrato: 10, proteina: 5, gordura: 2, origem };
}

const TACO_PEQUENA: Alimento[] = [
  alimento('taco-001', 'Arroz, tipo 1, cozido', 'Cereais e derivados'),
  alimento('taco-002', 'Arroz, integral, cru', 'Cereais e derivados'),
  alimento('taco-003', 'Feijão, carioca, cozido', 'Leguminosas e derivados'),
  alimento('taco-004', 'Açaí, polpa, congelada', 'Frutas e derivados'),
  alimento('taco-005', 'Ovo, de galinha, inteiro, cozido', 'Ovos e derivados'),
];

/** Carregador de mentira que conta as chamadas. */
function carregador(itens: readonly Alimento[] = TACO_PEQUENA) {
  return vi.fn<CarregadorTaco>(async () => itens.map((a) => ({ ...a })));
}

/** Lê o localStorage de verdade, sem passar pelo StorageService (que guarda cópia em memória). */
function lerLocalStorage(): Salvos | null {
  const texto = localStorage.getItem(CHAVE);
  return texto === null ? null : (JSON.parse(texto) as Salvos);
}

/** Simula fechar e abrir o app: serviço e StorageService novos, que só enxergam o localStorage. */
function abrir(carregarTaco: CarregadorTaco = carregador()): AlimentoService {
  return new AlimentoService(new StorageService(), carregarTaco);
}

async function aberto(carregarTaco?: CarregadorTaco): Promise<AlimentoService> {
  const servico = abrir(carregarTaco);
  await servico.carregar();
  return servico;
}

describe('AlimentoService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('carga inicial', () => {
    it('antes de carregar, o estado é "nao-carregado" e as consultas devolvem vazio', () => {
      const servico = abrir();

      expect(servico.estado()).toBe('nao-carregado');
      expect(servico.listar()).toEqual([]);
      expect(servico.buscarPorNome('arroz')).toEqual([]);
      expect(servico.listarGrupos()).toEqual([]);
    });

    it('na primeira abertura, grava a TACO e a versão no localStorage', async () => {
      const servico = await aberto();

      expect(servico.estado()).toBe('pronto');
      expect(servico.listar()).toEqual(TACO_PEQUENA);
      const salvo = lerLocalStorage();
      expect(salvo?.versao).toBe(VERSAO_TACO);
      expect(salvo?.alimentos).toEqual(TACO_PEQUENA);
    });

    it('com a versão atual já gravada, lê do navegador e nem carrega a TACO', async () => {
      await aberto();
      const outroCarregador = carregador([]);

      const reaberto = await aberto(outroCarregador);

      expect(outroCarregador).not.toHaveBeenCalled();
      expect(reaberto.listar()).toEqual(TACO_PEQUENA);
    });

    it('chamar carregar várias vezes, mesmo ao mesmo tempo, carrega a TACO uma vez só', async () => {
      const carregarTaco = carregador();
      const servico = abrir(carregarTaco);

      await Promise.all([servico.carregar(), servico.carregar()]);
      await servico.carregar();

      expect(carregarTaco).toHaveBeenCalledTimes(1);
      expect(servico.listar()).toHaveLength(TACO_PEQUENA.length);
    });

    it('enquanto a carga está pendente, o estado é "carregando"; depois, "pronto"', async () => {
      let liberar: () => void = () => undefined;
      const lento = vi.fn<CarregadorTaco>(
        () => new Promise((resolve) => (liberar = () => resolve(TACO_PEQUENA.map((a) => ({ ...a }))))),
      );
      const servico = abrir(lento);

      const carga = servico.carregar();
      expect(servico.estado()).toBe('carregando');
      expect(servico.listar()).toEqual([]);

      liberar();
      await carga;
      expect(servico.estado()).toBe('pronto');
    });

    it('o signal "alimentos" começa vazio e se atualiza depois do carregar', async () => {
      const servico = abrir();
      expect(servico.alimentos()).toEqual([]);

      await servico.carregar();

      expect(servico.alimentos()).toEqual(TACO_PEQUENA);
    });

    it('versão atual gravada com lista vazia é tratada como ilegível', async () => {
      localStorage.setItem(CHAVE, JSON.stringify({ versao: VERSAO_TACO, alimentos: [] } satisfies Salvos));

      const servico = await aberto();

      expect(servico.listar()).toEqual(TACO_PEQUENA);
    });

    it('dado ilegível no localStorage é tratado como primeira abertura', async () => {
      localStorage.setItem(CHAVE, '{"nao":"é nosso"}');

      const servico = await aberto();

      expect(servico.listar()).toEqual(TACO_PEQUENA);
      expect(lerLocalStorage()?.versao).toBe(VERSAO_TACO);
    });

    it('com o localStorage bloqueado, funciona só em memória', async () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('bloqueado');
      });

      const servico = await aberto();

      expect(servico.estado()).toBe('pronto');
      expect(servico.listar()).toHaveLength(TACO_PEQUENA.length);
    });
  });

  describe('troca de versão', () => {
    it('troca os itens TACO pelos novos e mantém os de origem "aluno"', async () => {
      const doAluno = alimento('aluno-1', 'Pão de queijo da vovó', 'Alimentos preparados', 'aluno');
      const taco_antiga = alimento('taco-999', 'Item que saiu da TACO', 'Miscelâneas');
      localStorage.setItem(
        CHAVE,
        JSON.stringify({ versao: VERSAO_TACO - 1, alimentos: [taco_antiga, doAluno] } satisfies Salvos),
      );

      const servico = await aberto();

      const ids = servico.listar().map((a) => a.id);
      expect(ids).not.toContain('taco-999');
      expect(ids).toContain('aluno-1');
      expect(ids).toEqual([...TACO_PEQUENA.map((a) => a.id), 'aluno-1']);
      const salvo = lerLocalStorage();
      expect(salvo?.versao).toBe(VERSAO_TACO);
      expect(salvo?.alimentos.map((a) => a.id)).toEqual(ids);
      expect(salvo?.alimentos.find((a) => a.id === 'aluno-1')).toEqual(doAluno);
    });

    it('depois da troca, abrir de novo não carrega a TACO outra vez', async () => {
      localStorage.setItem(CHAVE, JSON.stringify({ versao: VERSAO_TACO - 1, alimentos: [] } satisfies Salvos));
      await aberto();
      const outroCarregador = carregador([]);

      await aberto(outroCarregador);

      expect(outroCarregador).not.toHaveBeenCalled();
    });
  });

  describe('consultas', () => {
    let servico: AlimentoService;
    beforeEach(async () => {
      servico = await aberto();
    });

    it('"arroz" encontra "Arroz"', () => {
      expect(servico.buscarPorNome('arroz').map((a) => a.nome)).toEqual([
        'Arroz, tipo 1, cozido',
        'Arroz, integral, cru',
      ]);
    });

    it('busca sem acento: "feijao" acha "Feijão", e "acai" acha "Açaí"', () => {
      expect(servico.buscarPorNome('feijao').map((a) => a.nome)).toEqual(['Feijão, carioca, cozido']);
      expect(servico.buscarPorNome('ACAI').map((a) => a.nome)).toEqual(['Açaí, polpa, congelada']);
    });

    it('buscar com acento acha o nome sem acento e vice-versa', () => {
      expect(servico.buscarPorNome('Feijão')).toHaveLength(1);
      expect(servico.buscarPorNome('FEIJÃO')).toHaveLength(1);
    });

    it('com várias palavras, o nome precisa ter todas, em qualquer ordem', () => {
      expect(servico.buscarPorNome('cozido arroz').map((a) => a.id)).toEqual(['taco-001']);
    });

    it('busca sem resultado devolve lista vazia', () => {
      expect(servico.buscarPorNome('pizza de unicórnio')).toEqual([]);
    });

    it('texto vazio ou só espaços devolve todos', () => {
      expect(servico.buscarPorNome('')).toHaveLength(TACO_PEQUENA.length);
      expect(servico.buscarPorNome('   ')).toHaveLength(TACO_PEQUENA.length);
    });

    it('buscarPorId acha o item ou devolve undefined', () => {
      expect(servico.buscarPorId('taco-003')?.nome).toBe('Feijão, carioca, cozido');
      expect(servico.buscarPorId('nao-existe')).toBeUndefined();
    });

    it('filtrarPorGrupo devolve só o grupo pedido, e vazio se o grupo não existe', () => {
      expect(servico.filtrarPorGrupo('Cereais e derivados').map((a) => a.id)).toEqual(['taco-001', 'taco-002']);
      expect(servico.filtrarPorGrupo('Grupo inventado')).toEqual([]);
    });

    it('listarGrupos devolve cada grupo uma vez, em ordem alfabética', () => {
      expect(servico.listarGrupos()).toEqual([
        'Cereais e derivados',
        'Frutas e derivados',
        'Leguminosas e derivados',
        'Ovos e derivados',
      ]);
    });

  });

  describe('cópias', () => {
    it('alterar o que o serviço devolveu não muda o serviço nem o localStorage', async () => {
      const servico = await aberto();

      const lista = servico.listar();
      lista[0].nome = 'ALTERADO';
      lista.pop();
      const porId = servico.buscarPorId('taco-002');
      if (porId) {
        porId.kcal = 9999;
      }
      servico.buscarPorNome('arroz')[0].proteina = 9999;
      servico.filtrarPorGrupo('Cereais e derivados')[0].gordura = 9999;

      expect(servico.listar()).toEqual(TACO_PEQUENA);
      expect(lerLocalStorage()?.alimentos).toEqual(TACO_PEQUENA);
    });

    it('alterar o que o carregador entregou não muda o serviço', async () => {
      const entrega = TACO_PEQUENA.map((a) => ({ ...a }));
      const servico = await aberto(async () => entrega);

      entrega[0].nome = 'ALTERADO';

      expect(servico.buscarPorId('taco-001')?.nome).toBe('Arroz, tipo 1, cozido');
    });
  });

  describe('falha ao carregar a TACO', () => {
    it('fica em "erro", não lança, e tentar de novo funciona', async () => {
      const falha = vi.fn<CarregadorTaco>().mockRejectedValueOnce(new Error('chunk não veio'));
      falha.mockImplementation(async () => TACO_PEQUENA.map((a) => ({ ...a })));
      const servico = abrir(falha);

      await expect(servico.carregar()).resolves.toBeUndefined();
      expect(servico.estado()).toBe('erro');
      expect(servico.listar()).toEqual([]);
      expect(localStorage.getItem(CHAVE)).toBeNull();

      await servico.carregar();
      expect(servico.estado()).toBe('pronto');
      expect(servico.listar()).toHaveLength(TACO_PEQUENA.length);
    });

    it('tentar de novo funciona também quando o carregador falha de forma síncrona', async () => {
      const falha = vi.fn<CarregadorTaco>(() => {
        throw new Error('falha síncrona');
      });
      const servico = abrir(falha);

      await servico.carregar();
      expect(servico.estado()).toBe('erro');

      falha.mockImplementation(async () => TACO_PEQUENA.map((a) => ({ ...a })));
      await servico.carregar();

      expect(falha).toHaveBeenCalledTimes(2);
      expect(servico.estado()).toBe('pronto');
    });

    it('com versão antiga no navegador e falha, mostra o que já tinha e não apaga nada', async () => {
      const antigo: Salvos = { versao: VERSAO_TACO - 1, alimentos: [alimento('aluno-1', 'Meu item', 'Outros', 'aluno')] };
      localStorage.setItem(CHAVE, JSON.stringify(antigo));
      const servico = abrir(async () => {
        throw new Error('sem rede');
      });

      await servico.carregar();

      expect(servico.estado()).toBe('erro');
      expect(servico.listar()).toEqual(antigo.alimentos);
      expect(lerLocalStorage()).toEqual(antigo);
    });
  });

  describe('com a TACO de verdade (import() dinâmico)', () => {
    it('o serviço injetado carrega o taco.json inteiro', async () => {
      const servico = TestBed.inject(AlimentoService);

      await servico.carregar();

      expect(servico.estado()).toBe('pronto');
      const todos = servico.listar();
      expect(todos).toHaveLength(592);
      expect(todos.every((a) => a.origem === 'TACO')).toBe(true);
      expect(servico.listarGrupos()).toHaveLength(15);
      expect(servico.buscarPorNome('feijao carioca cozido').map((a) => a.id)).toContain('taco-561');
      expect(servico.buscarPorId('taco-003')).toMatchObject({ nome: 'Arroz, tipo 1, cozido', kcal: 128 });
    });
  });
});
