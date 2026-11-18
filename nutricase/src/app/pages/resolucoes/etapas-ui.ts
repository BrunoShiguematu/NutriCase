// Coisas de tela que mais de um componente de resolução usa: os rótulos e as unidades das etapas e a validação
// de formato dos campos numéricos. Fica aqui para os passos (etapas, dieta e revisar) e o resultado dizerem as
// mesmas coisas do mesmo jeito. Nada aqui dá a conta pronta nem o valor esperado.

import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { TipoEtapa } from '../../core/models';

/** Para onde uma pendência leva: o passo do stepper e, nas de etapa, qual etapa abrir dentro do passo Etapas. */
export interface DestinoDaPendencia {
  passo: number;
  etapaId?: string;
}

/** Como uma etapa aparece na tela: título, rótulo e unidade do parâmetro e do valor. */
export interface CamposDaEtapa {
  titulo: string;
  parametroRotulo: string;
  /** Unidade do parâmetro; ausente no fator de atividade e na equação. */
  parametroUnidade?: string;
  valorRotulo: string;
  valorUnidade: string;
}

export const CAMPOS_DA_ETAPA: Record<TipoEtapa, CamposDaEtapa> = {
  TMB: { titulo: 'Taxa metabólica basal (TMB)', parametroRotulo: 'Equação', valorRotulo: 'TMB', valorUnidade: 'kcal/dia' },
  GET: { titulo: 'Gasto energético total (GET)', parametroRotulo: 'Fator de atividade', valorRotulo: 'GET', valorUnidade: 'kcal/dia' },
  CHO: { titulo: 'Meta de carboidrato', parametroRotulo: 'Carboidrato', parametroUnidade: 'g/kg/dia', valorRotulo: 'Carboidrato total', valorUnidade: 'g/dia' },
  PTN: { titulo: 'Meta de proteína', parametroRotulo: 'Proteína', parametroUnidade: 'g/kg/dia', valorRotulo: 'Proteína total', valorUnidade: 'g/dia' },
  LIP: { titulo: 'Meta de gordura', parametroRotulo: 'Gordura', parametroUnidade: 'g/kg/dia', valorRotulo: 'Gordura total', valorUnidade: 'g/dia' },
};

/** Validação só de formato (RF11): número finito e maior que zero. Vazio é com o `required`. */
export function numeroPositivo(controle: AbstractControl): ValidationErrors | null {
  const valor = controle.value;
  if (valor === null || valor === '') {
    return null;
  }
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    return { numero: true };
  }
  return valor > 0 ? null : { positivo: true };
}

export interface Faixa {
  min: number;
  max: number;
}

/**
 * Faixas de valores usuais de cada campo numérico das etapas, para barrar erro de digitação (vírgula ou unidade
 * errada, como 18000 em vez de 1800). São fixas e não dependem do caso nem do atleta, então não entregam a
 * resposta nem dizem se o cálculo está certo. Valores de exemplo, aguardam validação docente.
 */
export const FAIXAS_USUAIS: Record<TipoEtapa, { parametro?: Faixa; valor: Faixa }> = {
  TMB: { valor: { min: 800, max: 3500 } },
  GET: { parametro: { min: 1, max: 2.5 }, valor: { min: 1200, max: 7000 } },
  CHO: { parametro: { min: 1, max: 12 }, valor: { min: 50, max: 1200 } },
  PTN: { parametro: { min: 0.8, max: 3 }, valor: { min: 40, max: 400 } },
  LIP: { parametro: { min: 0.3, max: 2.5 }, valor: { min: 20, max: 250 } },
};

/** Número positivo fora da faixa dá `foraDaFaixa`; o que não é número positivo é do `numeroPositivo`. */
export function dentroDaFaixa({ min, max }: Faixa): ValidatorFn {
  return (controle) => {
    const valor = controle.value;
    return typeof valor === 'number' && valor > 0 && (valor < min || valor > max) ? { foraDaFaixa: { min, max } } : null;
  };
}

/** Mensagem de formato de um campo numérico; nunca fala se a resposta está certa. */
export function mensagemNumero(controle: AbstractControl): string {
  if (controle.hasError('required')) {
    return 'Campo obrigatório';
  }
  if (controle.hasError('numero')) {
    return 'Informe um número válido';
  }
  if (controle.hasError('positivo')) {
    return 'Informe um número maior que zero';
  }
  const faixa = controle.getError('foraDaFaixa') as Faixa | undefined;
  if (faixa) {
    return `Valor fora do usual (entre ${formatarNumero(faixa.min, 2)} e ${formatarNumero(faixa.max, 2)}). Confira a unidade e a vírgula.`;
  }
  return '';
}

/** Mensagem para o que foi digitado num campo numérico e o navegador recusou (por exemplo, letras). */
export const MENSAGEM_TEXTO_NAO_NUMERICO = 'Digite só números (ex.: 1,8)';

/**
 * O campo numérico recebeu texto que não é número? O navegador deixa o valor do campo vazio nesse caso, e só
 * `validity.badInput` sabe que havia algo digitado; sem isto a mensagem seria "Campo obrigatório".
 */
export function textoNaoNumerico(evento: Event): boolean {
  return (evento.target as HTMLInputElement | null)?.validity?.badInput === true;
}

/** Número com vírgula decimal, no máximo `casas` casas (3008,25 com 2; 3.008,3 com 1). */
export function formatarNumero(valor: number, casas = 1): string {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: casas });
}

/** "+120", "−35" ou "0": a diferença com sinal, para ler sem conta. */
export function comSinal(valor: number, casas = 1): string {
  const texto = formatarNumero(Math.abs(valor), casas);
  return valor > 0 ? `+${texto}` : valor < 0 ? `−${texto}` : texto;
}
