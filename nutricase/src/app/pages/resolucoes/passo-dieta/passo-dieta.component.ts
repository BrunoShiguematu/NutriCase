import { Component, computed, inject, input, signal, viewChild } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, FormGroupDirective, ValidationErrors, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { avaliarDieta, MetasDoAluno, NutrienteMeta, totaisDaDieta } from '../../../core/avaliacao/avaliar-dieta';
import { Alimento, ItemRefeicao, MarcadorRefeicao, Refeicao, Resolucao, TipoEtapa } from '../../../core/models';
import { AlimentoService } from '../../../core/services/alimento.service';
import { CasoService } from '../../../core/services/caso.service';
import { ResolucaoService } from '../../../core/services/resolucao.service';
import { InclusaoDeItem } from './busca-alimento/busca-alimento.component';
import {
  ConfirmarExclusaoRefeicaoComponent,
  DadosConfirmarExclusaoRefeicao,
} from './confirmar-exclusao-refeicao/confirmar-exclusao-refeicao.component';
import { comSinal, formatarNumero, mensagemNumero, numeroPositivo } from '../etapas-ui';

const HORARIO = /^([01]\d|2[0-3]):[0-5]\d$/;

const MARCADORES: { valor: MarcadorRefeicao; rotulo: string }[] = [
  { valor: 'nenhum', rotulo: 'Nenhum' },
  { valor: 'pré-treino', rotulo: 'Pré-treino' },
  { valor: 'pós-treino', rotulo: 'Pós-treino' },
];

/** Cada meta do estudante vem de uma etapa: GET → kcal; CHO, PTN e LIP → gramas (RN05). */
const ETAPA_DA_META: Record<NutrienteMeta, TipoEtapa> = { kcal: 'GET', cho: 'CHO', ptn: 'PTN', lip: 'LIP' };
const ROTULO_NUTRIENTE: Record<NutrienteMeta, { rotulo: string; unidade: string }> = {
  kcal: { rotulo: 'Energia', unidade: 'kcal' },
  cho: { rotulo: 'Carboidrato', unidade: 'g' },
  ptn: { rotulo: 'Proteína', unidade: 'g' },
  lip: { rotulo: 'Gordura', unidade: 'g' },
};

/** Horário "HH:mm", de 00:00 a 23:59. Vazio é com o `required`. */
function horarioValido(controle: AbstractControl): ValidationErrors | null {
  const valor = String(controle.value ?? '');
  return valor === '' || HORARIO.test(valor) ? null : { horario: true };
}

/** Texto que não pode ser só espaços. */
function textoObrigatorio(controle: AbstractControl): ValidationErrors | null {
  return String(controle.value ?? '').trim() === '' ? { required: true } : null;
}

/**
 * Passo "Dieta" da resolução: o estudante monta as refeições (nome, horário e marcador), inclui alimentos da
 * TACO com a quantidade em gramas, vê os totais por refeição e do dia (RF16) e compara o total do dia com as
 * metas que ele mesmo calculou nas etapas (RF17).
 *
 * Nada aqui diz se a dieta está certa (RF09): o comparativo mostra só números e a diferença, e os alertas e a
 * tolerância do caso ficam para o resultado. Tudo é salvo no `ResolucaoService` na hora; a tela só reflete o
 * que está salvo.
 */
