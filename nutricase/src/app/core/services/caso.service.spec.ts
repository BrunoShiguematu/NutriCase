import { TestBed } from '@angular/core/testing';
import { ATLETAS_EXEMPLO, CASOS_EXEMPLO, VERSAO_CASOS_EXEMPLO } from '../data/casos-exemplo';
import { Atleta, Caso } from '../models';
import { CasoService, DadosAtleta, DadosCaso } from './caso.service';
import { StorageService } from './storage.service';

const CHAVE = 'nutricase.casos';

interface Salvos {
  versao: number;
  casos: Caso[];
  atletas: Atleta[];
}

function dadosCaso(titulo = 'Caso de teste'): DadosCaso {
  return {
    titulo,
    modalidade: 'Remo',
    nivel: 'Intermediário',
    competencia: 'Gasto energético total',
    descricao: 'Descrição de teste.',
    comentarioReferencia: 'Referência de teste.',
  };
}

function dadosAtleta(nome = 'Atleta de Teste'): DadosAtleta {
  return {
    nome,
    idade: 30,
    sexo: 'feminino',
    peso: 60,
    altura: 165,
    volumeTreino: '60 min/dia',
    horarioTreino: '07h00',
    fasePeriodizacao: 'Base',
    objetivo: 'Teste',
    restricoes: [],
    preferencias: [],
  };
}

/** Lê o localStorage de verdade, sem passar pelo StorageService (que guarda uma cópia em memória). */
function lerLocalStorage(): Salvos | null {
  const texto = localStorage.getItem(CHAVE);
  return texto === null ? null : (JSON.parse(texto) as Salvos);
}

/** Simula fechar e abrir o app: serviço novo com StorageService novo, que só enxerga o localStorage. */
function reabrir(): CasoService {
  return new CasoService(new StorageService());
}

describe('StorageService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('um StorageService novo lê o que outro gravou', () => {
    new StorageService().gravar('chave-teste', { a: 1, lista: ['x'] });

    expect(localStorage.getItem('chave-teste')).toBe('{"a":1,"lista":["x"]}');
    expect(new StorageService().ler<{ a: number }>('chave-teste')).toEqual({ a: 1, lista: ['x'] });
  });

  it('remover apaga do localStorage', () => {
    const storage = new StorageService();
    storage.gravar('chave-teste', 1);
    storage.remover('chave-teste');

    expect(localStorage.getItem('chave-teste')).toBeNull();
    expect(new StorageService().ler('chave-teste')).toBeNull();
  });
});

