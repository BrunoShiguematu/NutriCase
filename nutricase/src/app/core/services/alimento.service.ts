import { Inject, Injectable, InjectionToken, computed, signal } from '@angular/core';
import { Alimento } from '../models';
import { StorageService } from './storage.service';

/**
 * Número de versão da TACO que vai no app. Suba este número sempre que `core/data/taco.json`
 * mudar (por exemplo, depois de rodar `scripts/converter-taco.mjs` com outra fonte): no próximo
 * acesso, cada navegador troca os itens TACO e mantém os de outra origem.
 */
export const VERSAO_TACO = 1;

const CHAVE = 'nutricase.alimentos';

/**
 * Como o app obtém a TACO. O `import()` dinâmico faz o bundler pôr o JSON (~125 kB) num chunk
 * à parte, fora do pacote inicial. Um import estático colocaria o JSON no pacote inicial.
 * Existe como token para os testes poderem trocar a TACO por uma pequena.
 */
export type CarregadorTaco = () => Promise<readonly Alimento[]>;
export const CARREGADOR_TACO = new InjectionToken<CarregadorTaco>('CARREGADOR_TACO', {
  providedIn: 'root',
  factory: () => async () => (await import('../data/taco.json')).default as Alimento[],
});

/** `nao-carregado` (ainda ninguém chamou `carregar`), `carregando`, `pronto` ou `erro`. */
export type EstadoAlimentos = 'nao-carregado' | 'carregando' | 'pronto' | 'erro';

interface DadosSalvos {
  versao: number;
  alimentos: Alimento[];
}

function copiar(alimento: Alimento): Alimento {
  return { ...alimento };
}

/** Minúsculas e sem acento: "Feijão" e "feijao" viram a mesma coisa. */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

/**
 * Base de alimentos (RF13): a TACO, gravada no navegador na primeira abertura, e itens de outra origem.
 *
 * Carregamento (decisão): a TACO é pesada e vem por `import()` dinâmico, então o serviço não está
 * pronto ao ser criado. Quem usa chama `await carregar()` (ou lê o signal `estado`) antes de
 * consultar. Antes disso, `listar`, as buscas e `listarGrupos` devolvem lista vazia, e `carregar`
 * pode ser chamado várias vezes: só o primeiro faz o trabalho. Se o carregamento falhar,
 * `estado` fica `erro`, nenhum erro é lançado, e chamar `carregar` de novo tenta outra vez.
 *
 * Quando o navegador já tem a versão atual da TACO, o JSON nem é baixado.
 * Nada é entregue por referência: listas e itens saem como cópias.
 */
@Injectable({ providedIn: 'root' })
export class AlimentoService {
  private readonly dados = signal<Alimento[]>([]);
  private readonly _estado = signal<EstadoAlimentos>('nao-carregado');
  private carga: Promise<void> | null = null;

  readonly estado = this._estado.asReadonly();
  /** Os alimentos como signal, para as telas atualizarem sozinhas quando a carga terminar. */
  readonly alimentos = computed(() => this.dados().map(copiar));

  constructor(
    private readonly storage: StorageService,
    @Inject(CARREGADOR_TACO) private readonly carregarTaco: CarregadorTaco,
  ) {}

  /** Garante que a base está no navegador e na memória. Nunca rejeita: veja `estado`. */
  carregar(): Promise<void> {
    if (!this.carga) {
      // O reset da carga fica aqui, depois da atribuição: dentro de executarCarga ele seria
      // sobrescrito se o carregador falhasse de forma síncrona (antes do primeiro await).
      this.carga = this.executarCarga().then(() => {

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

  /**
   * Busca por nome sem diferenciar maiúscula nem acento. Com várias palavras, o nome precisa
   * ter todas, em qualquer ordem ("arroz cozido" acha "Arroz, tipo 1, cozido").
   * Texto vazio devolve todos.
   */
  buscarPorNome(texto: string): Alimento[] {
    const palavras = normalizar(texto).split(/\s+/).filter(Boolean);
    return this.dados()
      .filter((a) => {
        const nome = normalizar(a.nome);
        return palavras.every((p) => nome.includes(p));
      })
      .map(copiar);
  }

  filtrarPorGrupo(grupo: string): Alimento[] {
    return this.dados().filter((a) => a.grupo === grupo).map(copiar);
  }

  /** Grupos existentes, sem repetição, em ordem alfabética (pt-BR). */
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
      // Sem a TACO nova, mostra o que o navegador já tinha, se tinha algo, e permite tentar de novo.
      this.dados.set(salvos?.alimentos ?? []);
      this._estado.set('erro');
      this.carga = null;
    }
  }

  private lerSalvos(): DadosSalvos | null {
    const lido = this.storage.ler<Partial<DadosSalvos>>(CHAVE);
    // Lista vazia com a versão certa não serve (o serviço nunca grava vazio): vale como ilegível.
    if (lido && typeof lido.versao === 'number' && Array.isArray(lido.alimentos) && lido.alimentos.length > 0) {
      return { versao: lido.versao, alimentos: lido.alimentos };
    }
    return null;
  }
}
