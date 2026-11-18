import { Component, computed, EventEmitter, inject, input, Output, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, FormGroupDirective, ValidationErrors, Validators } from '@angular/forms';
import { debounceTime } from 'rxjs';
import { Alimento } from '../../../../core/models';
import { AlimentoService, grauDaBusca, nomeContem } from '../../../../core/services/alimento.service';
import { mensagemNumero, numeroPositivo } from '../../etapas-ui';

export const LIMITE_SUGESTOES = 10;
export const MIN_LETRAS_BUSCA = 3;
export const PAUSA_DA_BUSCA_MS = 300;

export interface InclusaoDeItem {
  alimentoId: string;
  quantidadeGramas: number;
}

function alimentoEscolhido(controle: AbstractControl): ValidationErrors | null {
  const valor: unknown = controle.value;
  return typeof valor === 'object' && valor !== null ? null : { escolha: true };
}

@Component({
  selector: 'app-busca-alimento',
  standalone: false,
  styleUrl: './busca-alimento.component.scss',
  templateUrl: './busca-alimento.component.html',
})
export class BuscaAlimentoComponent {
  private readonly alimentos = inject(AlimentoService);

  readonly jaNaRefeicao = input<readonly string[]>([]);

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

  protected readonly limite = LIMITE_SUGESTOES;

  protected readonly sugestoes = computed(() => {
    const consulta = this.consulta();
    if (consulta === null) {
      return { itens: [], total: 0, leite: false };
    }
    const achados = this.alimentos
      .buscarPorNome(consulta)
      .map((alimento) => ({ alimento, grau: grauDaBusca(alimento.nome, consulta) }))
      .sort((a, b) => a.grau - b.grau || a.alimento.nome.localeCompare(b.alimento.nome, 'pt-BR'));
    return { itens: achados.slice(0, LIMITE_SUGESTOES).map(({ alimento }) => alimento), total: achados.length, leite: nomeContem(consulta, 'leite') };
  });

  protected readonly semResultado = computed(() => this.consulta() !== null && this.sugestoes().total === 0);

  protected readonly exibir = (valor: string | Alimento | null): string => (typeof valor === 'string' ? valor : (valor?.nome ?? ''));

  protected readonly mensagemBusca = (): string =>
    this.grupo.controls.busca.hasError('repetido') ? 'Este alimento já está nesta refeição. Edite a quantidade.' : 'Escolha um alimento da lista';

  protected readonly mensagemQuantidade = (): string => mensagemNumero(this.grupo.controls.quantidade);

  private alimentoRepetido(controle: AbstractControl): ValidationErrors | null {
    const valor: unknown = controle.value;
    return typeof valor === 'object' && valor !== null && this.jaNaRefeicao().includes((valor as Alimento).id) ? { repetido: true } : null;
  }

  protected adicionar(): void {
    this.grupo.controls.busca.updateValueAndValidity();
    this.grupo.markAllAsTouched();
    const { busca, quantidade } = this.grupo.getRawValue();
    if (this.grupo.invalid || typeof busca === 'string' || quantidade === null) {
      return;
    }
    this.incluir.emit({ alimentoId: busca.id, quantidadeGramas: quantidade });
    this.formulario()?.resetForm({ busca: '', quantidade: null });
  }
}
