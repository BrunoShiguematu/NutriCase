import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { NutrienteMeta } from '../../../core/avaliacao/avaliar-dieta';
import { AlimentoService } from '../../../core/services/alimento.service';
import { CasoService } from '../../../core/services/caso.service';
import { ResolucaoService, ResultadoResolucao, TIPOS_ERRO } from '../../../core/services/resolucao.service';
import { CAMPOS_DA_ETAPA, comSinal, formatarNumero } from '../etapas-ui';

const NUTRIENTES: Record<NutrienteMeta, { rotulo: string; unidade: string }> = {
  kcal: { rotulo: 'Energia', unidade: 'kcal' },
  cho: { rotulo: 'Carboidrato', unidade: 'g' },
  ptn: { rotulo: 'Proteína', unidade: 'g' },
  lip: { rotulo: 'Gordura', unidade: 'g' },
};

/** "conversão de unidade" → "Conversão de unidade". */
const comInicial = (texto: string): string => texto.charAt(0).toUpperCase() + texto.slice(1);

/**
 * Resultado de uma tentativa submetida (UC08, RF21–RF27, RF32–RF36), em um bloco com título (RF33):
 * "Avaliação" (as etapas, a dieta, o resumo dos erros, a justificativa e o comentário do caso, quando o caso tem um).
 *
 * A classificação aparece sempre em texto, nunca só em cor (RNF04). As etapas vêm da avaliação gravada na
 * submissão; a dieta é recalculada agora (por isso espera a base de alimentos). Uma tentativa que ainda não foi
 * submetida volta para a tela de resolver, e um endereço que não existe mostra uma mensagem.
 */
