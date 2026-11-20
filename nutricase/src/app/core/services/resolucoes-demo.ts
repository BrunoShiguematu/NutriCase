// TEMPORÁRIO, só para a entrega do Projeto Integrador: 5 tentativas já submetidas, para quem abrir o site pela primeira
// vez (sem nada salvo) ver "Minhas resoluções" e o Dashboard preenchidos. Apague este arquivo e o uso dele em
// `ResolucaoService.carregar` depois da entrega.
//
// Os dados saíram do script de demonstração do Atalaia (feito pela interface, então a correção é a real) sobre os
// casos de exemplo 1 a 5. Cada tentativa guarda "há quantos dias" e a hora local em vez de uma data fixa, e as datas
// são montadas a partir de hoje no primeiro acesso: assim a ofensiva (hoje, ontem e anteontem = 3 dias) e os períodos
// de 7 e 30 dias valem no dia em que a pessoa abrir.

import { etapasPadrao } from '../data/casos-exemplo';
import { ItemRefeicao, Refeicao, Resolucao, RespostaEtapa } from '../models';
import { AvaliacaoEtapa } from '../avaliacao/avaliar-etapas';

interface TentativaDemo {
  id: string;
  casoId: string;
  justificativa: string;
  /** 0 = hoje, 1 = ontem... */
  diasAtras: number;
  /** Hora local ("HH:mm:ss.SSS") em que a tentativa começou e em que foi submetida. */
  inicio: string;
  submissao: string;
  respostas: Omit<RespostaEtapa, 'resolucaoId'>[];
  refeicoes: Omit<Refeicao, 'resolucaoId'>[];
  itens: ItemRefeicao[];
  dietaForaDasMetas: boolean;
  avaliacoes: AvaliacaoEtapa[];
}

