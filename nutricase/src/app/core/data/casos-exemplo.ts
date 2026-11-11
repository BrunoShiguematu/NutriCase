// Valores de exemplo, aguardam validação docente antes de publicação.
// Isto vale para os casos, as fichas e também para as etapas de cálculo (referências, faixas e
// tolerâncias): são exemplos, não critério validado.
//
// Sobe a versão quando os exemplos mudarem: na próxima abertura, o CasoService troca os
// exemplos antigos pelos novos e mantém os casos criados pelo usuário.
//
// Atenção: editar um exemplo pela tela mantém o id "exemplo-...", então a troca de versão
// sobrescreve a edição. Para guardar uma alteração de forma permanente, crie um caso novo.

import { EQUACOES_TMB } from '../avaliacao/formulas';
import { Atleta, Caso, EtapaCalculo, TipoEtapa, TOLERANCIA_DIETA_PADRAO } from '../models';

/** 2: os casos ganharam as 5 etapas de cálculo e a tolerância da dieta. */
export const VERSAO_CASOS_EXEMPLO = 2;

/** Ids dos exemplos começam com isto; é como o serviço separa exemplos de casos do usuário. */
export const PREFIXO_ID_EXEMPLO = 'exemplo-';

const COMENTARIO_REFERENCIA =
  'Comentário de referência de exemplo; o texto do docente entra aqui após a validação.';

export const CASOS_EXEMPLO: Caso[] = [
  {
    id: 'exemplo-caso-1',
    atletaId: 'exemplo-atleta-1',
    titulo: 'Maratonista em fase de base',
    modalidade: 'Corrida',
    nivel: 'Iniciante',
    competencia: 'Gasto energético total',
    descricao: 'Atleta de 28 anos treinando 90 min/dia para a primeira maratona.',
    comentarioReferencia: COMENTARIO_REFERENCIA,
    toleranciaDieta: TOLERANCIA_DIETA_PADRAO,
  },
  {
    id: 'exemplo-caso-2',
    atletaId: 'exemplo-atleta-2',
    titulo: 'Meio-campista em pré-temporada',
    modalidade: 'Futebol',
    nivel: 'Intermediário',
    competencia: 'Distribuição de macronutrientes',
    descricao: 'Volume alto de treinos em dois períodos por dia.',
    comentarioReferencia: COMENTARIO_REFERENCIA,
    toleranciaDieta: TOLERANCIA_DIETA_PADRAO,
  },
  {
    id: 'exemplo-caso-3',
    atletaId: 'exemplo-atleta-3',
    titulo: 'Nadadora em período competitivo',
    modalidade: 'Natação',
    nivel: 'Avançado',
    competencia: 'Periodização nutricional',
    descricao: 'Provas de 200 m e treino às 05h00.',
    comentarioReferencia: COMENTARIO_REFERENCIA,
    toleranciaDieta: TOLERANCIA_DIETA_PADRAO,
  },
  {
    id: 'exemplo-caso-4',
    atletaId: 'exemplo-atleta-4',
    titulo: 'Praticante de musculação em ganho de massa',
    modalidade: 'Musculação',
    nivel: 'Intermediário',
    competencia: 'Ajuste de meta proteica',
    descricao: 'Treino de força cinco vezes por semana, com superávit calórico moderado.',
    comentarioReferencia: COMENTARIO_REFERENCIA,
    toleranciaDieta: TOLERANCIA_DIETA_PADRAO,
  },
  {
    id: 'exemplo-caso-5',
    atletaId: 'exemplo-atleta-5',
    titulo: 'Corredor com restrição à lactose',
    modalidade: 'Corrida',
    nivel: 'Intermediário',
    competencia: 'Restrições alimentares',
    descricao: 'Prova de 10 km e intolerância à lactose.',
    comentarioReferencia: COMENTARIO_REFERENCIA,
    toleranciaDieta: TOLERANCIA_DIETA_PADRAO,
  },
  {
    id: 'exemplo-caso-6',
    atletaId: 'exemplo-atleta-6',
    titulo: 'Atleta de futebol sub-17',
    modalidade: 'Futebol',
    nivel: 'Iniciante',
    competencia: 'Conversão de unidades',
    descricao: 'Adolescente em fase de crescimento.',
    comentarioReferencia: COMENTARIO_REFERENCIA,
    toleranciaDieta: TOLERANCIA_DIETA_PADRAO,
  },
  {
    id: 'exemplo-caso-7',
    atletaId: 'exemplo-atleta-7',
    titulo: 'Ciclista de estrada em volume',
    modalidade: 'Ciclismo',
    nivel: 'Intermediário',
    competencia: 'Hidratação e carboidrato no treino',
    descricao: 'Treinos longos de até 4 h aos fins de semana.',
    comentarioReferencia: COMENTARIO_REFERENCIA,
    toleranciaDieta: TOLERANCIA_DIETA_PADRAO,
  },
  {
    id: 'exemplo-caso-8',
    atletaId: 'exemplo-atleta-8',
    titulo: 'Nadador master recreativo',
    modalidade: 'Natação',
    nivel: 'Iniciante',
    competencia: 'Escolha de equação',
    descricao: 'Atleta de 45 anos que treina 3x por semana.',
    comentarioReferencia: COMENTARIO_REFERENCIA,
    toleranciaDieta: TOLERANCIA_DIETA_PADRAO,
  },
];

