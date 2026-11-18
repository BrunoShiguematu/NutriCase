import { Atleta, Classificacao, EtapaCalculo, RespostaEtapa, TipoEtapa, TipoErro } from '../models';
import { EQUACOES_TMB, get, gramasPorDia, podeCalcularTmb, tmb } from './formulas';

export const LIMITE_SEGURANCA_GET_SOBRE_TMB = 1;

export const KJ_POR_KCAL = 4.184;

export const FATOR_MILHAR = 1000;

const EPSILON = 1e-9;

export interface AvaliacaoEtapa {
  etapaId: string;
  tipo: TipoEtapa;
  ordem: number;
  respondida: boolean;
  classificacao?: Classificacao;
  tipoErro?: TipoErro;
  valorEsperado?: number;
  motivo: string;
}

export function avaliarEtapas(
  etapas: readonly EtapaCalculo[],
  respostas: readonly RespostaEtapa[],
  atleta: Atleta,
): AvaliacaoEtapa[] {
  const ordenadas = [...etapas].sort((a, b) => a.ordem - b.ordem);
  const respostaDe = (etapa: EtapaCalculo): RespostaEtapa | undefined => respostas.find((r) => r.etapaId === etapa.id);

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

  const parametroInaceitavel = etapa.tipo === 'TMB' ? verificarEquacao(etapa, resposta, atleta) : verificarFaixa(etapa, resposta);
  if (parametroInaceitavel) {
    return { ...base, classificacao: 'erro de fato', ...parametroInaceitavel };
  }

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

  if (valorEsperado === undefined) {
    return {
      ...base,
      motivo: 'Não foi possível avaliar esta etapa: falta a resposta da etapa anterior da qual ela depende.',
    };
  }

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

function verificarEquacao(etapa: EtapaCalculo, resposta: RespostaEtapa, atleta: Atleta): ErroDeParametro | undefined {
  const escolhida = resposta.parametro;
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

function verificarFaixa(etapa: EtapaCalculo, resposta: RespostaEtapa): ErroDeParametro | undefined {
  const parametro = resposta.parametro;
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

function dentroDaTolerancia(valor: number, alvo: number, toleranciaPercentual: number): boolean {
  return Math.abs(valor - alvo) <= Math.abs(alvo) * (toleranciaPercentual / 100) + EPSILON;
}

function reconhecerConversao(valor: number, esperado: number, toleranciaPercentual: number): string | undefined {
  const candidatas: { alvo: number; descricao: string }[] = [
    { alvo: esperado * KJ_POR_KCAL, descricao: 'multiplicado por 4,184' },
    { alvo: esperado / KJ_POR_KCAL, descricao: 'dividido por 4,184' },
    { alvo: esperado * FATOR_MILHAR, descricao: 'multiplicado por 1000' },
    { alvo: esperado / FATOR_MILHAR, descricao: 'dividido por 1000' },
  ];
  return candidatas.find(({ alvo }) => dentroDaTolerancia(valor, alvo, toleranciaPercentual))?.descricao;
}

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

function texto(valor: unknown): string {
  return typeof valor === 'number' && Number.isFinite(valor) ? num(valor) : String(valor);
}
