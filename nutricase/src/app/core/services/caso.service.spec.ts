import { TestBed } from '@angular/core/testing';
import { avaliarEtapas } from '../avaliacao/avaliar-etapas';
import { EQUACOES_TMB, get, gramasPorDia, tmb } from '../avaliacao/formulas';
import {
  ATLETAS_EXEMPLO,
  CASOS_EXEMPLO,
  ETAPAS_EXEMPLO,
  etapasPadrao,
  TIPOS_ETAPA,
  VERSAO_CASOS_EXEMPLO,
} from '../data/casos-exemplo';
import { Atleta, Caso, EtapaCalculo, RespostaEtapa, TOLERANCIA_DIETA_PADRAO } from '../models';
import { AlimentoService } from './alimento.service';
import { CasoService, DadosAtleta, DadosCaso } from './caso.service';
import { ResolucaoService } from './resolucao.service';
import { StorageService } from './storage.service';

const CHAVE = 'nutricase.casos';

interface Salvos {
  versao: number;
  casos: Caso[];
  atletas: Atleta[];
  etapas: EtapaCalculo[];
  exemplosEditados?: unknown;
  exemplosExcluidos?: unknown;
}

function dadosCaso(titulo = 'Caso de teste'): DadosCaso {
  return {
    titulo,
    modalidade: 'Remo',
    nivel: 'Intermediário',
    competencia: 'Gasto energético total',
    descricao: 'Descrição de teste.',
    comentarioReferencia: 'Referência de teste.',
    toleranciaDieta: 10,
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

/** Simula a troca de VERSAO_CASOS_EXEMPLO: marca os dados salvos como de uma versão antiga e abre o app de novo. */
function subirVersao(): CasoService {
  const salvos = lerLocalStorage() as Salvos;
  localStorage.setItem(CHAVE, JSON.stringify({ ...salvos, versao: VERSAO_CASOS_EXEMPLO - 1 }));
  return reabrir();
}

describe('etapasPadrao e etapas dos casos de exemplo', () => {
  it('a versão dos exemplos é 2', () => {
    expect(VERSAO_CASOS_EXEMPLO).toBe(2);
  });

  it('o padrão para um caso qualquer: 5 etapas, ordem 1 a 5, TMB, GET, CHO, PTN, LIP', () => {
    const etapas = etapasPadrao('caso-qualquer');

    expect(etapas.map((e) => [e.ordem, e.tipo])).toEqual([[1, 'TMB'], [2, 'GET'], [3, 'CHO'], [4, 'PTN'], [5, 'LIP']]);
    expect(etapas.every((e) => e.casoId === 'caso-qualquer')).toBe(true);
    expect(etapas.map((e) => e.id)).toEqual(['caso-qualquer-etapa-1', 'caso-qualquer-etapa-2', 'caso-qualquer-etapa-3', 'caso-qualquer-etapa-4', 'caso-qualquer-etapa-5']);
    expect([...TIPOS_ETAPA]).toEqual(['TMB', 'GET', 'CHO', 'PTN', 'LIP']);
  });

  it('o padrão tem os valores pedidos: TMB Mifflin com as 3 equações; GET 1,7 (1,4–2,2); CHO 6 (4–10); PTN 1,6 (1,2–2,2); LIP 1 (0,5–1,5); tolerância 5 %', () => {
    const [tmbEtapa, getEtapa, cho, ptn, lip] = etapasPadrao('caso-qualquer');

    expect(tmbEtapa.parametroReferencia).toBe('Mifflin-St Jeor');
    expect(tmbEtapa.opcoesAceitaveis).toEqual([...EQUACOES_TMB]);
    expect(tmbEtapa.faixaAceitavel).toBeUndefined();
    expect([getEtapa.parametroReferencia, getEtapa.faixaAceitavel]).toEqual([1.7, { min: 1.4, max: 2.2 }]);
    expect([cho.parametroReferencia, cho.faixaAceitavel]).toEqual([6, { min: 4, max: 10 }]);
    expect([ptn.parametroReferencia, ptn.faixaAceitavel]).toEqual([1.6, { min: 1.2, max: 2.2 }]);
    expect([lip.parametroReferencia, lip.faixaAceitavel]).toEqual([1, { min: 0.5, max: 1.5 }]);
    expect(etapasPadrao('x').every((e) => e.tolerancia === 5)).toBe(true);
    for (const e of [getEtapa, cho, ptn, lip]) {
      expect(e.opcoesAceitaveis).toBeUndefined();
    }
  });

  it('cada etapa tem um critério de referência em texto (RF23) com o valor da referência', () => {
    const [tmbEtapa, getEtapa, cho] = etapasPadrao('x');

    expect(tmbEtapa.criterioReferencia).toContain('Mifflin-St Jeor');
    expect(getEtapa.criterioReferencia).toContain('1,7');
    expect(cho.criterioReferencia).toContain('6 g/kg');
    expect(etapasPadrao('x').every((e) => e.criterioReferencia.length > 0)).toBe(true);
  });

  it('o ajuste troca só a referência pedida; o resto continua padrão', () => {
    const [, getEtapa, cho, ptn] = etapasPadrao('x', { fatorAtividade: 2, choGPorKg: 8 });

    expect(getEtapa.parametroReferencia).toBe(2);
    expect(getEtapa.criterioReferencia).toContain('2');
    expect(cho.parametroReferencia).toBe(8);
    expect(ptn.parametroReferencia).toBe(1.6);
  });

  it('cada chamada devolve objetos novos (não compartilha estado)', () => {
    const a = etapasPadrao('x');
    a[0].opcoesAceitaveis?.push('inventada');
    a[1].faixaAceitavel!.min = 0;

    const b = etapasPadrao('x');
    expect(b[0].opcoesAceitaveis).toEqual([...EQUACOES_TMB]);
    expect(b[1].faixaAceitavel).toEqual({ min: 1.4, max: 2.2 });
  });

  describe('os 8 casos de exemplo', () => {
    it('têm 5 etapas cada, com ids únicos e ligadas ao caso', () => {
      expect(ETAPAS_EXEMPLO.length).toBe(CASOS_EXEMPLO.length * 5);
      expect(new Set(ETAPAS_EXEMPLO.map((e) => e.id)).size).toBe(ETAPAS_EXEMPLO.length);
      for (const caso of CASOS_EXEMPLO) {
        const doCaso = ETAPAS_EXEMPLO.filter((e) => e.casoId === caso.id);
        expect(doCaso.map((e) => e.tipo)).toEqual(['TMB', 'GET', 'CHO', 'PTN', 'LIP']);
        expect(caso.toleranciaDieta).toBe(TOLERANCIA_DIETA_PADRAO);
      }
    });

    it('a referência de cada etapa numérica está dentro da faixa aceitável', () => {
      for (const e of ETAPAS_EXEMPLO.filter((x) => x.tipo !== 'TMB')) {
        expect(e.parametroReferencia, e.id).toBeGreaterThanOrEqual(e.faixaAceitavel!.min);
        expect(e.parametroReferencia, e.id).toBeLessThanOrEqual(e.faixaAceitavel!.max);
      }
    });

    it('variam só onde o volume ou a modalidade deixa evidente', () => {
      const referencia = (casoId: string, tipo: string) => ETAPAS_EXEMPLO.find((e) => e.casoId === casoId && e.tipo === tipo)?.parametroReferencia;

      expect(referencia('exemplo-caso-1', 'GET')).toBe(1.8);
      expect(referencia('exemplo-caso-3', 'GET')).toBe(2);
      expect(referencia('exemplo-caso-6', 'GET')).toBe(1.7); // padrão
      expect(referencia('exemplo-caso-4', 'CHO')).toBe(5); // musculação (força)
      expect(referencia('exemplo-caso-7', 'CHO')).toBe(8); // treino longo
      expect(referencia('exemplo-caso-2', 'CHO')).toBe(6); // padrão
      expect(referencia('exemplo-caso-1', 'PTN')).toBe(1.6);
    });

    it('conferem de ponta a ponta com o motor: responder a referência de cada etapa dá tudo correto', () => {
      for (const caso of CASOS_EXEMPLO) {
        const atleta = ATLETAS_EXEMPLO.find((a) => a.id === caso.atletaId)!;
        const etapas = ETAPAS_EXEMPLO.filter((e) => e.casoId === caso.id);
        const ref = (tipo: string) => etapas.find((e) => e.tipo === tipo)!.parametroReferencia as number;
        const tmbAluno = tmb('Mifflin-St Jeor', atleta);
        const resposta = (i: number, parametro: string | number, valor: number): RespostaEtapa => ({
          id: `r${i}`, resolucaoId: 'r', etapaId: etapas[i].id, parametro, valor,
        });
        const respostas = [
          resposta(0, 'Mifflin-St Jeor', tmbAluno),
          resposta(1, ref('GET'), get(tmbAluno, ref('GET'))),
          resposta(2, ref('CHO'), gramasPorDia(ref('CHO'), atleta.peso)),
          resposta(3, ref('PTN'), gramasPorDia(ref('PTN'), atleta.peso)),
          resposta(4, ref('LIP'), gramasPorDia(ref('LIP'), atleta.peso)),
        ];

        const resultado = avaliarEtapas(etapas, respostas, atleta);

        expect(resultado.map((r) => r.classificacao), caso.id).toEqual(['correta', 'correta', 'correta', 'correta', 'correta']);
      }
    });
  });
});

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

    it('um exemplo excluído não volta, nem na troca de versão', () => {
      service.excluir(CASOS_EXEMPLO[0].id);

      const reaberto = subirVersao();

      expect(reaberto.buscarPorId(CASOS_EXEMPLO[0].id)).toBeUndefined();
      expect(reaberto.listar().length).toBe(CASOS_EXEMPLO.length - 1);
    });
  });

  describe('troca de versão: exemplos editados, excluídos e intactos', () => {
    const ID = CASOS_EXEMPLO[0].id;
    const OUTRO = CASOS_EXEMPLO[1].id;
    const ATLETA_ID = CASOS_EXEMPLO[0].atletaId;

    /** Deixa os exemplos salvos "de uma versão antiga": o texto de cada um é trocado, para ver quem a troca de versão atualiza. */
    function envelhecerExemplos(...ids: string[]): void {
      const salvos = lerLocalStorage() as Salvos;
      salvos.casos = salvos.casos.map((c) => (ids.includes(c.id) ? { ...c, titulo: 'Texto de uma versão antiga' } : c));
      salvos.atletas = salvos.atletas.map((a) =>
        ids.some((id) => CASOS_EXEMPLO.find((c) => c.id === id)?.atletaId === a.id) ? { ...a, nome: 'Nome de uma versão antiga' } : a,
      );
      localStorage.setItem(CHAVE, JSON.stringify(salvos));
    }

    function editarCasoEAtleta(titulo = 'Editado pelo docente', nome = 'Atleta editada'): void {
      const { caso, atleta } = service.buscarPorId(ID)!;
      const { id: _c, atletaId: _a, ...dadosC } = caso;
      const { id: _i, ...dadosA } = atleta;
      service.atualizar(ID, { ...dadosC, titulo }, { ...dadosA, nome });
    }

    it('um exemplo editado fica como o usuário deixou: o caso e o atleta', () => {
      editarCasoEAtleta();

      const reaberto = subirVersao();

      expect(reaberto.buscarPorId(ID)?.caso.titulo).toBe('Editado pelo docente');
      expect(reaberto.buscarPorId(ID)?.atleta.nome).toBe('Atleta editada');
      expect(reaberto.buscarPorId(ID)?.caso.atletaId).toBe(ATLETA_ID);
      expect(reaberto.listar().length).toBe(CASOS_EXEMPLO.length);
    });

    it('editar só a ficha do atleta também conta', () => {
      const { caso, atleta } = service.buscarPorId(ID)!;
      const { id: _c, atletaId: _a, ...dadosC } = caso;
      const { id: _i, ...dadosA } = atleta;
      service.atualizar(ID, dadosC, { ...dadosA, peso: atleta.peso + 5 });

      const reaberto = subirVersao();

      expect(reaberto.buscarPorId(ID)?.atleta.peso).toBe(atleta.peso + 5);
    });

    it('editar só o caso (a ficha igual) também conta', () => {
      const { caso, atleta } = service.buscarPorId(ID)!;
      const { id: _c, atletaId: _a, ...dadosC } = caso;
      const { id: _i, ...dadosA } = atleta;
      service.atualizar(ID, { ...dadosC, descricao: 'Descrição editada' }, dadosA);

      const reaberto = subirVersao();

      expect(reaberto.buscarPorId(ID)?.caso.descricao).toBe('Descrição editada');
    });

    it('editar um caso do usuário não entra na lista de exemplos editados', () => {
      const meu = service.criar(dadosCaso('Meu caso'), dadosAtleta('Minha atleta'));

      service.atualizar(meu.caso.id, dadosCaso('Meu caso editado'), dadosAtleta('Minha atleta'));
      const etapas = service.listarEtapas(meu.caso.id);
      etapas[0] = { ...etapas[0], tolerancia: 7 };
      service.atualizarEtapas(meu.caso.id, etapas);

      expect((lerLocalStorage() as Salvos).exemplosEditados).toEqual([]);
    });

    it('editar só as etapas também conta, e as etapas ficam como o usuário deixou', () => {
      const etapas = service.listarEtapas(ID);
      etapas[1] = { ...etapas[1], faixaAceitavel: { min: 1.6, max: 1.9 }, parametroReferencia: 1.8 };
      expect(service.atualizarEtapas(ID, etapas)).toBeDefined();

      const reaberto = subirVersao();

      expect(reaberto.listarEtapas(ID)).toEqual(etapas);
      expect(reaberto.listarEtapas(ID)[1].faixaAceitavel).toEqual({ min: 1.6, max: 1.9 });
      expect(reaberto.buscarPorId(ID)?.caso.titulo).toBe(CASOS_EXEMPLO[0].titulo);
    });

    it('a edição sobrevive a várias trocas de versão seguidas', () => {
      editarCasoEAtleta();

      subirVersao();
      const reaberto = subirVersao();

      expect(reaberto.buscarPorId(ID)?.caso.titulo).toBe('Editado pelo docente');
    });

    it('guarda no navegador quais exemplos foram editados e quais foram excluídos', () => {
      editarCasoEAtleta();
      service.excluir(OUTRO);

      const salvos = lerLocalStorage() as Salvos;

      expect(salvos.exemplosEditados).toEqual([ID]);
      expect(salvos.exemplosExcluidos).toEqual([OUTRO]);
    });

    it('os exemplos intactos são atualizados normalmente, com caso, ficha e etapas', () => {
      envelhecerExemplos(OUTRO);
      const salvos = lerLocalStorage() as Salvos;
      salvos.etapas = salvos.etapas.map((e) => (e.casoId === OUTRO ? { ...e, tolerancia: 99 } : e));
      localStorage.setItem(CHAVE, JSON.stringify(salvos));

      const reaberto = subirVersao();

      expect(reaberto.buscarPorId(OUTRO)?.caso.titulo).toBe(CASOS_EXEMPLO[1].titulo);
      expect(reaberto.buscarPorId(OUTRO)?.atleta.nome).toBe(ATLETAS_EXEMPLO[1].nome);
      expect(reaberto.listarEtapas(OUTRO)).toEqual(etapasPadrao(OUTRO));
    });

    it('editar um exemplo não impede a atualização dos outros', () => {
      envelhecerExemplos(OUTRO);
      editarCasoEAtleta();

      const reaberto = subirVersao();

      expect(reaberto.buscarPorId(ID)?.caso.titulo).toBe('Editado pelo docente');
      expect(reaberto.buscarPorId(OUTRO)?.caso.titulo).toBe(CASOS_EXEMPLO[1].titulo);
    });

    it('salvar um exemplo sem mudar nada não o marca como editado: ele continua sendo atualizado', () => {
      const { caso, atleta } = service.buscarPorId(ID)!;
      const { id: _c, atletaId: _a, ...dadosC } = caso;
      const { id: _i, ...dadosA } = atleta;
      service.atualizar(ID, dadosC, dadosA);
      service.atualizarEtapas(ID, service.listarEtapas(ID));
      expect((lerLocalStorage() as Salvos).exemplosEditados).toEqual([]);
      envelhecerExemplos(ID);

      const reaberto = subirVersao();

      expect(reaberto.buscarPorId(ID)?.caso.titulo).toBe(CASOS_EXEMPLO[0].titulo);
    });

    it('um exemplo excluído não volta: nem o caso, nem o atleta, nem as etapas', () => {
      service.excluir(ID);

      const reaberto = subirVersao();

      expect(reaberto.buscarPorId(ID)).toBeUndefined();
      expect(reaberto.listarEtapas(ID)).toEqual([]);
      const salvos = lerLocalStorage() as Salvos;
      expect(salvos.atletas.some((a) => a.id === ATLETA_ID)).toBe(false);
      expect(salvos.etapas.some((e) => e.casoId === ID)).toBe(false);
      expect(reaberto.listar().length).toBe(CASOS_EXEMPLO.length - 1);
    });

    it('editar e depois excluir: também não volta, e sai da lista de editados', () => {
      editarCasoEAtleta();
      expect((lerLocalStorage() as Salvos).exemplosEditados).toEqual([ID]);
      service.excluir(ID);
      expect((lerLocalStorage() as Salvos).exemplosEditados).toEqual([]);

      const reaberto = subirVersao();

      expect(reaberto.buscarPorId(ID)).toBeUndefined();
      const salvos = lerLocalStorage() as Salvos;
      expect(salvos.exemplosEditados).toEqual([]);
      expect(salvos.exemplosExcluidos).toEqual([ID]);
    });

    it('excluir um exemplo não segura os outros: eles são atualizados', () => {
      envelhecerExemplos(OUTRO);
      service.excluir(ID);

      expect(subirVersao().buscarPorId(OUTRO)?.caso.titulo).toBe(CASOS_EXEMPLO[1].titulo);
    });

    it('os casos do usuário continuam como estão, junto com exemplos editados e excluídos', () => {
      const meu = service.criar(dadosCaso('Meu caso'), dadosAtleta('Minha atleta'));
      editarCasoEAtleta();
      service.excluir(OUTRO);

      const reaberto = subirVersao();

      expect(reaberto.buscarPorId(meu.caso.id)?.atleta.nome).toBe('Minha atleta');
      expect(reaberto.listarEtapas(meu.caso.id).length).toBe(5);
      expect(reaberto.listar().length).toBe(CASOS_EXEMPLO.length); // 8 - 1 excluído + 1 do usuário
    });

    it('um exemplo editado que deixou de existir nos exemplos atuais continua guardado', () => {
      const salvos = lerLocalStorage() as Salvos;
      const antigo: Caso = { ...CASOS_EXEMPLO[0], id: 'exemplo-caso-99', atletaId: 'exemplo-atleta-99', titulo: 'Editado e já fora dos exemplos' };
      localStorage.setItem(
        CHAVE,
        JSON.stringify({
          ...salvos,
          casos: [...salvos.casos, antigo],
          atletas: [...salvos.atletas, { ...ATLETAS_EXEMPLO[0], id: 'exemplo-atleta-99' }],
          etapas: [...salvos.etapas, ...etapasPadrao('exemplo-caso-99')],
          exemplosEditados: ['exemplo-caso-99'],
        }),
      );

      const reaberto = subirVersao();

      expect(reaberto.buscarPorId('exemplo-caso-99')?.caso.titulo).toBe('Editado e já fora dos exemplos');
      expect(reaberto.listarEtapas('exemplo-caso-99').length).toBe(5);
    });

    describe('resoluções ligadas', () => {
      function resolucoes(): ResolucaoService {
        const storage = new StorageService();
        return new ResolucaoService(storage, new CasoService(storage), new AlimentoService(storage, async () => []));
      }

      it('uma resolução de um exemplo editado continua abrindo, com o caso editado', () => {
        const antes = resolucoes();
        const resolucao = antes.iniciar(ID)!;
        editarCasoEAtleta();

        subirVersao();
        const depois = resolucoes();

        expect(depois.buscar(resolucao.id)?.casoId).toBe(ID);
        expect(new CasoService(new StorageService()).buscarPorId(ID)?.caso.titulo).toBe('Editado pelo docente');
        expect(depois.listar().map((r) => r.id)).toContain(resolucao.id);
      });

      it('uma resolução de um exemplo intacto continua abrindo, com o caso atualizado', () => {
        const resolucao = resolucoes().iniciar(OUTRO)!;
        envelhecerExemplos(OUTRO);

        subirVersao();

        expect(resolucoes().buscar(resolucao.id)?.casoId).toBe(OUTRO);
        expect(new CasoService(new StorageService()).buscarPorId(OUTRO)?.caso.titulo).toBe(CASOS_EXEMPLO[1].titulo);
      });

      it('uma resolução de um exemplo excluído continua guardada, e o caso segue ausente (a tela mostra "Caso excluído")', () => {
        const resolucao = resolucoes().iniciar(ID)!;
        new CasoService(new StorageService()).excluir(ID);

        subirVersao();

        expect(resolucoes().buscar(resolucao.id)).toBeDefined();
        expect(new CasoService(new StorageService()).buscarPorId(ID)).toBeUndefined();
      });
    });

    describe('dados antigos, sem as listas novas', () => {
      function semAsListas(versao: number): void {
        const { exemplosEditados: _e, exemplosExcluidos: _x, ...resto } = lerLocalStorage() as Salvos;
        localStorage.setItem(CHAVE, JSON.stringify({ ...resto, versao }));
      }

      it('na mesma versão: carregam sem quebrar, e as listas começam vazias', () => {
        semAsListas(VERSAO_CASOS_EXEMPLO);

        const reaberto = reabrir();

        expect(reaberto.listar().length).toBe(CASOS_EXEMPLO.length);
        reaberto.excluir(ID);
        expect((lerLocalStorage() as Salvos).exemplosExcluidos).toEqual([ID]);
        expect((lerLocalStorage() as Salvos).exemplosEditados).toEqual([]);
      });

      it('na troca de versão: os exemplos são atualizados e o caso do usuário fica', () => {
        const meu = service.criar(dadosCaso('Meu caso'), dadosAtleta('Minha atleta'));
        envelhecerExemplos(ID);
        semAsListas(VERSAO_CASOS_EXEMPLO - 1);

        const reaberto = reabrir();

        expect(reaberto.buscarPorId(ID)?.caso.titulo).toBe(CASOS_EXEMPLO[0].titulo);
        expect(reaberto.buscarPorId(meu.caso.id)?.caso.titulo).toBe('Meu caso');
        const salvos = lerLocalStorage() as Salvos;
        expect(salvos.versao).toBe(VERSAO_CASOS_EXEMPLO);
        expect(salvos.exemplosEditados).toEqual([]);
        expect(salvos.exemplosExcluidos).toEqual([]);
      });

      it.each([
        ['não é lista', 'texto'],
        ['é um objeto', { a: 1 }],
        ['é null', null],
        ['é um número', 3],
      ])('listas que %s valem como vazias', (_rotulo, lixo) => {
        const salvos = lerLocalStorage() as Salvos;
        localStorage.setItem(CHAVE, JSON.stringify({ ...salvos, exemplosEditados: lixo, exemplosExcluidos: lixo }));

        const reaberto = subirVersao();

        expect(reaberto.listar().length).toBe(CASOS_EXEMPLO.length);
      });

      it('descarta o que não é id de exemplo: números, textos soltos, repetidos e ids de casos do usuário', () => {
        const meu = service.criar(dadosCaso('Meu caso'), dadosAtleta('Minha atleta'));
        const salvos = lerLocalStorage() as Salvos;
        localStorage.setItem(
          CHAVE,
          JSON.stringify({ ...salvos, exemplosEditados: [ID, ID, 7, null, meu.caso.id, 'qualquer coisa'], exemplosExcluidos: [OUTRO, {}, OUTRO] }),
        );

        reabrir().excluir(CASOS_EXEMPLO[2].id); // qualquer gravação regrava as listas já limpas

        const depois = lerLocalStorage() as Salvos;
        expect(depois.exemplosEditados).toEqual([ID]);
        expect(depois.exemplosExcluidos).toEqual([OUTRO, CASOS_EXEMPLO[2].id]);
      });
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

  describe('etapas: carga, listarEtapas e cópias', () => {
    it('a carga inicial grava a versão 2 com as 5 etapas de cada caso de exemplo', () => {
      const noNavegador = lerLocalStorage();

      expect(noNavegador?.versao).toBe(2);
      expect(noNavegador?.etapas.length).toBe(CASOS_EXEMPLO.length * 5);
      for (const caso of CASOS_EXEMPLO) {
        expect(service.listarEtapas(caso.id).map((e) => e.tipo)).toEqual(['TMB', 'GET', 'CHO', 'PTN', 'LIP']);
      }
    });

    it('listarEtapas devolve as etapas do caso na ordem 1 a 5, e vazio para caso que não existe', () => {
      const etapas = service.listarEtapas('exemplo-caso-1');

      expect(etapas.map((e) => e.ordem)).toEqual([1, 2, 3, 4, 5]);
      expect(etapas.every((e) => e.casoId === 'exemplo-caso-1')).toBe(true);
      expect(etapas[1].parametroReferencia).toBe(1.8); // ajuste do caso 1
      expect(service.listarEtapas('inexistente')).toEqual([]);
    });

    it('devolve cópias: alterar o que veio não muda o estado nem as constantes de exemplo', () => {
      const etapas = service.listarEtapas('exemplo-caso-1');
      etapas[0].opcoesAceitaveis!.push('inventada');
      etapas[1].faixaAceitavel!.max = 99;
      etapas[2].tolerancia = 99;

      const denovo = service.listarEtapas('exemplo-caso-1');
      expect(denovo[0].opcoesAceitaveis).toEqual([...EQUACOES_TMB]);
      expect(denovo[1].faixaAceitavel).toEqual({ min: 1.4, max: 2.2 });
      expect(denovo[2].tolerancia).toBe(5);
      expect(ETAPAS_EXEMPLO.find((e) => e.id === 'exemplo-caso-1-etapa-2')?.faixaAceitavel).toEqual({ min: 1.4, max: 2.2 });
    });
  });

  describe('etapas: criar gera as 5 padrão', () => {
    it('o caso novo ganha as 5 etapas padrão, ligadas a ele, e elas persistem', () => {
      const { caso } = service.criar(dadosCaso(), dadosAtleta());

      const etapas = service.listarEtapas(caso.id);
      expect(etapas).toEqual(etapasPadrao(caso.id));
      expect(etapas.length).toBe(5);
      expect(lerLocalStorage()?.etapas.filter((e) => e.casoId === caso.id).length).toBe(5);
      expect(reabrir().listarEtapas(caso.id)).toEqual(etapasPadrao(caso.id));
    });

    it('cada caso tem as suas, com ids diferentes', () => {
      const a = service.criar(dadosCaso('A'), dadosAtleta());
      const b = service.criar(dadosCaso('B'), dadosAtleta());

      expect(service.listarEtapas(a.caso.id).map((e) => e.id)).not.toEqual(service.listarEtapas(b.caso.id).map((e) => e.id));
    });

    it('editar o caso (atualizar) não mexe nas etapas', () => {
      const { caso } = service.criar(dadosCaso(), dadosAtleta());
      const [primeira, ...resto] = service.listarEtapas(caso.id);
      service.atualizarEtapas(caso.id, [{ ...primeira, tolerancia: 8 }, ...resto]);

      service.atualizar(caso.id, dadosCaso('Título novo'), dadosAtleta());

      expect(service.listarEtapas(caso.id)[0].tolerancia).toBe(8);
    });
  });

  describe('etapas: atualizarEtapas', () => {
    const editadas = (casoId: string): EtapaCalculo[] =>
      service.listarEtapas(casoId).map((e) => {
        if (e.tipo === 'TMB') {
          return { ...e, parametroReferencia: 'Harris-Benedict revisada', opcoesAceitaveis: ['Harris-Benedict revisada'], tolerancia: 3 };
        }
        return e.tipo === 'CHO' ? { ...e, parametroReferencia: 7, faixaAceitavel: { min: 5, max: 9 }, criterioReferencia: 'Novo critério.' } : e;
      });

    it('troca os critérios das 5 etapas do caso e persiste', () => {
      const guardadas = service.atualizarEtapas('exemplo-caso-1', editadas('exemplo-caso-1'));

      expect(guardadas?.length).toBe(5);
      const depois = service.listarEtapas('exemplo-caso-1');
      expect(depois[0].parametroReferencia).toBe('Harris-Benedict revisada');
      expect(depois[0].opcoesAceitaveis).toEqual(['Harris-Benedict revisada']);
      expect(depois[0].tolerancia).toBe(3);
      expect(depois[2].parametroReferencia).toBe(7);
      expect(depois[2].faixaAceitavel).toEqual({ min: 5, max: 9 });
      expect(depois[2].criterioReferencia).toBe('Novo critério.');
      expect(reabrir().listarEtapas('exemplo-caso-1')).toEqual(depois);
    });

    it('não mexe nas etapas dos outros casos', () => {
      const outroAntes = service.listarEtapas('exemplo-caso-2');

      service.atualizarEtapas('exemplo-caso-1', editadas('exemplo-caso-1'));

      expect(service.listarEtapas('exemplo-caso-2')).toEqual(outroAntes);
      expect(lerLocalStorage()?.etapas.length).toBe(CASOS_EXEMPLO.length * 5);
    });

    it('aceita as etapas em qualquer ordem no array e guarda na ordem 1 a 5', () => {
      const embaralhadas = editadas('exemplo-caso-1').reverse();

      expect(service.atualizarEtapas('exemplo-caso-1', embaralhadas)?.map((e) => e.ordem)).toEqual([1, 2, 3, 4, 5]);
      expect(service.listarEtapas('exemplo-caso-1').map((e) => e.ordem)).toEqual([1, 2, 3, 4, 5]);
    });

    it('devolve cópias e guarda cópias: mudar o que foi passado ou devolvido depois não altera o estado', () => {
      const entrada = editadas('exemplo-caso-1');
      const devolvidas = service.atualizarEtapas('exemplo-caso-1', entrada)!;

      entrada[0].opcoesAceitaveis!.push('depois');
      devolvidas[2].faixaAceitavel!.min = 0;

      const guardadas = service.listarEtapas('exemplo-caso-1');
      expect(guardadas[0].opcoesAceitaveis).toEqual(['Harris-Benedict revisada']);
      expect(guardadas[2].faixaAceitavel).toEqual({ min: 5, max: 9 });
    });

    describe('recusa o que não são as 5 etapas do caso, sem mudar nada', () => {
      const semMudanca = (resultado: unknown, casoId = 'exemplo-caso-1') => {
        expect(resultado).toBeUndefined();
        expect(service.listarEtapas(casoId)).toEqual(etapasPadrao(casoId));
        expect(lerLocalStorage()?.etapas).toEqual(ETAPAS_EXEMPLO);
      };

      it('caso que não existe, com 5 etapas ou com lista vazia', () => {
        semMudanca(service.atualizarEtapas('inexistente', etapasPadrao('inexistente')));
        semMudanca(service.atualizarEtapas('inexistente', []));
      });

      it('menos de 5 etapas', () => {
        semMudanca(service.atualizarEtapas('exemplo-caso-1', editadas('exemplo-caso-1').slice(0, 4)));
      });

      it('mais de 5 etapas', () => {
        const seis = [...editadas('exemplo-caso-1'), { ...etapasPadrao('exemplo-caso-1')[0], id: 'sobrando' }];
        semMudanca(service.atualizarEtapas('exemplo-caso-1', seis));
      });

      it('lista vazia', () => {
        semMudanca(service.atualizarEtapas('exemplo-caso-1', []));
      });

      it('etapas de outro caso', () => {
        semMudanca(service.atualizarEtapas('exemplo-caso-1', service.listarEtapas('exemplo-caso-2')));
      });

      it('id que o caso não tem, ou repetido', () => {
        const idAlheio = editadas('exemplo-caso-1').map((e, i) => (i === 0 ? { ...e, id: 'outro-id' } : e));
        const repetido = editadas('exemplo-caso-1').map((e, i) => (i === 1 ? { ...editadas('exemplo-caso-1')[0] } : e));
        semMudanca(service.atualizarEtapas('exemplo-caso-1', idAlheio));
        semMudanca(service.atualizarEtapas('exemplo-caso-1', repetido));
      });

      it('casoId, tipo ou ordem trocados', () => {
        for (const mudanca of [{ casoId: 'exemplo-caso-2' }, { tipo: 'LIP' as const }, { ordem: 9 }]) {
          const alterada = editadas('exemplo-caso-1').map((e, i) => (i === 1 ? { ...e, ...mudanca } : e));
          semMudanca(service.atualizarEtapas('exemplo-caso-1', alterada));
        }
      });

      it('critério com a forma errada: TMB sem opções, faixa torta ou min > max, referência do tipo errado, tolerância zero', () => {
        for (const [i, mudanca] of [
          [0, { opcoesAceitaveis: [] }],
          [0, { opcoesAceitaveis: undefined }],
          [0, { opcoesAceitaveis: ['Mifflin-St Jeor', 3] }],
          [0, { opcoesAceitaveis: 'Mifflin-St Jeor' }],
          [0, { parametroReferencia: 1.5 }],
          [1, { faixaAceitavel: undefined }],
          [1, { faixaAceitavel: { min: 1.4 } }],
          [1, { faixaAceitavel: { min: '1,4', max: 2.2 } }],
          [1, { faixaAceitavel: { min: 3, max: 2 } }],
          [1, { faixaAceitavel: 'x' }],
          [2, { parametroReferencia: 'seis' }],
          [3, { tolerancia: 0 }],
          [3, { tolerancia: -5 }],
        ] as [number, Partial<EtapaCalculo>][]) {
          const torta = editadas('exemplo-caso-1').map((e, j) => (j === i ? ({ ...e, ...mudanca } as EtapaCalculo) : e));
          semMudanca(service.atualizarEtapas('exemplo-caso-1', torta));
        }
      });

      it('etapa malformada (tolerância não numérica)', () => {
        const torta = editadas('exemplo-caso-1').map((e, i) => (i === 2 ? { ...e, tolerancia: NaN } : e));
        semMudanca(service.atualizarEtapas('exemplo-caso-1', torta));
      });
    });
  });

  describe('etapas: excluir apaga em cascata', () => {
    it('excluir o caso apaga as etapas dele e só as dele, também no navegador', () => {
      const { caso } = service.criar(dadosCaso(), dadosAtleta());
      const totalComNovo = CASOS_EXEMPLO.length * 5 + 5;
      expect(lerLocalStorage()?.etapas.length).toBe(totalComNovo);

      service.excluir(caso.id);

      expect(service.listarEtapas(caso.id)).toEqual([]);
      expect(lerLocalStorage()?.etapas.length).toBe(CASOS_EXEMPLO.length * 5);
      expect(lerLocalStorage()?.etapas.some((e) => e.casoId === caso.id)).toBe(false);
      expect(reabrir().listarEtapas(caso.id)).toEqual([]);
      expect(service.listarEtapas('exemplo-caso-1').length).toBe(5);
    });

    it('excluir um exemplo também apaga as etapas dele', () => {
      service.excluir('exemplo-caso-3');

      expect(lerLocalStorage()?.etapas.filter((e) => e.casoId === 'exemplo-caso-3')).toEqual([]);
      expect(lerLocalStorage()?.etapas.length).toBe((CASOS_EXEMPLO.length - 1) * 5);
    });

    it('excluir um caso que não existe não mexe nas etapas', () => {
      service.excluir('inexistente');

      expect(lerLocalStorage()?.etapas.length).toBe(CASOS_EXEMPLO.length * 5);
    });
  });

  describe('normalização dos dados salvos na carga', () => {
    /** Um caso criado pelo usuário no formato da versão 1: sem toleranciaDieta e sem etapas. */
    const casoV1 = (id: string, titulo: string): Omit<Caso, 'toleranciaDieta'> => ({
      id,
      atletaId: `atleta-${id}`,
      titulo,
      modalidade: 'Remo',
      nivel: 'Intermediário',
      competencia: 'Gasto energético total',
      descricao: 'Descrição.',
      comentarioReferencia: 'Referência.',
    });
    const atletaV1 = (id: string): Atleta => ({ ...dadosAtleta('Atleta do usuário'), id: `atleta-${id}` });
    const gravar = (dados: unknown): void => localStorage.setItem(CHAVE, JSON.stringify(dados));

    it('dado da versão 1 (sem etapas e sem tolerância): carrega com os padrões e guarda o caso do usuário', () => {
      gravar({
        versao: 1,
        casos: [
          { ...casoV1('exemplo-caso-1', 'Exemplo da versão 1'), atletaId: 'exemplo-atleta-1' },
          casoV1('caso-do-usuario', 'Meu caso antigo'),
        ],
        atletas: [{ ...ATLETAS_EXEMPLO[0] }, atletaV1('caso-do-usuario')],
      });

      const reaberto = reabrir();

      // o caso do usuário continua, com a ficha, a tolerância padrão e as 5 etapas padrão
      const dele = reaberto.buscarPorId('caso-do-usuario');
      expect(dele?.caso.titulo).toBe('Meu caso antigo');
      expect(dele?.atleta.nome).toBe('Atleta do usuário');
      expect(dele?.caso.toleranciaDieta).toBe(TOLERANCIA_DIETA_PADRAO);
      expect(reaberto.listarEtapas('caso-do-usuario')).toEqual(etapasPadrao('caso-do-usuario'));
      // os exemplos vêm da versão atual, com as etapas ajustadas deles
      expect(reaberto.listar().length).toBe(CASOS_EXEMPLO.length + 1);
      expect(reaberto.buscarPorId('exemplo-caso-1')?.caso.titulo).toBe(CASOS_EXEMPLO[0].titulo);
      expect(reaberto.listarEtapas('exemplo-caso-1')[1].parametroReferencia).toBe(1.8);
      for (const caso of reaberto.listar()) {
        expect(caso.toleranciaDieta, caso.id).toBeGreaterThanOrEqual(0);
        expect(reaberto.listarEtapas(caso.id).length, caso.id).toBe(5);
      }
      // e já ficou gravado na versão atual
      const noNavegador = lerLocalStorage();
      expect(noNavegador?.versao).toBe(VERSAO_CASOS_EXEMPLO);
      expect(noNavegador?.etapas.length).toBe((CASOS_EXEMPLO.length + 1) * 5);
      expect(noNavegador?.casos.find((c) => c.id === 'caso-do-usuario')?.toleranciaDieta).toBe(TOLERANCIA_DIETA_PADRAO);
    });

    it('mantém a tolerância que o caso do usuário já tinha', () => {
      gravar({
        versao: 1,
        casos: [{ ...casoV1('c1', 'Com tolerância'), toleranciaDieta: 15 }, { ...casoV1('c2', 'Tolerância zero'), toleranciaDieta: 0 }],
        atletas: [atletaV1('c1'), atletaV1('c2')],
      });

      const reaberto = reabrir();

      expect(reaberto.buscarPorId('c1')?.caso.toleranciaDieta).toBe(15);
      expect(reaberto.buscarPorId('c2')?.caso.toleranciaDieta).toBe(0);
    });

    it('tolerância inválida (nula, texto, negativa) vira o padrão', () => {
      gravar({
        versao: VERSAO_CASOS_EXEMPLO,
        casos: [
          { ...casoV1('c1', 'Nula'), toleranciaDieta: null },
          { ...casoV1('c2', 'Texto'), toleranciaDieta: 'dez' },
          { ...casoV1('c3', 'Negativa'), toleranciaDieta: -5 },
        ],
        atletas: [atletaV1('c1'), atletaV1('c2'), atletaV1('c3')],
        etapas: [],
      });

      const reaberto = reabrir();

      for (const id of ['c1', 'c2', 'c3']) {
        expect(reaberto.buscarPorId(id)?.caso.toleranciaDieta, id).toBe(TOLERANCIA_DIETA_PADRAO);
      }
    });

    it('já na versão atual, mas sem a lista de etapas: preenche com as padrão (e as ajustadas dos exemplos) e regrava', () => {
      const salvos = lerLocalStorage() as Salvos;
      localStorage.setItem(CHAVE, JSON.stringify({ versao: salvos.versao, casos: salvos.casos, atletas: salvos.atletas }));

      const reaberto = reabrir();

      expect(reaberto.listarEtapas('exemplo-caso-7')[2].parametroReferencia).toBe(8);
      expect(reaberto.listar().every((c) => reaberto.listarEtapas(c.id).length === 5)).toBe(true);
      expect(lerLocalStorage()?.etapas.length).toBe(CASOS_EXEMPLO.length * 5);
    });

    it('lista de etapas que não é lista, ou com itens tortos, não quebra', () => {
      const salvos = lerLocalStorage() as Salvos;
      for (const etapas of ['texto', 42, null, {}, [null, 3, 'x', { id: 1 }, { casoId: 'exemplo-caso-1' }]]) {
        gravar({ versao: salvos.versao, casos: salvos.casos, atletas: salvos.atletas, etapas });

        const reaberto = reabrir();

        expect(reaberto.listar().length).toBe(CASOS_EXEMPLO.length);
        expect(reaberto.listarEtapas('exemplo-caso-1')).toEqual(etapasPadrao('exemplo-caso-1'));
      }
    });

    describe('forma do critério (faixaAceitavel e opcoesAceitaveis)', () => {
      /** Grava os dados com a etapa `indice` do caso 1 alterada, reabre o serviço e devolve as etapas dele. */
      function reabrirComEtapaAlterada(indice: number, mudanca: Record<string, unknown>) {
        const salvos = lerLocalStorage() as Salvos;
        const doCaso1 = salvos.etapas.filter((e) => e.casoId === 'exemplo-caso-1');
        const alvo = doCaso1[indice].id;
        gravar({ ...salvos, etapas: salvos.etapas.map((e) => (e.id === alvo ? { ...e, ...mudanca } : e)) });
        return reabrir();
      }

      const formasInvalidas: [string, number, Record<string, unknown>][] = [
        ['TMB sem a lista de opções', 0, { opcoesAceitaveis: undefined }],
        ['TMB com a lista de opções vazia', 0, { opcoesAceitaveis: [] }],
        ['TMB com opções que não são texto', 0, { opcoesAceitaveis: ['Mifflin-St Jeor', 7] }],
        ['TMB com opções que não são lista', 0, { opcoesAceitaveis: 'Mifflin-St Jeor' }],
        ['TMB com referência numérica', 0, { parametroReferencia: 1.7 }],
        ['GET sem faixa', 1, { faixaAceitavel: undefined }],
        ['GET com faixa sem max', 1, { faixaAceitavel: { min: 1.4 } }],
        ['GET com faixa em texto', 1, { faixaAceitavel: { min: '1,4', max: '2,2' } }],
        ['GET com faixa nula', 1, { faixaAceitavel: null }],
        ['CHO com min maior que max', 2, { faixaAceitavel: { min: 10, max: 4 } }],
        ['PTN com referência em texto', 3, { parametroReferencia: 'um e meio' }],
        ['LIP com tolerância zero', 4, { tolerancia: 0 }],
        ['LIP com tolerância negativa', 4, { tolerancia: -2 }],
      ];

      for (const [nome, indice, mudanca] of formasInvalidas) {
        it(`${nome}: as 5 etapas do caso voltam ao padrão, sem quebrar, e o resto fica`, () => {
          const reaberto = reabrirComEtapaAlterada(indice, mudanca);

          expect(reaberto.listarEtapas('exemplo-caso-1')).toEqual(etapasPadrao('exemplo-caso-1'));
          expect(reaberto.listarEtapas('exemplo-caso-2')).toEqual(etapasPadrao('exemplo-caso-2'));
          expect(reaberto.listar().length).toBe(CASOS_EXEMPLO.length);
          expect(lerLocalStorage()?.etapas.find((e) => e.casoId === 'exemplo-caso-1' && e.ordem === indice + 1)).toEqual(
            etapasPadrao('exemplo-caso-1')[indice],
          );
        });
      }

      it('faixa com min igual a max é uma forma válida e é mantida', () => {
        const reaberto = reabrirComEtapaAlterada(1, { faixaAceitavel: { min: 1.7, max: 1.7 } });

        expect(reaberto.listarEtapas('exemplo-caso-1')[1].faixaAceitavel).toEqual({ min: 1.7, max: 1.7 });
      });

      it('só o caso com a etapa torta volta ao padrão: um caso do usuário editado ao lado é mantido', () => {
        const { caso } = service.criar(dadosCaso('Meu caso'), dadosAtleta());
        const [primeira, ...resto] = service.listarEtapas(caso.id);
        service.atualizarEtapas(caso.id, [{ ...primeira, tolerancia: 8 }, ...resto]);

        const reaberto = reabrirComEtapaAlterada(1, { faixaAceitavel: { min: 3, max: 2 } });

        expect(reaberto.listarEtapas('exemplo-caso-1')).toEqual(etapasPadrao('exemplo-caso-1'));
        expect(reaberto.listarEtapas(caso.id)[0].tolerancia).toBe(8);
      });
    });

    it('conjunto incompleto de um caso é refeito; etapa de caso que não existe é descartada; conjunto completo editado é mantido', () => {
      const salvos = lerLocalStorage() as Salvos;
      const editadasCaso2 = salvos.etapas.filter((e) => e.casoId === 'exemplo-caso-2').map((e) => (e.tipo === 'CHO' ? { ...e, parametroReferencia: 7.5 } : e));
      const incompletaCaso1 = salvos.etapas.filter((e) => e.casoId === 'exemplo-caso-1').slice(0, 3);
      const outros = salvos.etapas.filter((e) => e.casoId !== 'exemplo-caso-1' && e.casoId !== 'exemplo-caso-2');
      const orfas = etapasPadrao('caso-que-nao-existe');
      gravar({ ...salvos, etapas: [...incompletaCaso1, ...editadasCaso2, ...outros, ...orfas] });

      const reaberto = reabrir();

      expect(reaberto.listarEtapas('exemplo-caso-1')).toEqual(etapasPadrao('exemplo-caso-1'));
      expect(reaberto.listarEtapas('exemplo-caso-2')[2].parametroReferencia).toBe(7.5);
      expect(reaberto.listarEtapas('caso-que-nao-existe')).toEqual([]);
      expect(lerLocalStorage()?.etapas.length).toBe(CASOS_EXEMPLO.length * 5);
    });

    it('etapas editadas de um caso do usuário sobrevivem à troca de versão', () => {
      const { caso } = service.criar(dadosCaso('Meu caso'), dadosAtleta());
      const [primeira, ...resto] = service.listarEtapas(caso.id);
      service.atualizarEtapas(caso.id, [{ ...primeira, tolerancia: 8 }, ...resto]);
      const salvos = lerLocalStorage() as Salvos;
      gravar({ ...salvos, versao: VERSAO_CASOS_EXEMPLO - 1 });

      const reaberto = reabrir();

      expect(reaberto.listarEtapas(caso.id)[0].tolerancia).toBe(8);
      expect(reaberto.buscarPorId(caso.id)?.caso.toleranciaDieta).toBe(10);
    });

    it('dado já normalizado carrega igual e não é regravado à toa', () => {
      const antes = localStorage.getItem(CHAVE);
      const setItem = vi.spyOn(Storage.prototype, 'setItem');

      reabrir();

      expect(setItem).not.toHaveBeenCalled();
      expect(localStorage.getItem(CHAVE)).toBe(antes);
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
