import { Component, computed, EventEmitter, inject, input, Output, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, FormGroupDirective, ValidationErrors, Validators } from '@angular/forms';
import { debounceTime } from 'rxjs';
import { Alimento } from '../../../../core/models';
import { AlimentoService, grauDaBusca } from '../../../../core/services/alimento.service';
import { mensagemNumero, numeroPositivo } from '../../etapas-ui';

/** Quantas sugestões a lista mostra, quantas letras é preciso digitar para buscar e a pausa na digitação antes de buscar (ms). */
export const LIMITE_SUGESTOES = 10;
export const MIN_LETRAS_BUSCA = 3;
export const PAUSA_DA_BUSCA_MS = 300;

export interface InclusaoDeItem {
  alimentoId: string;
  quantidadeGramas: number;
}

/** O campo só vale com um alimento escolhido da lista, não com texto solto. */
function alimentoEscolhido(controle: AbstractControl): ValidationErrors | null {
  const valor: unknown = controle.value;
  return typeof valor === 'object' && valor !== null ? null : { escolha: true };
}

/**
 * Busca um alimento da TACO pelo nome (sem acento nem maiúsculas, RF13) e inclui com a quantidade em
 * gramas (RF14). Uma lista curta de sugestões aparece depois de uma pausa na digitação: todo nome que contém
 * cada palavra digitada, em qualquer ordem, com os que começam pelo texto antes (veja `grauDaBusca`); o alimento precisa ser escolhido dela e não pode já estar na
 * refeição (`jaNaRefeicao`). Quem usa recebe o resultado em `incluir` e decide o que fazer; a base de alimentos precisa estar
 * carregada, senão a busca não acha nada.
 */
@Component({
  selector: 'app-busca-alimento',
  standalone: false,
  styleUrl: './busca-alimento.component.scss',
  templateUrl: './busca-alimento.component.html',
})
export class BuscaAlimentoComponent {
  private readonly alimentos = inject(AlimentoService);

  /** Ids dos alimentos que a refeição já tem: o mesmo alimento não entra duas vezes (a quantidade se edita no item). */
  readonly jaNaRefeicao = input<readonly string[]>([]);

  /** Emite o alimento escolhido e a quantidade, quando os dois são válidos. */
  @Output() readonly incluir = new EventEmitter<InclusaoDeItem>();

  protected readonly grupo = new FormGroup({
    busca: new FormControl<string | Alimento>('', {
      nonNullable: true,
      validators: [alimentoEscolhido, (c) => this.alimentoRepetido(c)],
    }),
    quantidade: new FormControl<number | null>(null, { validators: [Validators.required, numeroPositivo] }),
  });

  private readonly formulario = viewChild<FormGroupDirective>('formulario');

  private readonly textoDigitado = toSignal(this.grupo.controls.busca.valueChanges.pipe(debounceTime(PAUSA_DA_BUSCA_MS)), {
    initialValue: '' as string | Alimento,
  });

  private readonly consulta = computed(() => {
    const valor = this.textoDigitado();
    return typeof valor === 'string' && valor.trim().length >= MIN_LETRAS_BUSCA ? valor : null;
  });

  protected readonly sugestoes = computed(() => {
    const consulta = this.consulta();
    if (consulta === null) {
      return [];
    }
    return this.alimentos
      .buscarPorNome(consulta)
      .map((alimento) => ({ alimento, grau: grauDaBusca(alimento.nome, consulta) }))
      .sort((a, b) => a.grau - b.grau || a.alimento.nome.localeCompare(b.alimento.nome, 'pt-BR'))
      .slice(0, LIMITE_SUGESTOES)
      .map(({ alimento }) => alimento);
  });

  protected readonly semResultado = computed(() => this.consulta() !== null && this.sugestoes().length === 0);

  /** Como o campo mostra o alimento escolhido. */
  protected readonly exibir = (valor: string | Alimento | null): string => (typeof valor === 'string' ? valor : (valor?.nome ?? ''));

  protected readonly mensagemBusca = (): string =>
    this.grupo.controls.busca.hasError('repetido') ? 'Este alimento já está nesta refeição. Edite a quantidade.' : 'Escolha um alimento da lista';

  protected readonly mensagemQuantidade = (): string => mensagemNumero(this.grupo.controls.quantidade);

  private alimentoRepetido(controle: AbstractControl): ValidationErrors | null {
    const valor: unknown = controle.value;
    return typeof valor === 'object' && valor !== null && this.jaNaRefeicao().includes((valor as Alimento).id) ? { repetido: true } : null;
  }

  protected adicionar(): void {
    // A refeição pode ter mudado desde que o alimento foi escolhido (item apagado, por exemplo).
    this.grupo.controls.busca.updateValueAndValidity();
    this.grupo.markAllAsTouched();
    const { busca, quantidade } = this.grupo.getRawValue();
    if (this.grupo.invalid || typeof busca === 'string' || quantidade === null) {
      return;
    }
    this.incluir.emit({ alimentoId: busca.id, quantidadeGramas: quantidade });
    // resetForm também zera o "enviado" do formulário; só o reset do grupo deixaria os campos limpos com erro.
    this.formulario()?.resetForm({ busca: '', quantidade: null });
  }
}
