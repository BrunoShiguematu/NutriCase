import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { TipoEtapa } from '../../core/models';

export interface DestinoDaPendencia {
  passo: number;
  etapaId?: string;
}

export interface CamposDaEtapa {
  titulo: string;
  parametroRotulo: string;
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

export const FAIXAS_USUAIS: Record<TipoEtapa, { parametro?: Faixa; valor: Faixa }> = {
  TMB: { valor: { min: 800, max: 3500 } },
  GET: { parametro: { min: 1, max: 2.5 }, valor: { min: 1200, max: 7000 } },
  CHO: { parametro: { min: 1, max: 12 }, valor: { min: 50, max: 1200 } },
  PTN: { parametro: { min: 0.8, max: 3 }, valor: { min: 40, max: 400 } },
  LIP: { parametro: { min: 0.3, max: 2.5 }, valor: { min: 20, max: 250 } },
};

export function dentroDaFaixa({ min, max }: Faixa): ValidatorFn {
  return (controle) => {
    const valor = controle.value;
    return typeof valor === 'number' && valor > 0 && (valor < min || valor > max) ? { foraDaFaixa: { min, max } } : null;
  };
}

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

export const MENSAGEM_TEXTO_NAO_NUMERICO = 'Digite só números (ex.: 1,8)';

export function textoNaoNumerico(evento: Event): boolean {
  return (evento.target as HTMLInputElement | null)?.validity?.badInput === true;
}

export function formatarNumero(valor: number, casas = 1): string {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: casas });
}

export function comSinal(valor: number, casas = 1): string {
  const texto = formatarNumero(Math.abs(valor), casas);
  return valor > 0 ? `+${texto}` : valor < 0 ? `−${texto}` : texto;
}