@Component({
  selector: 'app-resultado',
  standalone: false,
  styleUrl: './resultado.component.scss',
  templateUrl: './resultado.component.html',
})
export class ResultadoComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(ResolucaoService);
  private readonly casos = inject(CasoService);
  private readonly alimentos = inject(AlimentoService);
  private readonly snackBar = inject(MatSnackBar);

  private readonly id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))), { requireSync: true });

  protected readonly resolucao = computed(() => {
    const id = this.id();
    return id ? this.service.buscar(id) : undefined;
  });

  /** Só o status: o objeto da tentativa é novo a cada gravação, e o resultado não deve ser recarregado por isso. */
  private readonly status = computed(() => this.resolucao()?.status);

  protected readonly carregando = signal(true);
  protected readonly resultado = signal<ResultadoResolucao | undefined>(undefined);
  protected readonly estadoAlimentos = this.alimentos.estado;

  /** `em-andamento`: ainda não foi submetida (volta para o resolver); `indisponivel`: não dá para montar o resultado. */
  protected readonly estado = computed<'nao-encontrada' | 'em-andamento' | 'carregando' | 'indisponivel' | 'pronto'>(() => {
    if (!this.resolucao()) {
      return 'nao-encontrada';
    }
    if (this.status() === 'em andamento') {
      return 'em-andamento';
    }
    if (this.carregando()) {
      return 'carregando';
    }
    return this.resultado() ? 'pronto' : 'indisponivel';
  });

  protected readonly titulo = computed(() => {
    const resolucao = this.resolucao();
    return resolucao ? (this.casos.buscarPorId(resolucao.casoId)?.caso.titulo ?? '') : '';
  });

  protected readonly tolerancia = computed(() => {
    const resolucao = this.resolucao();
    return resolucao ? this.casos.buscarPorId(resolucao.casoId)?.caso.toleranciaDieta : undefined;
  });

  /** As 5 etapas: o que o estudante respondeu, o esperado a partir disso e a classificação (RF21–RF23). */
  protected readonly etapas = computed(() =>
    (this.resultado()?.etapas ?? []).map(({ etapa, resposta, avaliacao }) => {
      const campos = CAMPOS_DA_ETAPA[etapa.tipo];
      const classificacao = avaliacao.classificacao;
      return {
        numero: etapa.ordem,
        titulo: campos.titulo,
        parametro: this.valorComUnidade(resposta.parametro, campos.parametroUnidade),
        valor: this.valorComUnidade(resposta.valor, campos.valorUnidade),
        esperado: avaliacao.valorEsperado === undefined ? undefined : this.valorComUnidade(avaliacao.valorEsperado, campos.valorUnidade, 2),
        classificacao:
          classificacao === 'erro de fato'
            ? `Erro de fato: ${avaliacao.tipoErro ?? 'tipo não informado'}`
            : classificacao === 'divergente'
              ? 'Aceitável' // o valor interno continua 'divergente'; só o texto da tela muda
              : comInicial(classificacao ?? 'não avaliada'),
        classe: (classificacao ?? 'nao-avaliada').replace(/ /g, '-'),
        divergente: classificacao === 'divergente',
        erro: classificacao === 'erro de fato',
        criterio: etapa.criterioReferencia,
        motivo: avaliacao.motivo,
      };
    }),
  );

  protected readonly colunasEtapas = ['etapa', 'parametro', 'valor', 'esperado', 'classificacao'];
  protected readonly colunasComparativo = ['nutriente', 'total', 'meta', 'diferenca', 'situacao'];
  protected readonly colunasResumo = ['tipo', 'quantidade'];

  /** Cada etapa é uma linha; a divergente ou com erro ganha logo depois uma linha de detalhe (critério e explicação). */
  protected readonly linhasEtapas = computed(() =>
    this.etapas().flatMap((etapa) =>
      etapa.divergente || etapa.erro ? [{ etapa, detalhe: false }, { etapa, detalhe: true }] : [{ etapa, detalhe: false }],
    ),
  );
  protected readonly ehDetalhe = (_indice: number, linha: { detalhe: boolean }): boolean => linha.detalhe;

  /** O comparativo da dieta com as metas do estudante (RF24, RN05). */
  protected readonly comparativo = computed(() =>
    (this.resultado()?.dieta?.comparativo ?? []).map((c) => {
      const { rotulo, unidade } = NUTRIENTES[c.nutriente];
      return {
        nutriente: c.nutriente,
        rotulo,
        total: this.valorComUnidade(c.total, unidade),
        meta: c.meta === undefined ? undefined : this.valorComUnidade(c.meta, unidade),
        diferenca: c.meta === undefined ? undefined : `${comSinal(c.total - c.meta)} ${unidade}`,
        percentual: c.diferencaPercentual === undefined ? undefined : `${comSinal(c.diferencaPercentual)} %`,
        situacao: c.situacao === 'sem meta' ? 'Sem meta' : c.dentroDaTolerancia ? 'Dentro da tolerância' : 'Fora da tolerância',
        dentro: c.situacao === 'dentro',
        fora: c.situacao === 'fora',
      };
    }),
  );

  protected readonly alertas = computed(() =>
    (this.resultado()?.dieta?.alertas ?? []).map((a) => ({ tipo: comInicial(a.tipo), texto: a.texto })),
  );

  protected readonly itensIncompletos = computed(() => this.resultado()?.dieta?.totais.itensIncompletos.length ?? 0);

  /** Os 5 tipos de erro da RF34, cada um com a contagem (inclusive 0). */
  protected readonly resumo = computed(() => {
    const resumo = this.resultado()?.resumoErros;
    return TIPOS_ERRO.map((tipo) => ({ tipo: comInicial(tipo), quantidade: resumo ? resumo[tipo] : 0 }));
  });

  protected readonly justificativa = computed(() => this.resultado()?.resolucao.justificativa.trim() ?? '');

  constructor() {
    effect(() => {
      const id = this.id();
      const status = this.status();
      if (!id) {
        return;
      }
      if (status === 'submetida') {
        // O resultado lê signals dos serviços; dentro do effect isso viraria dependência dele.
        untracked(() => void this.carregar(id));
      } else if (status === 'em andamento') {
        void this.router.navigate(['/resolucoes', id], { replaceUrl: true });
      }
    });
  }

  /** Espera a base de alimentos (o serviço faz isso) e guarda o resultado; ignora a resposta se a tela já mudou de tentativa. */
  private async carregar(id: string): Promise<void> {
    this.carregando.set(true);
    const resultado = await this.service.resultado(id);
    if (this.id() !== id) {
      return;
    }
    this.resultado.set(resultado);
    this.carregando.set(false);
  }

  /** Tenta carregar a base de alimentos de novo e recalcula a dieta. */
  protected async tentarDeNovo(): Promise<void> {
    const id = this.id();
    if (id) {
      await this.alimentos.carregar();
      await this.carregar(id);
    }
  }

  /** Começa uma nova tentativa do mesmo caso (RF35) e abre a tela de resolver dela. */
  protected refazer(): void {
    const id = this.id();
    const nova = id ? this.service.refazer(id) : undefined;
    if (!nova) {
      this.snackBar.open('Não foi possível refazer: o caso não existe mais', 'Fechar', { duration: 4000 });
      return;
    }
    void this.router.navigate(['/resolucoes', nova.id]);
  }

  private valorComUnidade(valor: string | number, unidade?: string, casas = 2): string {
    const texto = typeof valor === 'number' ? formatarNumero(valor, casas) : valor;
    return unidade ? `${texto} ${unidade}` : texto;
  }
}
