import { Component, computed, inject, input, linkedSignal, signal, untracked } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EQUACOES_TMB } from '../../../core/avaliacao/formulas';
import { EtapaCalculo, Resolucao } from '../../../core/models';
import { ResolucaoService } from '../../../core/services/resolucao.service';
import { CAMPOS_DA_ETAPA, dentroDaFaixa, FAIXAS_USUAIS, MENSAGEM_TEXTO_NAO_NUMERICO, mensagemNumero, numeroPositivo, textoNaoNumerico } from '../etapas-ui';

type FormEtapa = FormGroup<{
  parametro: FormControl<string | number | null>;
  valor: FormControl<number | null>;
}>;

@Component({
  selector: 'app-passo-etapas',
  standalone: false,
  styleUrl: './passo-etapas.component.scss',
  templateUrl: './passo-etapas.component.html',
})
export class PassoEtapasComponent {
  private readonly service = inject(ResolucaoService);
  private readonly snackBar = inject(MatSnackBar);

  readonly resolucao = input.required<Resolucao>();
  readonly etapas = input.required<readonly EtapaCalculo[]>();

  protected readonly equacoes = [...EQUACOES_TMB];
  protected readonly campos = CAMPOS_DA_ETAPA;

  private readonly comTextoRecusado = new Set<AbstractControl>();

  private readonly ordenadas = computed(() => [...this.etapas()].sort((a, b) => a.ordem - b.ordem));

  private readonly chave = computed(() => `${this.resolucao().id}|${this.ordenadas().map((e) => e.id).join(',')}`);

  protected readonly formularios = computed(() => {
    this.chave();
    return untracked(() => this.montarFormularios());
  });

  protected readonly indice = linkedSignal<string, number>({ source: this.chave, computation: () => 0 });
  protected readonly total = computed(() => this.ordenadas().length);
  protected readonly noResumo = computed(() => this.indice() >= this.total());

  protected readonly etapaVisivel = computed(() => {
    const etapa = this.ordenadas()[this.indice()];
    return etapa ? [etapa] : [];
  });

  protected readonly resumo = computed(() => {
    const respostas = this.service.listarRespostas(this.resolucao().id);
    return this.ordenadas().map((etapa, indice) => {
      const resposta = respostas.find((r) => r.etapaId === etapa.id);
      const campos = CAMPOS_DA_ETAPA[etapa.tipo];
      return {
        indice,
        numero: indice + 1,
        titulo: campos.titulo,
        parametroRotulo: campos.parametroRotulo,
        valorRotulo: campos.valorRotulo,
        parametro: resposta ? this.formatar(resposta.parametro, campos.parametroUnidade) : undefined,
        valor: resposta ? this.formatar(resposta.valor, campos.valorUnidade) : undefined,
      };
    });
  });

  protected formulario(indice: number): FormEtapa {
    return this.formularios()[indice];
  }

  protected avancar(): void {
    const indice = this.indice();
    const form = this.formularios()[indice];
    if (!form) {
      return;
    }
    form.markAllAsTouched();
    if (!this.salvarFormulario(indice, true)) {
      return;
    }
    this.indice.set(indice + 1);
  }

  protected voltar(): void {
    const indice = this.indice();
    if (indice === 0) {
      return;
    }
    if (!this.noResumo()) {
      this.salvarFormulario(indice, false);
    }
    this.indice.set(indice - 1);
  }

  protected irPara(indice: number): void {
    this.indice.set(indice);
  }

  abrirEtapa(numero: number): void {
    const destino = numero - 1;
    if (!Number.isInteger(numero) || destino < 0 || destino >= this.total()) {
      return;
    }
    if (!this.noResumo() && destino !== this.indice()) {
      this.salvarFormulario(this.indice(), false);
    }
    this.indice.set(destino);
  }

  salvarAtual(): void {
    if (this.noResumo()) {
      return;
    }
    const indice = this.indice();
    const form = this.formularios()[indice];
    if (!this.salvarFormulario(indice, true) && form?.invalid && form.dirty) {
      form.markAllAsTouched();
      this.snackBar.open(`A etapa ${indice + 1} não foi salva: há valores inválidos. Volte ao passo Etapas para corrigir.`, 'Fechar', {
        duration: 6000,
      });
    }
  }

  protected conferirTexto(controle: AbstractControl, evento: Event): void {
    if (textoNaoNumerico(evento)) {
      this.comTextoRecusado.add(controle);
    } else {
      this.comTextoRecusado.delete(controle);
    }
  }

  protected mensagem(controle: AbstractControl, ehEquacao: boolean): string {
    if (ehEquacao) {
      return controle.hasError('required') ? 'Escolha uma equação' : mensagemNumero(controle);
    }
    if (controle.hasError('required') && this.comTextoRecusado.has(controle)) {
      return MENSAGEM_TEXTO_NAO_NUMERICO;
    }
    return mensagemNumero(controle);
  }

  private salvarFormulario(indice: number, avisar: boolean): boolean {
    const form = this.formularios()[indice];
    const etapa = this.ordenadas()[indice];
    if (!form || !etapa || form.invalid) {
      return false;
    }
    if (!form.dirty) {
      return true;
    }
    const { parametro, valor } = form.getRawValue();
    const salva = this.service.salvarResposta(this.resolucao().id, etapa.id, parametro as string | number, valor as number);
    if (!salva) {
      if (avisar) {
        this.snackBar.open('Não foi possível salvar a resposta', 'Fechar', { duration: 4000 });
      }
      return false;
    }
    form.markAsPristine();
    return true;
  }

  private montarFormularios(): FormEtapa[] {
    const respostas = this.service.listarRespostas(this.resolucao().id);
    return this.ordenadas().map((etapa) => {
      const salva = respostas.find((r) => r.etapaId === etapa.id);
      const ehTmb = etapa.tipo === 'TMB';
      const faixas = FAIXAS_USUAIS[etapa.tipo];
      return new FormGroup({
        parametro: new FormControl<string | number | null>(salva?.parametro ?? (ehTmb ? '' : null), {
          validators: ehTmb ? [Validators.required] : [Validators.required, numeroPositivo, dentroDaFaixa(faixas.parametro!)],
        }),
        valor: new FormControl<number | null>(salva?.valor ?? null, {
          validators: [Validators.required, numeroPositivo, dentroDaFaixa(faixas.valor)],
        }),
      });
    });
  }

  private formatar(valor: string | number, unidade?: string): string {
    const texto = typeof valor === 'number' ? valor.toLocaleString('pt-BR') : valor;
    return unidade ? `${texto} ${unidade}` : texto;
  }
}