/** Atletas fictícios, ligados aos casos por `Caso.atletaId`. */
export const ATLETAS_EXEMPLO: Atleta[] = [
  {
    id: 'exemplo-atleta-1',
    nome: 'Carlos Menezes',
    idade: 28,
    sexo: 'masculino',
    peso: 70,
    altura: 177,
    percentualGordura: 14,
    volumeTreino: '90 min/dia, 5x por semana',
    horarioTreino: '06h00',
    fasePeriodizacao: 'Base',
    objetivo: 'Completar a primeira maratona',
    restricoes: [],
    preferencias: ['Café da manhã salgado'],
  },
  {
    id: 'exemplo-atleta-2',
    nome: 'Diego Almeida',
    idade: 22,
    sexo: 'masculino',
    peso: 74,
    altura: 178,
    percentualGordura: 11,
    volumeTreino: 'Dois treinos por dia, 6x por semana',
    horarioTreino: '08h00 e 16h00',
    fasePeriodizacao: 'Pré-temporada',
    objetivo: 'Sustentar o alto volume de treino mantendo a massa magra',
    restricoes: [],
    preferencias: ['Arroz e feijão', 'Frutas'],
  },
  {
    id: 'exemplo-atleta-3',
    nome: 'Marina Duarte',
    idade: 20,
    sexo: 'feminino',
    peso: 62,
    altura: 170,
    percentualGordura: 20,
    volumeTreino: '2 h/dia, 6x por semana',
    horarioTreino: '05h00',
    fasePeriodizacao: 'Período competitivo',
    objetivo: 'Bom desempenho nas provas de 200 m',
    restricoes: [],
    preferencias: ['Lanches práticos entre treinos'],
  },
  {
    id: 'exemplo-atleta-4',
    nome: 'Lucas Ferraz',
    idade: 25,
    sexo: 'masculino',
    peso: 78,
    altura: 180,
    percentualGordura: 16,
    volumeTreino: '60 a 75 min/dia, 5x por semana',
    horarioTreino: '18h30',
    fasePeriodizacao: 'Ganho de massa',
    objetivo: 'Ganhar massa muscular com superávit calórico moderado',
    restricoes: [],
    preferencias: ['Ovos', 'Frango', 'Batata-doce'],
  },
  {
    id: 'exemplo-atleta-5',
    nome: 'Pedro Nogueira',
    idade: 34,
    sexo: 'masculino',
    peso: 72,
    altura: 175,
    percentualGordura: 15,
    volumeTreino: '60 min/dia, 4x por semana',
    horarioTreino: '06h30',
    fasePeriodizacao: 'Preparação para prova de 10 km',
    objetivo: 'Melhorar o tempo na prova de 10 km',
    restricoes: ['Intolerância à lactose'],
    preferencias: ['Bebidas vegetais'],
  },
  {
    id: 'exemplo-atleta-6',
    nome: 'Mateus Ribeiro',
    idade: 16,
    sexo: 'masculino',
    peso: 62,
    altura: 172,
    percentualGordura: 12,
    volumeTreino: '90 min/dia, 4x por semana',
    horarioTreino: '17h00',
    fasePeriodizacao: 'Treino regular na fase de crescimento',
    objetivo: 'Sustentar o crescimento e o treino sem perder peso',
    restricoes: [],
    preferencias: ['Sanduíches', 'Sucos naturais'],
  },
  {
    id: 'exemplo-atleta-7',
    nome: 'Rodrigo Campos',
    idade: 38,
    sexo: 'masculino',
    peso: 69,
    altura: 176,
    percentualGordura: 13,
    volumeTreino: '10 h por semana, com treinos longos de até 4 h',
    horarioTreino: '06h00',
    fasePeriodizacao: 'Bloco de volume',
    objetivo: 'Sustentar os treinos longos de fim de semana',
    restricoes: [],
    preferencias: ['Barras e géis durante o treino'],
  },
  {
    id: 'exemplo-atleta-8',
    nome: 'Antônio Barbosa',
    idade: 45,
    sexo: 'masculino',
    peso: 80,
    altura: 178,
    percentualGordura: 20,
    volumeTreino: '60 min, 3x por semana',
    horarioTreino: '19h00',
    fasePeriodizacao: 'Manutenção',
    objetivo: 'Manter a saúde e o condicionamento',
    restricoes: [],
    preferencias: ['Refeições leves à noite'],
  },
];