const TENTATIVAS_DEMO: readonly TentativaDemo[] = [
  {
    id: 'resolucao-mwmeq89q-8dm2tl',
    casoId: 'exemplo-caso-1',
    justificativa: 'Mifflin-St Jeor por ser a equação de referência para atletas; fator 1,8 pelo volume de treino de maratona; metas em g/kg pela carga da base.',
    diasAtras: 0,
    inicio: '14:40:39.134',
    submissao: '14:41:39.390',
    respostas: [
      { id: 'resposta-mwmeqc2u-8m9od5', etapaId: 'exemplo-caso-1-etapa-1', parametro: 'Mifflin-St Jeor', valor: 1671.25, classificacao: 'correta' },
      { id: 'resposta-mwmeqdsz-9sx87s', etapaId: 'exemplo-caso-1-etapa-2', parametro: 1.8, valor: 3008.25, classificacao: 'correta' },
      { id: 'resposta-mwmeqfjb-6ldpf0', etapaId: 'exemplo-caso-1-etapa-3', parametro: 6, valor: 420, classificacao: 'correta' },
      { id: 'resposta-mwmeqhal-lbc3dz', etapaId: 'exemplo-caso-1-etapa-4', parametro: 1.6, valor: 112, classificacao: 'correta' },
      { id: 'resposta-mwmeqj0y-26punm', etapaId: 'exemplo-caso-1-etapa-5', parametro: 1, valor: 70, classificacao: 'correta' },
    ],
    refeicoes: [
      { id: 'refeicao-mwmeqmfo-pa5n5i', nome: 'Café da manhã', horario: '07:00', marcador: 'nenhum' },
      { id: 'refeicao-mwmeqo7s-puzqx3', nome: 'Almoço', horario: '12:30', marcador: 'nenhum' },
    ],
    itens: [
      { id: 'item-mwmeqr2j-rs71uf', refeicaoId: 'refeicao-mwmeqmfo-pa5n5i', alimentoId: 'taco-007', quantidadeGramas: 80 },
      { id: 'item-mwmeqtf3-8jhzma', refeicaoId: 'refeicao-mwmeqmfo-pa5n5i', alimentoId: 'taco-053', quantidadeGramas: 200 },
      { id: 'item-mwmeqvu5-moyvuw', refeicaoId: 'refeicao-mwmeqmfo-pa5n5i', alimentoId: 'taco-488', quantidadeGramas: 200 },
      { id: 'item-mwmeqy7e-7r13pd', refeicaoId: 'refeicao-mwmeqo7s-puzqx3', alimentoId: 'taco-003', quantidadeGramas: 800 },
      { id: 'item-mwmer0kx-tqowdw', refeicaoId: 'refeicao-mwmeqo7s-puzqx3', alimentoId: 'taco-561', quantidadeGramas: 10 },
      { id: 'item-mwmer2z3-st42bf', refeicaoId: 'refeicao-mwmeqo7s-puzqx3', alimentoId: 'taco-410', quantidadeGramas: 110 },
      { id: 'item-mwmer5d8-v1sr2h', refeicaoId: 'refeicao-mwmeqo7s-puzqx3', alimentoId: 'taco-260', quantidadeGramas: 35 },
      { id: 'item-mwmer7rq-r3ylqy', refeicaoId: 'refeicao-mwmeqo7s-puzqx3', alimentoId: 'taco-091', quantidadeGramas: 310 },
    ],
    dietaForaDasMetas: false,
    avaliacoes: [
      {
        etapaId: 'exemplo-caso-1-etapa-1',
        tipo: 'TMB',
        ordem: 1,
        respondida: true,
        valorEsperado: 1671.25,
        classificacao: 'correta',
        motivo: 'O parâmetro e o valor conferem com a referência do caso.',
      },
      {
        etapaId: 'exemplo-caso-1-etapa-2',
        tipo: 'GET',
        ordem: 2,
        respondida: true,
        valorEsperado: 3008.25,
        classificacao: 'correta',
        motivo: 'O parâmetro e o valor conferem com a referência do caso.',
      },
      {
        etapaId: 'exemplo-caso-1-etapa-3',
        tipo: 'CHO',
        ordem: 3,
        respondida: true,
        valorEsperado: 420,
        classificacao: 'correta',
        motivo: 'O parâmetro e o valor conferem com a referência do caso.',
      },
      {
        etapaId: 'exemplo-caso-1-etapa-4',
        tipo: 'PTN',
        ordem: 4,
        respondida: true,
        valorEsperado: 112,
        classificacao: 'correta',
        motivo: 'O parâmetro e o valor conferem com a referência do caso.',
      },
      {
        etapaId: 'exemplo-caso-1-etapa-5',
        tipo: 'LIP',
        ordem: 5,
        respondida: true,
        valorEsperado: 70,
        classificacao: 'correta',
        motivo: 'O parâmetro e o valor conferem com a referência do caso.',
      },
    ],
  },
  {
    id: 'resolucao-mwmerq8x-kvgbwv',
    casoId: 'exemplo-caso-2',
    justificativa: 'Mifflin-St Jeor como referência; fator 1,9 para a carga da pré-temporada; carboidrato alto para sustentar os treinos.',
    diasAtras: 1,
    inicio: '14:41:49.089',
    submissao: '14:42:41.310',
    respostas: [
      { id: 'resposta-mwmeru36-0t4f8m', etapaId: 'exemplo-caso-2-etapa-1', parametro: 'Mifflin-St Jeor', valor: 1747.5, classificacao: 'correta' },
      { id: 'resposta-mwmervul-wjy6c1', etapaId: 'exemplo-caso-2-etapa-2', parametro: 1.9, valor: 3320.25, classificacao: 'correta' },
      { id: 'resposta-mwmerxld-9u183a', etapaId: 'exemplo-caso-2-etapa-3', parametro: 6, valor: 444, classificacao: 'correta' },
      { id: 'resposta-mwmerzc6-20cay2', etapaId: 'exemplo-caso-2-etapa-4', parametro: 1.6, valor: 118.4, classificacao: 'correta' },
      { id: 'resposta-mwmes127-u6lmac', etapaId: 'exemplo-caso-2-etapa-5', parametro: 1, valor: 74, classificacao: 'correta' },
    ],
    refeicoes: [
      { id: 'refeicao-mwmes48q-ud476n', nome: 'Café da manhã', horario: '07:00', marcador: 'nenhum' },
      { id: 'refeicao-mwmes61x-4ojxg8', nome: 'Almoço', horario: '12:30', marcador: 'nenhum' },
    ],
    itens: [
      { id: 'item-mwmes8nu-jp8ia0', refeicaoId: 'refeicao-mwmes48q-ud476n', alimentoId: 'taco-007', quantidadeGramas: 80 },
      { id: 'item-mwmesb0e-cnl4o9', refeicaoId: 'refeicao-mwmes48q-ud476n', alimentoId: 'taco-053', quantidadeGramas: 200 },
      { id: 'item-mwmesddh-mzv5r5', refeicaoId: 'refeicao-mwmes48q-ud476n', alimentoId: 'taco-488', quantidadeGramas: 200 },
      { id: 'item-mwmesfri-vveiwl', refeicaoId: 'refeicao-mwmes61x-4ojxg8', alimentoId: 'taco-003', quantidadeGramas: 800 },
      { id: 'item-mwmesi62-c52tv4', refeicaoId: 'refeicao-mwmes61x-4ojxg8', alimentoId: 'taco-561', quantidadeGramas: 130 },
      { id: 'item-mwmeskjj-0mlw50', refeicaoId: 'refeicao-mwmes61x-4ojxg8', alimentoId: 'taco-410', quantidadeGramas: 110 },
      { id: 'item-mwmesmxh-syd19m', refeicaoId: 'refeicao-mwmes61x-4ojxg8', alimentoId: 'taco-260', quantidadeGramas: 40 },
      { id: 'item-mwmespc8-7ur8ts', refeicaoId: 'refeicao-mwmes61x-4ojxg8', alimentoId: 'taco-091', quantidadeGramas: 400 },
    ],
    dietaForaDasMetas: false,
    avaliacoes: [
      {
        etapaId: 'exemplo-caso-2-etapa-1',
        tipo: 'TMB',
        ordem: 1,
        respondida: true,
        valorEsperado: 1747.5,
        classificacao: 'correta',
        motivo: 'O parâmetro e o valor conferem com a referência do caso.',
      },
      {
        etapaId: 'exemplo-caso-2-etapa-2',
        tipo: 'GET',
        ordem: 2,
        respondida: true,
        valorEsperado: 3320.25,
        classificacao: 'correta',
        motivo: 'O parâmetro e o valor conferem com a referência do caso.',
      },
      {
        etapaId: 'exemplo-caso-2-etapa-3',
        tipo: 'CHO',
        ordem: 3,
        respondida: true,
        valorEsperado: 444,
        classificacao: 'correta',
        motivo: 'O parâmetro e o valor conferem com a referência do caso.',
      },
      {
        etapaId: 'exemplo-caso-2-etapa-4',
        tipo: 'PTN',
        ordem: 4,
        respondida: true,
        valorEsperado: 118.4,
        classificacao: 'correta',
        motivo: 'O parâmetro e o valor conferem com a referência do caso.',
      },
      {
        etapaId: 'exemplo-caso-2-etapa-5',
        tipo: 'LIP',
        ordem: 5,
        respondida: true,
        valorEsperado: 74,
        classificacao: 'correta',
        motivo: 'O parâmetro e o valor conferem com a referência do caso.',
      },
    ],
  },
  {
    id: 'resolucao-mwmet3lx-nughi8',
    casoId: 'exemplo-caso-3',
    justificativa: 'Cunningham por considerar a massa magra da atleta; fator 1,8 e carboidrato 5 g/kg por estar em fase de ajuste de carga.',
    diasAtras: 2,
    inicio: '14:42:53.061',
    submissao: '14:43:24.528',
    respostas: [
      { id: 'resposta-mwmet7fc-hnnrip', etapaId: 'exemplo-caso-3-etapa-1', parametro: 'Cunningham', valor: 1591.2, classificacao: 'divergente' },
      { id: 'resposta-mwmet95i-g9o7rk', etapaId: 'exemplo-caso-3-etapa-2', parametro: 1.8, valor: 2864.16, classificacao: 'divergente' },
      { id: 'resposta-mwmetaw2-agjexk', etapaId: 'exemplo-caso-3-etapa-3', parametro: 5, valor: 310, classificacao: 'divergente' },
      { id: 'resposta-mwmetclq-xjk7na', etapaId: 'exemplo-caso-3-etapa-4', parametro: 1.6, valor: 99.2, classificacao: 'correta' },
      { id: 'resposta-mwmetebg-4k3hmn', etapaId: 'exemplo-caso-3-etapa-5', parametro: 1, valor: 62, classificacao: 'correta' },
    ],
    refeicoes: [
      { id: 'refeicao-mwmethj8-ucxs3h', nome: 'Almoço', horario: '12:30', marcador: 'nenhum' },
    ],
    itens: [
      { id: 'item-mwmetk6g-9jdnw5', refeicaoId: 'refeicao-mwmethj8-ucxs3h', alimentoId: 'taco-003', quantidadeGramas: 150 },
      { id: 'item-mwmetmlo-vsd16u', refeicaoId: 'refeicao-mwmethj8-ucxs3h', alimentoId: 'taco-410', quantidadeGramas: 100 },
    ],
    dietaForaDasMetas: true,
    avaliacoes: [
      {
        etapaId: 'exemplo-caso-3-etapa-1',
        tipo: 'TMB',
        ordem: 1,
        respondida: true,
        valorEsperado: 1591.2,
        classificacao: 'divergente',
        motivo: 'O parâmetro difere da referência do caso (Mifflin-St Jeor), mas está dentro do aceitável, e o valor confere.',
      },
      {
        etapaId: 'exemplo-caso-3-etapa-2',
        tipo: 'GET',
        ordem: 2,
        respondida: true,
        valorEsperado: 2864.1600000000003,
        classificacao: 'divergente',
        motivo: 'O parâmetro difere da referência do caso (2), mas está dentro do aceitável, e o valor confere.',
      },
      {
        etapaId: 'exemplo-caso-3-etapa-3',
        tipo: 'CHO',
        ordem: 3,
        respondida: true,
        valorEsperado: 310,
        classificacao: 'divergente',
        motivo: 'O parâmetro difere da referência do caso (6), mas está dentro do aceitável, e o valor confere.',
      },
      {
        etapaId: 'exemplo-caso-3-etapa-4',
        tipo: 'PTN',
        ordem: 4,
        respondida: true,
        valorEsperado: 99.2,
        classificacao: 'correta',
        motivo: 'O parâmetro e o valor conferem com a referência do caso.',
      },
      {
        etapaId: 'exemplo-caso-3-etapa-5',
        tipo: 'LIP',
        ordem: 5,
        respondida: true,
        valorEsperado: 62,
        classificacao: 'correta',
        motivo: 'O parâmetro e o valor conferem com a referência do caso.',
      },
    ],
  },
  {
    id: 'resolucao-mwmetz33-x2iklc',
    casoId: 'exemplo-caso-4',
    justificativa: 'Harris-Benedict revisada pela massa corporal; fator 1,9 e carboidrato 6 g/kg para sustentar o ganho de massa.',
    diasAtras: 5,
    inicio: '14:43:33.855',
    submissao: '14:44:29.236',
    respostas: [
      {
        id: 'resposta-mwmeu2v0-2bo1zd',
        etapaId: 'exemplo-caso-4-etapa-1',
        parametro: 'Harris-Benedict revisada',
        valor: 1855.223,
        classificacao: 'divergente',
      },
      { id: 'resposta-mwmeu4kl-z7o1tu', etapaId: 'exemplo-caso-4-etapa-2', parametro: 1.9, valor: 3524.92, classificacao: 'divergente' },
      { id: 'resposta-mwmeu6ae-kphhlg', etapaId: 'exemplo-caso-4-etapa-3', parametro: 6, valor: 468, classificacao: 'divergente' },
      { id: 'resposta-mwmeu80u-agzqgh', etapaId: 'exemplo-caso-4-etapa-4', parametro: 1.6, valor: 124.8, classificacao: 'correta' },
      { id: 'resposta-mwmeu9r8-7a6nqc', etapaId: 'exemplo-caso-4-etapa-5', parametro: 1, valor: 78, classificacao: 'correta' },
    ],
    refeicoes: [
      { id: 'refeicao-mwmeucz7-ybzuuf', nome: 'Café da manhã', horario: '07:00', marcador: 'nenhum' },
      { id: 'refeicao-mwmeuerh-6srk37', nome: 'Almoço', horario: '12:30', marcador: 'nenhum' },
    ],
    itens: [
      { id: 'item-mwmeuhcx-yycfei', refeicaoId: 'refeicao-mwmeucz7-ybzuuf', alimentoId: 'taco-007', quantidadeGramas: 80 },
      { id: 'item-mwmeujr1-8403l1', refeicaoId: 'refeicao-mwmeucz7-ybzuuf', alimentoId: 'taco-053', quantidadeGramas: 200 },
      { id: 'item-mwmeum4l-hd6yxg', refeicaoId: 'refeicao-mwmeucz7-ybzuuf', alimentoId: 'taco-488', quantidadeGramas: 200 },
      { id: 'item-mwmeuoha-imj0lt', refeicaoId: 'refeicao-mwmeuerh-6srk37', alimentoId: 'taco-003', quantidadeGramas: 800 },
      { id: 'item-mwmeuqva-qe0eaa', refeicaoId: 'refeicao-mwmeuerh-6srk37', alimentoId: 'taco-561', quantidadeGramas: 300 },
      { id: 'item-mwmeutb9-clbxv2', refeicaoId: 'refeicao-mwmeuerh-6srk37', alimentoId: 'taco-410', quantidadeGramas: 100 },
      { id: 'item-mwmeuvpt-s5sdgg', refeicaoId: 'refeicao-mwmeuerh-6srk37', alimentoId: 'taco-260', quantidadeGramas: 40 },
      { id: 'item-mwmeuy4u-etglpp', refeicaoId: 'refeicao-mwmeuerh-6srk37', alimentoId: 'taco-091', quantidadeGramas: 400 },
      { id: 'item-mwmev0jk-i437v9', refeicaoId: 'refeicao-mwmeuerh-6srk37', alimentoId: 'taco-507', quantidadeGramas: 5 },
    ],
    dietaForaDasMetas: false,
    avaliacoes: [
      {
        etapaId: 'exemplo-caso-4-etapa-1',
        tipo: 'TMB',
        ordem: 1,
        respondida: true,
        valorEsperado: 1855.2230000000002,
        classificacao: 'divergente',
        motivo: 'O parâmetro difere da referência do caso (Mifflin-St Jeor), mas está dentro do aceitável, e o valor confere.',
      },
      {
        etapaId: 'exemplo-caso-4-etapa-2',
        tipo: 'GET',
        ordem: 2,
        respondida: true,
        valorEsperado: 3524.9237,
        classificacao: 'divergente',
        motivo: 'O parâmetro difere da referência do caso (1,7), mas está dentro do aceitável, e o valor confere.',
      },
      {
        etapaId: 'exemplo-caso-4-etapa-3',
        tipo: 'CHO',
        ordem: 3,
        respondida: true,
        valorEsperado: 468,
        classificacao: 'divergente',
        motivo: 'O parâmetro difere da referência do caso (5), mas está dentro do aceitável, e o valor confere.',
      },
      {
        etapaId: 'exemplo-caso-4-etapa-4',
        tipo: 'PTN',
        ordem: 4,
        respondida: true,
        valorEsperado: 124.80000000000001,
        classificacao: 'correta',
        motivo: 'O parâmetro e o valor conferem com a referência do caso.',
      },
      {
        etapaId: 'exemplo-caso-4-etapa-5',
        tipo: 'LIP',
        ordem: 5,
        respondida: true,
        valorEsperado: 78,
        classificacao: 'correta',
        motivo: 'O parâmetro e o valor conferem com a referência do caso.',
      },
    ],
  },
  {
    id: 'resolucao-mwmewniq-8khgs4',
    casoId: 'exemplo-caso-5',
    justificativa: 'Usei Cunningham e um fator alto para compensar o volume de corrida; não conferi o cálculo da gordura.',
    diasAtras: 12,
    inicio: '14:45:38.834',
    submissao: '14:46:10.374',
    respostas: [
      {
        id: 'resposta-mwmewrdy-o32blw',
        etapaId: 'exemplo-caso-5-etapa-1',
        parametro: 'Cunningham',
        valor: 1648.75,
        classificacao: 'erro de fato',
        tipoErro: 'aritmética',
      },
      {
        id: 'resposta-mwmewt4s-3o6i8b',
        etapaId: 'exemplo-caso-5-etapa-2',
        parametro: 2.4,
        valor: 3957,
        classificacao: 'erro de fato',
        tipoErro: 'meta fora de faixa',
      },
      { id: 'resposta-mwmewuvk-g9p56l', etapaId: 'exemplo-caso-5-etapa-3', parametro: 6, valor: 432, classificacao: 'correta' },
      { id: 'resposta-mwmewwmb-98ujq5', etapaId: 'exemplo-caso-5-etapa-4', parametro: 1.6, valor: 115.2, classificacao: 'correta' },
      { id: 'resposta-mwmewyc7-1z0cz7', etapaId: 'exemplo-caso-5-etapa-5', parametro: 1, valor: 36, classificacao: 'erro de fato', tipoErro: 'aritmética' },
    ],
    refeicoes: [
      { id: 'refeicao-mwmex1kh-pnl1ne', nome: 'Café da manhã', horario: '07:00', marcador: 'nenhum' },
    ],
    itens: [
      { id: 'item-mwmex47m-t42lec', refeicaoId: 'refeicao-mwmex1kh-pnl1ne', alimentoId: 'taco-182', quantidadeGramas: 100 },
      { id: 'item-mwmex6me-495iba', refeicaoId: 'refeicao-mwmex1kh-pnl1ne', alimentoId: 'taco-053', quantidadeGramas: 50 },
    ],
    dietaForaDasMetas: true,
    avaliacoes: [
      {
        etapaId: 'exemplo-caso-5-etapa-1',
        tipo: 'TMB',
        ordem: 1,
        respondida: true,
        valorEsperado: 1846.3999999999999,
        classificacao: 'erro de fato',
        tipoErro: 'aritmética',
        motivo: 'O valor informado (1.648,75) não confere com o esperado para o parâmetro escolhido (1.846,4).',
      },
      {
        etapaId: 'exemplo-caso-5-etapa-2',
        tipo: 'GET',
        ordem: 2,
        respondida: true,
        valorEsperado: 3957,
        classificacao: 'erro de fato',
        tipoErro: 'meta fora de faixa',
        motivo: 'O parâmetro informado (2,4) está fora da faixa aceitável (1,4 a 2,2).',
      },
      {
        etapaId: 'exemplo-caso-5-etapa-3',
        tipo: 'CHO',
        ordem: 3,
        respondida: true,
        valorEsperado: 432,
        classificacao: 'correta',
        motivo: 'O parâmetro e o valor conferem com a referência do caso.',
      },
      {
        etapaId: 'exemplo-caso-5-etapa-4',
        tipo: 'PTN',
        ordem: 4,
        respondida: true,
        valorEsperado: 115.2,
        classificacao: 'correta',
        motivo: 'O parâmetro e o valor conferem com a referência do caso.',
      },
      {
        etapaId: 'exemplo-caso-5-etapa-5',
        tipo: 'LIP',
        ordem: 5,
        respondida: true,
        valorEsperado: 72,
        classificacao: 'erro de fato',
        tipoErro: 'aritmética',
        motivo: 'O valor informado (36) não confere com o esperado para o parâmetro escolhido (72).',
      },
    ],
  },
];

