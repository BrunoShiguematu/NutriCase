// Correção das etapas de cálculo (RN01–RN04, RN08, RNF08): função pura, sem Angular e sem estado.
// Segue a seção "Como a correção funciona" do plano. Nenhuma regra abaixo lança erro: dado
// estranho vira classificação ou "não avaliada", nunca exceção.
//
// Valores, faixas, tolerâncias e o limite de segurança são exemplos e aguardam validação docente.

import { Atleta, Classificacao, EtapaCalculo, RespostaEtapa, TipoEtapa, TipoErro } from '../models';
import { EQUACOES_TMB, get, gramasPorDia, podeCalcularTmb, tmb } from './formulas';

/**
 * Limite de segurança energética (RN08): o GET do estudante não pode ficar abaixo da TMB que ele
 * mesmo informou vezes este fator. Valor de exemplo; aguarda validação docente.
 */
export const LIMITE_SEGURANCA_GET_SOBRE_TMB = 1;

/** kJ por kcal, usado para reconhecer a troca de unidade de energia. */
export const KJ_POR_KCAL = 4.184;

/** Fator g ↔ kg (ou mg), usado para reconhecer a troca de unidade de massa. */
export const FATOR_MILHAR = 1000;

/** Folga mínima nas comparações, para o limite exato da tolerância não falhar por erro de ponto flutuante. */
const EPSILON = 1e-9;

/** Resultado da correção de uma etapa. */
export interface AvaliacaoEtapa {
  etapaId: string;
  tipo: TipoEtapa;
  ordem: number;
  /**
   * `false` quando o estudante não respondeu a etapa, ou respondeu com um número não finito
   * (NaN ou Infinity) no valor ou no parâmetro: nesses casos nada é classificado.
   */
  respondida: boolean;
  /**
   * Ausente quando a etapa não foi avaliada: sem resposta, ou sem base para calcular o esperado
   * (o GET quando a TMB não foi respondida). O `motivo` diz qual dos dois.
   */
  classificacao?: Classificacao;
  /** Só quando a classificação é "erro de fato". */
  tipoErro?: TipoErro;
  /**
   * Valor que o estudante deveria ter obtido com o parâmetro e as etapas anteriores **dele** (RN04),
   * quando dá para calcular. Ausente, por exemplo, com uma equação que a ficha não permite usar.
   */
  valorEsperado?: number;
  /** Explicação curta para a tela de resultado (RF23). */
  motivo: string;
}

/**
 * Corrige as etapas, na ordem de `ordem`.
 *
 * Cada etapa é calculada a partir dos valores que o estudante informou nas anteriores, mesmo
 * quando eles estão errados (RN04): o GET esperado usa a TMB **dele**; os gramas usam o g/kg **dele**.
 *
 * Número não finito (NaN ou Infinity) no valor ou no parâmetro do estudante conta como resposta
 * ausente: a etapa não é avaliada e nunca alimenta a cadeia, então nenhum NaN chega ao `valorEsperado`.
 *
 * Ordem de verificação de uma etapa respondida:
 *  1. parâmetro fora do aceitável: "escolha de equação" (TMB) ou "meta fora de faixa" (demais);
 *  2. limite de segurança (RN08): GET abaixo da TMB do estudante é "meta fora de faixa";
 *  3. valor igual ao esperado multiplicado ou dividido por 4,184 ou por 1000: "conversão de unidade";
 *  4. valor fora da tolerância do esperado: "aritmética";
 *  5. parâmetro igual à referência: "correta";
 *  6. senão: "divergente" (parâmetro aceitável, mas diferente da referência; não é erro).
 *
 * Uma exceção à ordem literal, para o caso degenerado: o passo 3 só roda se o valor **não** estiver
 * dentro da tolerância do esperado. Sem isso, um esperado igual a zero (ou uma tolerância enorme)
 * faria um valor certo parecer troca de unidade.
 */
export function avaliarEtapas(
  etapas: readonly EtapaCalculo[],
  respostas: readonly RespostaEtapa[],
  atleta: Atleta,
): AvaliacaoEtapa[] {
  const ordenadas = [...etapas].sort((a, b) => a.ordem - b.ordem);
  const respostaDe = (etapa: EtapaCalculo): RespostaEtapa | undefined => respostas.find((r) => r.etapaId === etapa.id);

  // A TMB que o estudante informou alimenta o GET, mesmo que a etapa da TMB esteja errada.
  // Uma resposta com número não finito conta como ausente também aqui.
  const etapaTmb = ordenadas.find((e) => e.tipo === 'TMB');
  const respostaTmb = etapaTmb ? respostaDe(etapaTmb) : undefined;
  const tmbDoAluno = respostaTmb && temNumerosFinitos(respostaTmb) ? respostaTmb.valor : undefined;

  return ordenadas.map((etapa) => {
    const resposta = respostaDe(etapa);
    if (resposta === undefined) {
      return semResposta(etapa, 'Etapa sem resposta: não foi avaliada.');
    }
    if (!temNumerosFinitos(resposta)) {
      return semResposta(etapa, 'Resposta com número inválido (não finito): a etapa não foi avaliada.');
    }
    return avaliarEtapa(etapa, resposta, atleta, tmbDoAluno);
  });
}

