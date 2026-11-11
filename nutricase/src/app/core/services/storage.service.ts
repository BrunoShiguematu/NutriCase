import { Injectable } from '@angular/core';

/**
 * Camada fina sobre o localStorage: guarda e lê JSON por chave.
 * Se o localStorage falhar (bloqueado, cheio, modo privado), os dados ficam só em memória
 * durante a sessão. Trocar por uma API depois só muda esta classe.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly memoria = new Map<string, string>();

  ler<T>(chave: string): T | null {
    const texto = this.memoria.get(chave) ?? this.lerDoNavegador(chave);
    if (texto === null) {
      return null;
    }
    try {
      return JSON.parse(texto) as T;
    } catch {
      return null;
    }
  }

  gravar<T>(chave: string, valor: T): void {
    const texto = JSON.stringify(valor);
    this.memoria.set(chave, texto);
    try {
      localStorage.setItem(chave, texto);
    } catch {
      // Sem localStorage: o valor continua disponível em memória.
    }
  }

  remover(chave: string): void {
    this.memoria.delete(chave);
    try {
      localStorage.removeItem(chave);
    } catch {
      // Nada a fazer.
    }
  }

  private lerDoNavegador(chave: string): string | null {
    try {
      return localStorage.getItem(chave);
    } catch {
      return null;
    }
  }
}