/** O que o `ResolucaoService` guarda: as mesmas listas, ligadas pelos ids. */
export interface DadosDemo {
  versao: number;
  resolucoes: Resolucao[];
  respostas: RespostaEtapa[];
  refeicoes: Refeicao[];
  itens: ItemRefeicao[];
  submissoes: { resolucaoId: string; dietaForaDasMetas: boolean; etapas: ReturnType<typeof etapasPadrao>; avaliacoes: AvaliacaoEtapa[] }[];
}

/**
 * A semente: as tentativas com as datas contadas a partir de `agora` (dia local, hora da tentativa). O que cairia
 * depois de `agora` (a tentativa de hoje, se a pessoa abrir de manhã) fica em `agora`, para nada nascer no futuro.
 */
export function montarResolucoesDemo(versao: number, agora: Date): DadosDemo {
  const emDias = (diasAtras: number, hora: string): Date => {
    const [h, m, resto] = hora.split(':');
    const [s, ms] = resto.split('.');
    return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - diasAtras, Number(h), Number(m), Number(s), Number(ms));
  };
  const ate = (data: Date, limite: Date): string => (data.getTime() > limite.getTime() ? limite : data).toISOString();
  const umMinutoAntes = new Date(agora.getTime() - 60_000);

  return {
    versao,
    resolucoes: TENTATIVAS_DEMO.map((t) => ({
      id: t.id,
      casoId: t.casoId,
      data: ate(emDias(t.diasAtras, t.inicio), umMinutoAntes),
      status: 'submetida',
      justificativa: t.justificativa,
      submetidaEm: ate(emDias(t.diasAtras, t.submissao), agora),
    })),
    respostas: TENTATIVAS_DEMO.flatMap((t) => t.respostas.map((r) => ({ ...r, resolucaoId: t.id }))),
    refeicoes: TENTATIVAS_DEMO.flatMap((t) => t.refeicoes.map((r) => ({ ...r, resolucaoId: t.id }))),
    itens: TENTATIVAS_DEMO.flatMap((t) => t.itens),
    submissoes: TENTATIVAS_DEMO.map((t) => ({
      resolucaoId: t.id,
      dietaForaDasMetas: t.dietaForaDasMetas,
      etapas: etapasPadrao(t.casoId),
      avaliacoes: t.avaliacoes,
    })),
  };
}