/** O valor e o parâmetro numérico do estudante, quando existem, precisam ser finitos. */
function temNumerosFinitos({ valor, parametro }: RespostaEtapa): boolean {
  return Number.isFinite(valor) && (typeof parametro !== 'number' || Number.isFinite(parametro));
}

function avaliarEtapa(
  etapa: EtapaCalculo,
  resposta: RespostaEtapa,
  atleta: Atleta,
  tmbDoAluno: number | undefined,
): AvaliacaoEtapa {
  const valorEsperado = calcularEsperado(etapa, resposta, atleta, tmbDoAluno);
  const base = { etapaId: etapa.id, tipo: etapa.tipo, ordem: etapa.ordem, respondida: true, valorEsperado };

  // 1. Parâmetro fora do aceitável.
  const parametroInaceitavel = etapa.tipo === 'TMB' ? verificarEquacao(etapa, resposta, atleta) : verificarFaixa(etapa, resposta);
  if (parametroInaceitavel) {
    return { ...base, classificacao: 'erro de fato', ...parametroInaceitavel };
  }

  // 2. Limite de segurança energética (RN08).
  if (
    etapa.tipo === 'GET' &&
    tmbDoAluno !== undefined &&
    resposta.valor < tmbDoAluno * LIMITE_SEGURANCA_GET_SOBRE_TMB - EPSILON
  ) {
    return {
      ...base,
      classificacao: 'erro de fato',
      tipoErro: 'meta fora de faixa',
      motivo: `O GET informado (${num(resposta.valor)} kcal) ficou abaixo do limite de segurança energética: a TMB informada é ${num(tmbDoAluno)} kcal.`,
    };
  }

  // Sem esperado não há como conferir o valor (o GET sem a TMB do estudante).
  if (valorEsperado === undefined) {
    return {
      ...base,
      motivo: 'Não foi possível avaliar esta etapa: falta a resposta da etapa anterior da qual ela depende.',
    };
  }

  // 3 e 4. Valor fora da tolerância do esperado: conversão de unidade ou aritmética.
  if (!dentroDaTolerancia(resposta.valor, valorEsperado, etapa.tolerancia)) {
    const conversao = reconhecerConversao(resposta.valor, valorEsperado, etapa.tolerancia);
    if (conversao) {
      return {
        ...base,
        classificacao: 'erro de fato',
        tipoErro: 'conversão de unidade',
        motivo: `O valor corresponde ao esperado (${num(valorEsperado)}) ${conversao}: provável erro de unidade.`,
      };
    }
    return {
      ...base,
      classificacao: 'erro de fato',
      tipoErro: 'aritmética',
      motivo: `O valor informado (${num(resposta.valor)}) não confere com o esperado para o parâmetro escolhido (${num(valorEsperado)}).`,
    };
  }

  // 5 e 6. O valor confere: o parâmetro decide entre correta e divergente.
  return parametroIgualAReferencia(etapa, resposta.parametro)
    ? { ...base, classificacao: 'correta', motivo: 'O parâmetro e o valor conferem com a referência do caso.' }
    : {
        ...base,
        classificacao: 'divergente',
        motivo: `O parâmetro difere da referência do caso (${texto(etapa.parametroReferencia)}), mas está dentro do aceitável, e o valor confere.`,
      };
}

function semResposta(etapa: EtapaCalculo, motivo: string): AvaliacaoEtapa {
  return { etapaId: etapa.id, tipo: etapa.tipo, ordem: etapa.ordem, respondida: false, motivo };
}

type ErroDeParametro = { tipoErro: TipoErro; motivo: string };

