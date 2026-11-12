// Coisas de tela que mais de um componente de resolução usa: os rótulos e as unidades das etapas e a validação
// de formato dos campos numéricos. Fica aqui para os passos (etapas, dieta e revisar) e o resultado dizerem as
// mesmas coisas do mesmo jeito. Nada aqui dá a conta pronta nem o valor esperado.

import { AbstractControl, ValidationErrors } from '@angular/forms';
import { TipoEtapa } from '../../core/models';

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
  return '';
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