describe('CasoService', () => {
  let storage: StorageService;
  let service: CasoService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    storage = TestBed.inject(StorageService);
    service = TestBed.inject(CasoService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('carga inicial', () => {
    it('grava os casos de exemplo, cada um com sua ficha de atleta, e a versão atual', () => {
      expect(service.listar().length).toBe(CASOS_EXEMPLO.length);
      for (const caso of service.listar()) {
        expect(service.buscarPorId(caso.id)?.atleta.id).toBe(caso.atletaId);
      }
      const noNavegador = lerLocalStorage();
      expect(noNavegador?.versao).toBe(VERSAO_CASOS_EXEMPLO);
      expect(noNavegador?.casos.length).toBe(CASOS_EXEMPLO.length);
      expect(noNavegador?.atletas.length).toBe(ATLETAS_EXEMPLO.length);
      expect(ATLETAS_EXEMPLO.length).toBe(CASOS_EXEMPLO.length);
    });

    it('não inclui o caso de fisiculturista em cutting', () => {
      const titulos = service.listar().map((c) => c.titulo.toLowerCase());
      expect(titulos.some((t) => t.includes('fisiculturista') || t.includes('cutting'))).toBe(false);
    });

    it('não regrava os exemplos quando a versão é a mesma', () => {
      service.excluir(CASOS_EXEMPLO[0].id);
      const reaberto = reabrir();
      expect(reaberto.buscarPorId(CASOS_EXEMPLO[0].id)).toBeUndefined();
      expect(reaberto.listar().length).toBe(CASOS_EXEMPLO.length - 1);
    });
  });

  describe('criar', () => {
    it('cria caso e atleta com ids string, ligados entre si, e guarda no storage', () => {
      const criado = service.criar(dadosCaso(), dadosAtleta());

      expect(typeof criado.caso.id).toBe('string');
      expect(criado.caso.atletaId).toBe(criado.atleta.id);
      expect(service.buscarPorId(criado.caso.id)?.atleta.nome).toBe('Atleta de Teste');

      const noNavegador = lerLocalStorage();
      expect(noNavegador?.casos.some((c) => c.id === criado.caso.id)).toBe(true);
      expect(noNavegador?.atletas.some((a) => a.id === criado.atleta.id)).toBe(true);

      const reaberto = reabrir();
      expect(reaberto.buscarPorId(criado.caso.id)?.caso.titulo).toBe('Caso de teste');
      expect(reaberto.buscarPorId(criado.caso.id)?.atleta.nome).toBe('Atleta de Teste');
    });

    it('atualiza o signal casos para as telas', () => {
      const antes = service.casos().length;
      service.criar(dadosCaso(), dadosAtleta());
      expect(service.casos().length).toBe(antes + 1);
    });

    it('gera ids diferentes para casos diferentes', () => {
      const a = service.criar(dadosCaso('A'), dadosAtleta());
      const b = service.criar(dadosCaso('B'), dadosAtleta());
      expect(a.caso.id).not.toBe(b.caso.id);
      expect(a.atleta.id).not.toBe(b.atleta.id);
    });
  });

  describe('atualizar', () => {
    it('muda o caso e o atleta mantendo os ids, e persiste', () => {
      const { caso } = service.criar(dadosCaso(), dadosAtleta());

      const atualizado = service.atualizar(
        caso.id,
        { ...dadosCaso('Título novo'), nivel: 'Avançado' },
        { ...dadosAtleta('Nome novo'), peso: 65 },
      );

      expect(atualizado?.caso.id).toBe(caso.id);
      expect(atualizado?.atleta.id).toBe(caso.atletaId);

      const noNavegador = lerLocalStorage();
      expect(noNavegador?.casos.find((c) => c.id === caso.id)?.titulo).toBe('Título novo');
      expect(noNavegador?.atletas.find((a) => a.id === caso.atletaId)?.peso).toBe(65);

      const reaberto = reabrir().buscarPorId(caso.id);
      expect(reaberto?.caso.titulo).toBe('Título novo');
      expect(reaberto?.caso.nivel).toBe('Avançado');
      expect(reaberto?.atleta.nome).toBe('Nome novo');
      expect(reaberto?.atleta.peso).toBe(65);
    });

    it('devolve undefined e não muda nada quando o id não existe', () => {
      const antes = service.listar().length;
      expect(service.atualizar('inexistente', dadosCaso(), dadosAtleta())).toBeUndefined();
      expect(service.listar().length).toBe(antes);
    });
  });

  describe('excluir', () => {
    it('exclui o caso e o atleta dele, e persiste', () => {
      const { caso, atleta } = service.criar(dadosCaso(), dadosAtleta());
      expect(lerLocalStorage()?.casos.some((c) => c.id === caso.id)).toBe(true);
      expect(lerLocalStorage()?.atletas.some((a) => a.id === atleta.id)).toBe(true);

      expect(service.excluir(caso.id)).toBe(true);

      expect(service.buscarPorId(caso.id)).toBeUndefined();
      const noNavegador = lerLocalStorage();
      expect(noNavegador?.casos.some((c) => c.id === caso.id)).toBe(false);
      expect(noNavegador?.atletas.some((a) => a.id === atleta.id)).toBe(false);
      expect(reabrir().buscarPorId(caso.id)).toBeUndefined();
    });

    it('não mexe nos outros casos e atletas', () => {
      const salvosAntes = lerLocalStorage();
      const { caso } = service.criar(dadosCaso(), dadosAtleta());
      service.excluir(caso.id);

      const salvos = lerLocalStorage();
      expect(salvos?.casos.length).toBe(salvosAntes?.casos.length);
      expect(salvos?.atletas.length).toBe(salvosAntes?.atletas.length);
    });

    it('devolve false quando o id não existe', () => {
      expect(service.excluir('inexistente')).toBe(false);
    });
  });

  describe('troca de versão', () => {
    it('troca os exemplos antigos pelos atuais e mantém os casos do usuário', () => {
      const doUsuario = service.criar(dadosCaso('Meu caso'), dadosAtleta('Minha atleta'));

      const salvos = lerLocalStorage() as Salvos;
      const exemploAntigo: Caso = {
        ...CASOS_EXEMPLO[0],
        id: 'exemplo-caso-99',
        atletaId: 'exemplo-atleta-99',
        titulo: 'Exemplo de uma versão antiga',
      };
      const atletaAntigo: Atleta = { ...ATLETAS_EXEMPLO[0], id: 'exemplo-atleta-99' };
      localStorage.setItem(
        CHAVE,
        JSON.stringify({
          versao: VERSAO_CASOS_EXEMPLO - 1,
          casos: [...salvos.casos, exemploAntigo],
          atletas: [...salvos.atletas, atletaAntigo],
        }),
      );

      const reaberto = reabrir();

      expect(reaberto.buscarPorId('exemplo-caso-99')).toBeUndefined();
      expect(reaberto.buscarPorId(doUsuario.caso.id)?.atleta.nome).toBe('Minha atleta');
      expect(reaberto.listar().length).toBe(CASOS_EXEMPLO.length + 1);
      for (const exemplo of CASOS_EXEMPLO) {
        expect(reaberto.buscarPorId(exemplo.id)).toBeDefined();
      }

      const novosSalvos = lerLocalStorage();
      expect(novosSalvos?.versao).toBe(VERSAO_CASOS_EXEMPLO);
      expect(novosSalvos?.atletas.some((a) => a.id === 'exemplo-atleta-99')).toBe(false);
    });

    it('recoloca um exemplo que estava excluído na versão antiga', () => {
      service.excluir(CASOS_EXEMPLO[0].id);
      const salvos = lerLocalStorage() as Salvos;
      localStorage.setItem(CHAVE, JSON.stringify({ ...salvos, versao: VERSAO_CASOS_EXEMPLO - 1 }));

      const reaberto = reabrir();

      expect(reaberto.buscarPorId(CASOS_EXEMPLO[0].id)).toBeDefined();
    });
  });

  describe('cópias', () => {
    const idComRestricao = 'exemplo-caso-5';

    it('alterar o que buscarPorId devolveu não muda o próximo buscarPorId', () => {
      const achado = service.buscarPorId(idComRestricao);
      achado!.caso.titulo = 'Alterado pela tela';
      achado!.atleta.nome = 'Nome alterado';
      achado!.atleta.restricoes.push('Restrição inventada');

      const denovo = service.buscarPorId(idComRestricao);
      expect(denovo?.caso.titulo).toBe(CASOS_EXEMPLO[4].titulo);
      expect(denovo?.atleta.nome).toBe(ATLETAS_EXEMPLO[4].nome);
      expect(denovo?.atleta.restricoes).toEqual(ATLETAS_EXEMPLO[4].restricoes);
    });

    it('alterar o que listar e o signal casos devolveram não muda o estado do serviço', () => {
      service.listar()[0].titulo = 'Alterado em listar';
      service.casos()[1].titulo = 'Alterado no signal';

      // listar() e buscarPorId() entregam cópias novas a cada chamada, sempre do estado intacto.
      expect(service.listar()[0].titulo).toBe(CASOS_EXEMPLO[0].titulo);
      expect(service.listar()[1].titulo).toBe(CASOS_EXEMPLO[1].titulo);
      expect(service.buscarPorId(CASOS_EXEMPLO[1].id)?.caso.titulo).toBe(CASOS_EXEMPLO[1].titulo);
      expect(lerLocalStorage()?.casos[1].titulo).toBe(CASOS_EXEMPLO[1].titulo);
    });

    it('não altera as constantes de exemplo', () => {
      const tituloOriginal = CASOS_EXEMPLO[4].titulo;
      const restricoesOriginais = [...ATLETAS_EXEMPLO[4].restricoes];

      const achado = service.buscarPorId(idComRestricao);
      achado!.caso.titulo = 'Alterado';
      achado!.atleta.restricoes.push('Outra');
      service.atualizar(idComRestricao, { ...dadosCaso('Editado') }, { ...dadosAtleta() });
      service.excluir(CASOS_EXEMPLO[0].id);

      expect(CASOS_EXEMPLO[4].titulo).toBe(tituloOriginal);
      expect(ATLETAS_EXEMPLO[4].restricoes).toEqual(restricoesOriginais);
      expect(CASOS_EXEMPLO.length).toBe(8);
      expect(ATLETAS_EXEMPLO.length).toBe(8);
    });

    it('alterar os dados depois de criar não muda o que foi guardado', () => {
      const entradaCaso = dadosCaso();
      const entradaAtleta = dadosAtleta();
      const { caso } = service.criar(entradaCaso, entradaAtleta);

      entradaCaso.titulo = 'Mudou depois';
      entradaAtleta.restricoes.push('Mudou depois');

      expect(service.buscarPorId(caso.id)?.caso.titulo).toBe('Caso de teste');
      expect(service.buscarPorId(caso.id)?.atleta.restricoes).toEqual([]);
    });
  });

  describe('quando o localStorage falha', () => {
    it('usa os exemplos em memória se a leitura falha', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('bloqueado');
      });

      const servico = new CasoService(new StorageService());

      expect(servico.listar().length).toBe(CASOS_EXEMPLO.length);
    });

    it('continua funcionando em memória se a gravação falha', () => {
      localStorage.clear();
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('cheio');
      });
      const semNavegador = new StorageService();
      const servico = new CasoService(semNavegador);

      const { caso } = servico.criar(dadosCaso(), dadosAtleta());

      expect(servico.buscarPorId(caso.id)).toBeDefined();
      expect(new CasoService(semNavegador).buscarPorId(caso.id)).toBeDefined();
      expect(localStorage.getItem(CHAVE)).toBeNull();
    });

    it('trata JSON inválido guardado como ausência de dados', () => {
      localStorage.setItem(CHAVE, '{não é json');

      const servico = new CasoService(new StorageService());

      expect(servico.listar().length).toBe(CASOS_EXEMPLO.length);
    });
  });
});