/** Passo 1 da TMB: a equação precisa ser aceita pelo caso e poder ser calculada para este atleta. */
function verificarEquacao(etapa: EtapaCalculo, resposta: RespostaEtapa, atleta: Atleta): ErroDeParametro | undefined {
  const escolhida = resposta.parametro;
  // A referência do caso sempre vale como aceitável, mesmo que a lista de opções não a repita.
  const aceitaveis = new Set([...(etapa.opcoesAceitaveis ?? []), String(etapa.parametroReferencia)]);
  if (typeof escolhida !== 'string' || !aceitaveis.has(escolhida)) {
    return { tipoErro: 'escolha de equação', motivo: `A equação escolhida (${texto(escolhida)}) não está entre as aceitas para este caso.` };
  }
  const equacao = EQUACOES_TMB.find((e) => e === escolhida);
  if (equacao === undefined) {
    return { tipoErro: 'escolha de equação', motivo: `A equação ${escolhida} não é reconhecida pelo sistema.` };
  }
  if (!podeCalcularTmb(equacao, atleta)) {
    return {
      tipoErro: 'escolha de equação',
      motivo: `A equação ${equacao} exige o percentual de gordura, que a ficha deste atleta não informa.`,
    };
  }
  return undefined;
}

/** Passo 1 das etapas numéricas: o parâmetro (fator ou g/kg) precisa estar na faixa aceitável. */
function verificarFaixa(etapa: EtapaCalculo, resposta: RespostaEtapa): ErroDeParametro | undefined {
  const parametro = resposta.parametro;
  // Número não finito já foi tratado como resposta ausente; aqui só sobra parâmetro que não é número.
  if (typeof parametro !== 'number') {
    return { tipoErro: 'meta fora de faixa', motivo: 'O parâmetro informado não é um número válido.' };
  }
  const faixa = etapa.faixaAceitavel;
  if (faixa && (parametro < faixa.min || parametro > faixa.max)) {
    return {
      tipoErro: 'meta fora de faixa',
      motivo: `O parâmetro informado (${num(parametro)}) está fora da faixa aceitável (${num(faixa.min)} a ${num(faixa.max)}).`,
    };
  }
  return undefined;
}

/**
 * Valor esperado a partir do parâmetro e das etapas anteriores do estudante (RN04); `undefined`
 * quando não dá para calcular.
 */
function calcularEsperado(
  etapa: EtapaCalculo,
  resposta: RespostaEtapa,
  atleta: Atleta,
  tmbDoAluno: number | undefined,
): number | undefined {
  const parametro = resposta.parametro;
  if (etapa.tipo === 'TMB') {
    const equacao = EQUACOES_TMB.find((e) => e === parametro);
    return equacao !== undefined && podeCalcularTmb(equacao, atleta) ? tmb(equacao, atleta) : undefined;
  }
  if (typeof parametro !== 'number') {
    return undefined;
  }
  if (etapa.tipo === 'GET') {
    return tmbDoAluno === undefined ? undefined : get(tmbDoAluno, parametro);
  }
  return gramasPorDia(parametro, atleta.peso);
}

/** Valor dentro da tolerância (em %) do alvo, medida sobre o alvo. */
function dentroDaTolerancia(valor: number, alvo: number, toleranciaPercentual: number): boolean {
  return Math.abs(valor - alvo) <= Math.abs(alvo) * (toleranciaPercentual / 100) + EPSILON;
}

/** Descreve a troca de unidade quando o valor bate com o esperado multiplicado ou dividido por 4,184 ou 1000. */
function reconhecerConversao(valor: number, esperado: number, toleranciaPercentual: number): string | undefined {
  const candidatas: { alvo: number; descricao: string }[] = [
    { alvo: esperado * KJ_POR_KCAL, descricao: 'multiplicado por 4,184' },
    { alvo: esperado / KJ_POR_KCAL, descricao: 'dividido por 4,184' },
    { alvo: esperado * FATOR_MILHAR, descricao: 'multiplicado por 1000' },
    { alvo: esperado / FATOR_MILHAR, descricao: 'dividido por 1000' },
  ];
  return candidatas.find(({ alvo }) => dentroDaTolerancia(valor, alvo, toleranciaPercentual))?.descricao;
}

/** TMB: texto igual. Demais etapas: número dentro da tolerância (%) da referência. */
function parametroIgualAReferencia(etapa: EtapaCalculo, parametro: string | number): boolean {
  if (etapa.tipo === 'TMB') {
    return parametro === etapa.parametroReferencia;
  }
  const referencia = etapa.parametroReferencia;
  return typeof parametro === 'number' && typeof referencia === 'number' && dentroDaTolerancia(parametro, referencia, etapa.tolerancia);
}

function num(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

/** Valor de parâmetro em texto para as explicações: número com vírgula ("1,8"), o resto como está. */
function texto(valor: unknown): string {
  return typeof valor === 'number' && Number.isFinite(valor) ? num(valor) : String(valor);
}
