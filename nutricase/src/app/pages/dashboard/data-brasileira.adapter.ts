import { Injectable } from '@angular/core';
import { NativeDateAdapter } from '@angular/material/core';

/**
 * O adaptador nativo do Material mostra a data no idioma certo, mas lê o que se digita como mês/dia/ano
 * ("07/11/2026" vira 11 de julho e "18/11/2026" vira data inválida). Este lê dia/mês/ano, como no Brasil, com
 * o ano de 4 dígitos; qualquer outro texto é data inválida (o nativo chutaria: "07/11/26" viraria 11 de julho e
 * "2026-11-18" viraria 17/11 às 21h no horário do Brasil).
 */
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
    // 31/02 viraria 03/03: só vale se o dia e o mês continuam os mesmos.
    return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia ? data : this.invalid();
  }
}
