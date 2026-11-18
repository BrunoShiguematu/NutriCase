import { Injectable } from '@angular/core';

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
    }
  }
}