// ---------- Etapas de cálculo ----------

/** As 5 etapas de todo caso, sempre nesta ordem (ordem 1 a 5). */
export const TIPOS_ETAPA: readonly TipoEtapa[] = ['TMB', 'GET', 'CHO', 'PTN', 'LIP'];

/** Tolerância (%) padrão das 5 etapas. Valor de exemplo; aguarda validação docente. */
const TOLERANCIA_ETAPA_PADRAO = 5;

/** O que muda de um caso para outro: só a referência de cada parâmetro numérico. */
export interface AjustesEtapas {
  /** Fator de atividade de referência (padrão 1,7). */
  fatorAtividade?: number;
  /** Carboidrato de referência em g/kg/dia (padrão 6). */
  choGPorKg?: number;
  /** Proteína de referência em g/kg/dia (padrão 1,6). */
  ptnGPorKg?: number;
  /** Gordura de referência em g/kg/dia (padrão 1). */
  lipGPorKg?: number;
}

/**
 * Ajustes dos casos de exemplo, só onde o volume de treino ou a modalidade deixa evidente.
 * Valores de exemplo; aguardam validação docente.
 *   caso 1 (90 min/dia, 5x): GET 1,8        caso 5 (60 min/dia, 4x): GET 1,6
 *   caso 2 (dois treinos/dia, 6x): GET 1,9  caso 6 (90 min/dia, 4x): padrão
 *   caso 3 (2 h/dia, 6x): GET 2,0           caso 7 (10 h/semana): GET 1,9 e CHO 8 (treino longo)
 *   caso 4 (musculação): CHO 5 (força)      caso 8 (60 min, 3x): GET 1,5
 */
const AJUSTES_EXEMPLO: Readonly<Record<string, AjustesEtapas>> = {
  'exemplo-caso-1': { fatorAtividade: 1.8 },
  'exemplo-caso-2': { fatorAtividade: 1.9 },
  'exemplo-caso-3': { fatorAtividade: 2.0 },
  'exemplo-caso-4': { choGPorKg: 5 },
  'exemplo-caso-5': { fatorAtividade: 1.6 },
  'exemplo-caso-7': { fatorAtividade: 1.9, choGPorKg: 8 },
  'exemplo-caso-8': { fatorAtividade: 1.5 },
};

