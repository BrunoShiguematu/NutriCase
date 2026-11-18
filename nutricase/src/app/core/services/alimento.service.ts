import { Inject, Injectable, InjectionToken, computed, signal } from '@angular/core';
import { Alimento } from '../models';
import { StorageService } from './storage.service';

export const VERSAO_TACO = 1;

const CHAVE = 'nutricase.alimentos';

export type CarregadorTaco = () => Promise<readonly Alimento[]>;
export const CARREGADOR_TACO = new InjectionToken<CarregadorTaco>('CARREGADOR_TACO', {
  providedIn: 'root',
  factory: () => async () => (await import('../data/taco.json')).default as Alimento[],
});

export type EstadoAlimentos = 'nao-carregado' | 'carregando' | 'pronto' | 'erro';

interface DadosSalvos {
  versao: number;
  alimentos: Alimento[];
}

function copiar(alimento: Alimento): Alimento {
  return { ...alimento };
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

export function nomeContem(nome: string, texto: string): boolean {
  const normal = normalizar(nome);
  return normalizar(texto).split(/\s+/).filter(Boolean).every((palavra) => normal.includes(palavra));
}

const palavrasDe = (texto: string): string[] => normalizar(texto).split(/[^a-z0-9]+/).filter(Boolean);

export function grauDaBusca(nome: string, texto: string): 0 | 1 | 2 {
  const digitadas = palavrasDe(texto);
  const doNome = palavrasDe(nome);
  if (digitadas.length > 0 && doNome[0]?.startsWith(digitadas[0])) {
    return 0;
  }
  return digitadas.every((d) => doNome.some((p) => p.startsWith(d))) ? 1 : 2;
}

@Injectable({ providedIn: 'root' })
export class AlimentoService {
  private readonly dados = signal<Alimento[]>([]);
  private readonly _estado = signal<EstadoAlimentos>('nao-carregado');
  private carga: Promise<void> | null = null;

  readonly estado = this._estado.asReadonly();
  readonly alimentos = computed(() => this.dados().map(copiar));

  constructor(
    private readonly storage: StorageService,
    @Inject(CARREGADOR_TACO) private readonly carregarTaco: CarregadorTaco,
  ) {}

  carregar(): Promise<void> {
    if (!this.carga) {
      this.carga = this.executarCarga().then(() => {
        if (this._estado() === 'erro') {
          this.carga = null;
        }
      });
    }
    return this.carga;
  }

  listar(): Alimento[] {
    return this.dados().map(copiar);
  }

  buscarPorId(id: string): Alimento | undefined {
    const achado = this.dados().find((a) => a.id === id);
    return achado ? copiar(achado) : undefined;
  }

  buscarPorNome(texto: string): Alimento[] {
    return this.dados()
      .filter((a) => nomeContem(a.nome, texto))
      .map(copiar);
  }

  filtrarPorGrupo(grupo: string): Alimento[] {
    return this.dados().filter((a) => a.grupo === grupo).map(copiar);
  }

  listarGrupos(): string[] {
    return [...new Set(this.dados().map((a) => a.grupo))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  private async executarCarga(): Promise<void> {
    this._estado.set('carregando');
    const salvos = this.lerSalvos();
    try {
      if (salvos?.versao === VERSAO_TACO) {
        this.dados.set(salvos.alimentos);
      } else {
        const taco = (await this.carregarTaco()).map(copiar);
        const dosOutros = (salvos?.alimentos ?? []).filter((a) => a.origem !== 'TACO');
        const novos = [...taco, ...dosOutros];
        this.storage.gravar<DadosSalvos>(CHAVE, { versao: VERSAO_TACO, alimentos: novos });
        this.dados.set(novos);
      }
      this._estado.set('pronto');
    } catch {
      this.dados.set(salvos?.alimentos ?? []);
      this._estado.set('erro');
    }
  }

  private lerSalvos(): DadosSalvos | null {
    const lido = this.storage.ler<Partial<DadosSalvos>>(CHAVE);
    if (lido && typeof lido.versao === 'number' && Array.isArray(lido.alimentos) && lido.alimentos.length > 0) {
      return { versao: lido.versao, alimentos: lido.alimentos };
    }
    return null;
  }
}
