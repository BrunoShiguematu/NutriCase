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

/**
 * Passo "Etapas" da resolução: uma etapa por vez (RF07), com Anterior e Próxima (RF10) e, no fim, o
 * resumo das 5 respostas. O que o estudante respondeu é salvo no `ResolucaoService` ao avançar, ao voltar
 * e ao sair do passo (`salvarAtual`); uma resposta com formato inválido não é salva e mostra o erro.
 *
 * Nada aqui diz se uma resposta está certa ou errada (RF09): só o formato é conferido, e a classificação
 * só existe depois da submissão. Os formulários ficam na memória enquanto a tela está aberta, então voltar
 * mostra o que já foi digitado, e abrir a tentativa de novo mostra o que foi salvo.
 */
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

  /** Sempre as 3 equações, não só as aceitas pelo caso: qual vale é do resultado. */
  protected readonly equacoes = [...EQUACOES_TMB];
  protected readonly campos = CAMPOS_DA_ETAPA;

  /** Campos em que o navegador recusou o que foi digitado (texto no lugar de número). */
  private readonly comTextoRecusado = new Set<AbstractControl>();

  private readonly ordenadas = computed(() => [...this.etapas()].sort((a, b) => a.ordem - b.ordem));

  /**
   * Muda só quando a tentativa ou as etapas mudam de verdade. O objeto da tentativa é novo a cada gravação,
   * então os formulários não podem depender dele: seriam refeitos e perderiam o que está sendo digitado.
   */
  private readonly chave = computed(() => `${this.resolucao().id}|${this.ordenadas().map((e) => e.id).join(',')}`);

  protected readonly formularios = computed(() => {
    this.chave();
    return untracked(() => this.montarFormularios());
  });

  /** 0 a N−1: as etapas. N: o resumo. Volta ao começo se a tentativa ou as etapas mudarem. */
  protected readonly indice = linkedSignal<string, number>({ source: this.chave, computation: () => 0 });
  protected readonly total = computed(() => this.ordenadas().length);
  protected readonly noResumo = computed(() => this.indice() >= this.total());

  /** A etapa na tela, em lista de um item para a tela ser refeita a cada etapa (formulário novo, estado novo). */
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

  /** Do resumo, leva de volta à etapa para alterar a resposta. */
  protected irPara(indice: number): void {
    this.indice.set(indice);
  }

  /**
   * Abre a etapa de número `numero` (1 a N, o mesmo "Etapa 3" que a tela e as pendências dizem). O que estava
   * sendo digitado na etapa da tela é salvo antes, se estiver válido. Número fora de 1 a N não faz nada.
   */
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

  /**
   * Salva a etapa que está na tela, se foi alterada e está válida. O resolver chama isto ao sair do passo
   * (pelo cabeçalho do stepper). Quem sai sem ter mexido não é obrigado a terminar a etapa e não vê aviso; mas
   * se mexeu e o valor é inválido, a resposta não é salva e o aviso diz isso, em vez de falhar em silêncio
   * (a pendência do Revisar apareceria sem explicação). Os campos ficam marcados, para o erro aparecer na volta.
   */
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

  /** Guarda, a cada tecla, se o navegador recusou o texto digitado no campo (veja `textoNaoNumerico`). */
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

  /**
   * Salva o formulário da etapa quando está válido e foi alterado. Devolve `true` quando a etapa está salva
   * (agora ou antes) e `false` quando não dá: formato inválido, ou o serviço recusou (aí avisa, se `avisar`).
   */
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
