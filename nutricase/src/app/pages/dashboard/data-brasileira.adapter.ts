import { Injectable } from '@angular/core';
import { NativeDateAdapter } from '@angular/material/core';

@Injectable()
export class DataBrasileiraAdapter extends NativeDateAdapter {
  override parse(valor: unknown, formatoDeEntrada?: unknown): Date | null {
    if (typeof valor !== 'string') {
      return super.parse(valor, formatoDeEntrada);
    }
    const partes = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(valor);
    if (!partes) {
      return valor.trim() === '' ? null : this.invalid();
    }
    const [dia, mes, ano] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
    const data = new Date(ano, mes - 1, dia);
    return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia ? data : this.invalid();
  }
}
