import { Component, computed, EventEmitter, inject, Output, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, FormGroupDirective, ValidationErrors, Validators } from '@angular/forms';
import { Alimento } from '../../../../core/models';
import { AlimentoService } from '../../../../core/services/alimento.service';
import { mensagemNumero, numeroPositivo } from '../../etapas-ui';

/** Quantas sugestões a lista mostra, e quantas letras são preciso digitar para buscar. */
export const LIMITE_SUGESTOES = 8;
export const MIN_LETRAS_BUSCA = 2;

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
 * gramas (RF14). Uma lista curta de sugestões aparece enquanto se digita; o alimento precisa ser escolhido
 * dela. Quem usa recebe o resultado em `incluir` e decide o que fazer; a base de alimentos precisa estar
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

  /** Emite o alimento escolhido e a quantidade, quando os dois são válidos. */
  @Output() readonly incluir = new EventEmitter<InclusaoDeItem>();

  protected readonly grupo = new FormGroup({
    busca: new FormControl<string | Alimento>('', { nonNullable: true, validators: [alimentoEscolhido] }),
    quantidade: new FormControl<number | null>(null, { validators: [Validators.required, numeroPositivo] }),
  });

  private readonly formulario = viewChild<FormGroupDirective>('formulario');

  private readonly textoDigitado = toSignal(this.grupo.controls.busca.valueChanges, { initialValue: '' as string | Alimento });

  private readonly consulta = computed(() => {
    const valor = this.textoDigitado();
    return typeof valor === 'string' && valor.trim().length >= MIN_LETRAS_BUSCA ? valor : null;
  });

  protected readonly sugestoes = computed(() => {
    const consulta = this.consulta();
    return consulta === null ? [] : this.alimentos.buscarPorNome(consulta).slice(0, LIMITE_SUGESTOES);
  });

  protected readonly semResultado = computed(() => this.consulta() !== null && this.sugestoes().length === 0);

  /** Como o campo mostra o alimento escolhido. */
  protected readonly exibir = (valor: string | Alimento | null): string => (typeof valor === 'string' ? valor : (valor?.nome ?? ''));

  protected readonly mensagemQuantidade = (): string => mensagemNumero(this.grupo.controls.quantidade);

  protected adicionar(): void {
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
