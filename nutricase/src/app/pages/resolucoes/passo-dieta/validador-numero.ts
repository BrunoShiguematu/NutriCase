import { AbstractControl, ValidationErrors } from '@angular/forms';

/** Validação só de formato: número finito e maior que zero. Vazio é com o `required`. */
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
