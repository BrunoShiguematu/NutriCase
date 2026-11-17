import { Injectable } from '@angular/core';

/** Camada fina sobre o localStorage: lê e grava JSON por chave. Se o navegador bloquear, lê null e ignora a gravação. */
@Injectable({ providedIn: 'root' })
export class StorageService {
  ler<T>(chave: string): T | null {
    try {
      const texto = localStorage.getItem(chave);
      return texto === null ? null : (JSON.parse(texto) as T);
    } catch {
      return null;
    }
  }

  gravar<T>(chave: string, valor: T): void {
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
    } catch {
      // Sem localStorage (bloqueado ou cheio): o dado não persiste.
    }
  }
}