const numero = (n: number): string => n.toLocaleString('pt-BR');

/**
 * As 5 etapas de um caso, com os valores padrão (todos de exemplo; aguardam validação docente):
 *  - TMB: referência Mifflin-St Jeor, as 3 equações aceitas, tolerância de 5 %;
 *  - GET: fator 1,7, faixa 1,4 a 2,2, tolerância de 5 %;
 *  - CHO: 6 g/kg, faixa 4 a 10, tolerância de 5 %;
 *  - PTN: 1,6 g/kg, faixa 1,2 a 2,2, tolerância de 5 %;
 *  - LIP: 1 g/kg, faixa 0,5 a 1,5, tolerância de 5 %.
 *
 * `ajustes` troca só a referência dos parâmetros numéricos. Sem ele, os ids dos casos de exemplo
 * (`exemplo-caso-N`) usam os ajustes de `AJUSTES_EXEMPLO` e qualquer outro caso fica com o padrão.
 * O id de cada etapa é `<casoId>-etapa-<ordem>`.
 */
export function etapasPadrao(casoId: string, ajustes: AjustesEtapas = AJUSTES_EXEMPLO[casoId] ?? {}): EtapaCalculo[] {
  const fator = ajustes.fatorAtividade ?? 1.7;
  const cho = ajustes.choGPorKg ?? 6;
  const ptn = ajustes.ptnGPorKg ?? 1.6;
  const lip = ajustes.lipGPorKg ?? 1;
  const base = { casoId, tolerancia: TOLERANCIA_ETAPA_PADRAO };
  return [
    {
      ...base,
      id: `${casoId}-etapa-1`,
      ordem: 1,
      tipo: 'TMB',
      parametroReferencia: 'Mifflin-St Jeor',
      opcoesAceitaveis: [...EQUACOES_TMB],
      criterioReferencia:
        'Equação de referência: Mifflin-St Jeor. As três equações são aceitas; a Cunningham só quando a ficha informa o percentual de gordura.',
    },
    {
      ...base,
      id: `${casoId}-etapa-2`,
      ordem: 2,
      tipo: 'GET',
      parametroReferencia: fator,
      faixaAceitavel: { min: 1.4, max: 2.2 },
      criterioReferencia: `Fator de atividade de referência: ${numero(fator)}, pelo volume de treino do caso. Faixa aceitável: 1,4 a 2,2.`,
    },
    {
      ...base,
      id: `${casoId}-etapa-3`,
      ordem: 3,
      tipo: 'CHO',
      parametroReferencia: cho,
      faixaAceitavel: { min: 4, max: 10 },
      criterioReferencia: `Carboidrato de referência: ${numero(cho)} g/kg/dia, pela modalidade e pela carga de treino. Faixa aceitável: 4 a 10 g/kg.`,
    },
    {
      ...base,
      id: `${casoId}-etapa-4`,
      ordem: 4,
      tipo: 'PTN',
      parametroReferencia: ptn,
      faixaAceitavel: { min: 1.2, max: 2.2 },
      criterioReferencia: `Proteína de referência: ${numero(ptn)} g/kg/dia. Faixa aceitável: 1,2 a 2,2 g/kg.`,
    },
    {
      ...base,
      id: `${casoId}-etapa-5`,
      ordem: 5,
      tipo: 'LIP',
      parametroReferencia: lip,
      faixaAceitavel: { min: 0.5, max: 1.5 },
      criterioReferencia: `Gordura de referência: ${numero(lip)} g/kg/dia. Faixa aceitável: 0,5 a 1,5 g/kg.`,
    },
  ];
}

/** As 5 etapas de cada caso de exemplo, na ordem dos casos. */
export const ETAPAS_EXEMPLO: EtapaCalculo[] = CASOS_EXEMPLO.flatMap((caso) => etapasPadrao(caso.id));