@Component({
  selector: 'app-passo-dieta',
  standalone: false,
  styleUrl: './passo-dieta.component.scss',
  templateUrl: './passo-dieta.component.html',
})
export class PassoDietaComponent {
  private readonly service = inject(ResolucaoService);
  private readonly alimentos = inject(AlimentoService);
  private readonly casos = inject(CasoService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly resolucao = input.required<Resolucao>();

  protected readonly marcadores = MARCADORES;
  protected readonly estadoAlimentos = this.alimentos.estado;

  /** Formulário de nova refeição; vira o de edição quando `editandoId` tem uma refeição. */
  protected readonly formRefeicao = new FormGroup({
    nome: new FormControl('', { nonNullable: true, validators: [textoObrigatorio] }),
    horario: new FormControl('', { nonNullable: true, validators: [Validators.required, horarioValido] }),
    marcador: new FormControl<MarcadorRefeicao>('nenhum', { nonNullable: true }),
  });
  protected readonly editandoId = signal<string | null>(null);
  private readonly formularioRefeicao = viewChild<FormGroupDirective>('formularioRefeicao');

  /** Um formulário por item, para a quantidade poder ser editada no lugar e mostrar o seu erro. */
  private readonly formulariosDosItens = new Map<string, FormGroup<{ quantidade: FormControl<number | null> }>>();

  private readonly resolucaoId = computed(() => this.resolucao().id);
  private readonly refeicoes = computed(() => this.service.listarRefeicoes(this.resolucaoId()));
  private readonly itens = computed(() => this.service.listarItensDaResolucao(this.resolucaoId()));
  private readonly etapas = computed(() => this.casos.listarEtapas(this.resolucao().casoId));

  /** Totais por refeição e do dia, a cada mudança (RF16). */
  protected readonly totais = computed(() => totaisDaDieta(this.refeicoes(), this.itens(), this.alimentos.alimentos()));

  /** As refeições por horário, cada uma com os itens (já com o alimento) e os totais dela. */
  protected readonly cartoes = computed(() => {
    const totais = this.totais();
    const incompletos = new Set(totais.itensIncompletos);
    const itens = this.itens();
    return [...this.refeicoes()]
      .sort((a, b) => a.horario.localeCompare(b.horario))
      .map((refeicao) => ({
        refeicao,
        rotuloMarcador: MARCADORES.find((m) => m.valor === refeicao.marcador)?.rotulo ?? '',
        itens: itens
          .filter((item) => item.refeicaoId === refeicao.id)
          .map((item) => ({ item, alimento: this.alimentos.buscarPorId(item.alimentoId) as Alimento | undefined, incompleto: incompletos.has(item.id) })),
        alimentoIds: itens.filter((item) => item.refeicaoId === refeicao.id).map((item) => item.alimentoId),
        totais: totais.porRefeicao.find((r) => r.refeicaoId === refeicao.id)?.totais ?? { kcal: 0, cho: 0, ptn: 0, lip: 0 },
      }));
  });

  /** As metas do estudante, das respostas salvas nas etapas; ausente se a etapa ainda não foi respondida. */
  private readonly metas = computed<MetasDoAluno>(() => {
    const respostas = this.service.listarRespostas(this.resolucaoId());
    const etapas = this.etapas();
    const valorDe = (tipo: TipoEtapa): number | undefined => {
      const etapa = etapas.find((e) => e.tipo === tipo);
      return respostas.find((r) => r.etapaId === etapa?.id)?.valor;
    };
    return { kcal: valorDe('GET'), cho: valorDe('CHO'), ptn: valorDe('PTN'), lip: valorDe('LIP') };
  });

  protected readonly colunasComparativo = ['nutriente', 'total', 'meta', 'diferenca'];

  /**
   * Total do dia contra a meta do estudante (RF17): só números e a diferença. Usa o mesmo motor do resultado,
   * então os números aqui e lá são os mesmos, mas lê apenas total, meta e diferença: a situação ("dentro" ou
   * "fora"), os alertas e a tolerância do caso não passam daqui (RF09).
   */
  protected readonly comparativo = computed(() => {
    const doCaso = this.casos.buscarPorId(this.resolucao().casoId);
    const avaliacao = avaliarDieta(
      this.refeicoes(),
      this.itens(),
      this.alimentos.alimentos(),
      this.metas(),
      doCaso?.caso ?? { toleranciaDieta: 0 },
      doCaso?.atleta ?? { restricoes: [] },
    );
    return avaliacao.comparativo.map((c) => {
      const { rotulo, unidade } = ROTULO_NUTRIENTE[c.nutriente];
      const etapa = this.etapas().find((e) => e.tipo === ETAPA_DA_META[c.nutriente]);
      return {
        nutriente: c.nutriente,
        rotulo,
        unidade,
        total: c.total,
        meta: c.meta,
        diferenca: c.meta === undefined ? undefined : c.total - c.meta,
        percentual: c.diferencaPercentual,
        /** Número da etapa que o estudante ainda precisa preencher para ter a meta. */
        etapaFaltante: c.meta === undefined ? etapa?.ordem : undefined,
      };
    });
  });

  constructor() {
    // A base de alimentos vem por import dinâmico; chamar de novo é barato (só o primeiro faz o trabalho).
    void this.alimentos.carregar();
  }

  protected tentarDeNovo(): void {
    void this.alimentos.carregar();
  }

  // ---------- refeições ----------

  protected salvarRefeicao(): void {
    this.formRefeicao.markAllAsTouched();
    if (this.formRefeicao.invalid) {
      return;
    }
    const { nome, horario, marcador } = this.formRefeicao.getRawValue();
    const dados = { nome: nome.trim(), horario, marcador };
    const editando = this.editandoId();
    const salva = editando
      ? this.service.atualizarRefeicao(editando, dados)
      : this.service.criarRefeicao(this.resolucaoId(), dados);
    if (!salva) {
      this.snackBar.open('Não foi possível salvar a refeição', 'Fechar', { duration: 4000 });
      return;
    }
    this.limparFormulario();
  }

  protected editar(refeicao: Refeicao): void {
    this.editandoId.set(refeicao.id);
    this.formRefeicao.reset({ nome: refeicao.nome, horario: refeicao.horario, marcador: refeicao.marcador });
  }

  protected cancelarEdicao(): void {
    this.limparFormulario();
  }

  protected excluirRefeicao(refeicao: Refeicao): void {
    const itens = this.service.listarItens(refeicao.id);
    if (itens.length === 0) {
      this.apagarRefeicao(refeicao, itens);
      return;
    }
    this.dialog
      .open<ConfirmarExclusaoRefeicaoComponent, DadosConfirmarExclusaoRefeicao, boolean>(ConfirmarExclusaoRefeicaoComponent, {
        data: { nome: refeicao.nome, itens: itens.length },
      })
      .afterClosed()
      .subscribe((confirmou) => {
        if (confirmou === true) {
          this.apagarRefeicao(refeicao, itens);
        }
      });
  }

  // ---------- itens ----------

  protected incluirItem(refeicaoId: string, inclusao: InclusaoDeItem): void {
    if (!this.service.criarItem(refeicaoId, inclusao)) {
      this.snackBar.open('Não foi possível incluir o alimento', 'Fechar', { duration: 4000 });
    }
  }

  protected formularioDoItem(item: ItemRefeicao): FormGroup<{ quantidade: FormControl<number | null> }> {
    let formulario = this.formulariosDosItens.get(item.id);
    if (!formulario) {
      formulario = new FormGroup({
        quantidade: new FormControl<number | null>(item.quantidadeGramas, { validators: [Validators.required, numeroPositivo] }),
      });
      this.formulariosDosItens.set(item.id, formulario);
    }
    return formulario;
  }

  /** Salva a quantidade editada; com formato inválido não salva e o erro fica na tela. */
  protected alterarQuantidade(item: ItemRefeicao): void {
    const controle = this.formularioDoItem(item).controls.quantidade;
    controle.markAsTouched();
    if (controle.invalid || controle.value === item.quantidadeGramas) {
      return;
    }
    if (!this.service.atualizarItem(item.id, { quantidadeGramas: controle.value as number })) {
      this.snackBar.open('Não foi possível alterar a quantidade', 'Fechar', { duration: 4000 });
    }
  }

  protected removerItem(item: ItemRefeicao): void {
    if (this.service.excluirItem(item.id)) {
      this.formulariosDosItens.delete(item.id);
    }
  }

  // ---------- apresentação ----------

  protected mensagemQuantidade(controle: AbstractControl): string {
    return mensagemNumero(controle);
  }

  /** Números e diferenças como o resultado os mostra: as funções são as de `etapas-ui`. */
  protected readonly numero = formatarNumero;
  protected readonly comSinal = comSinal;

  private apagarRefeicao(refeicao: Refeicao, itens: ItemRefeicao[]): void {
    if (!this.service.excluirRefeicao(refeicao.id)) {
      this.snackBar.open('Não foi possível excluir a refeição', 'Fechar', { duration: 4000 });
      return;
    }
    itens.forEach((item) => this.formulariosDosItens.delete(item.id));
    if (this.editandoId() === refeicao.id) {
      this.limparFormulario();
    }
    this.snackBar.open('Refeição excluída', 'Fechar', { duration: 4000 });
  }

  private limparFormulario(): void {
    this.editandoId.set(null);
    // resetForm também zera o "enviado" do formulário; só o reset do grupo deixaria os campos limpos com erro.
    this.formularioRefeicao()?.resetForm({ nome: '', horario: '', marcador: 'nenhum' });
  }
}
