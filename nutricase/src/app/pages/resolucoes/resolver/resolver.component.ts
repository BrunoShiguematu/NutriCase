import { StepperSelectionEvent } from '@angular/cdk/stepper';
import { Component, computed, effect, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatStepper } from '@angular/material/stepper';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { EquacaoTmb, EQUACOES_TMB } from '../../../core/avaliacao/formulas';
import { TipoEtapa } from '../../../core/models';
import { CasoService } from '../../../core/services/caso.service';
import { PassoEtapasComponent } from '../passo-etapas/passo-etapas.component';
import { DestinoDaPendencia } from '../passo-revisar/passo-revisar.component';
import { PassoJustificativaComponent } from '../passo-justificativa/passo-justificativa.component';
import { ResolucaoService } from '../../../core/services/resolucao.service';

/**
 * Material de referência (RF06): as três equações de TMB, com a fonte e a fórmula em texto. Todas aparecem
 * do mesmo jeito: qual vale como referência do caso só aparece no resultado. Equações e valores aguardam
 * validação docente.
 */
const EQUACOES_REFERENCIA: Record<EquacaoTmb, { fonte: string; formulas: string[] }> = {
  'Harris-Benedict revisada': {
    fonte: 'Roza e Shizgal, 1984',
    formulas: [
      'Homem: 88,362 + 13,397 × peso + 4,799 × altura − 5,677 × idade',
      'Mulher: 447,593 + 9,247 × peso + 3,098 × altura − 4,330 × idade',
    ],
  },
  'Mifflin-St Jeor': {
    fonte: 'Mifflin e colaboradores, 1990',
    formulas: ['10 × peso + 6,25 × altura − 5 × idade + 5 (homem) ou − 161 (mulher)'],
  },
  Cunningham: {
    fonte: 'Cunningham, 1980',
    formulas: [
      '500 + 22 × massa livre de gordura',
      'Massa livre de gordura = peso × (1 − percentual de gordura ÷ 100). Exige o percentual de gordura do atleta.',
    ],
  },
};

/** Posição dos passos no stepper. */
const PASSO_ETAPAS = 0;
const PASSO_JUSTIFICATIVA = 2;

const ROTULO_FAIXA: Partial<Record<TipoEtapa, string>> = {
  GET: 'Fator de atividade (GET)',
  CHO: 'Carboidrato (g/kg/dia)',
  PTN: 'Proteína (g/kg/dia)',
  LIP: 'Gordura (g/kg/dia)',
};

/** Tela de resolução de um caso (`/resolucoes/:id`): ficha do atleta, material de referência e o passo a passo. */
@Component({
  selector: 'app-resolver',
  standalone: false,
  styleUrl: './resolver.component.scss',
  templateUrl: './resolver.component.html',
})
export class ResolverComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly resolucaoService = inject(ResolucaoService);
  private readonly casoService = inject(CasoService);

  /** Ids das rotas vêm do `paramMap`, que muda se a mesma tela abrir outra tentativa. */
  private readonly id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))), { requireSync: true });

  protected readonly equacoes = EQUACOES_TMB.map((nome) => ({ nome, ...EQUACOES_REFERENCIA[nome] }));

  protected readonly resolucao = computed(() => {
    const id = this.id();
    return id ? this.resolucaoService.buscar(id) : undefined;
  });

  protected readonly doCaso = computed(() => {
    const resolucao = this.resolucao();
    return resolucao ? this.casoService.buscarPorId(resolucao.casoId) : undefined;
  });

  /** As 5 etapas do caso, na ordem; alimentam o passo Etapas e o material de referência. */
  protected readonly etapas = computed(() => {
    const doCaso = this.doCaso();
    return doCaso ? this.casoService.listarEtapas(doCaso.caso.id) : [];
  });

  /**
   * Faixas aceitáveis das etapas numéricas do caso, para o material de referência. Só a faixa: a referência
   * do caso e o critério ficam para o resultado.
   */
  protected readonly faixas = computed(() =>
    this.etapas()
      .filter((etapa) => etapa.faixaAceitavel !== undefined)
      .map((etapa) => ({
        rotulo: ROTULO_FAIXA[etapa.tipo] ?? etapa.tipo,
        faixa: `${this.numero(etapa.faixaAceitavel!.min)} a ${this.numero(etapa.faixaAceitavel!.max)}`,
      })),
  );

  private readonly stepper = viewChild(MatStepper);
  private readonly passoEtapas = viewChild(PassoEtapasComponent);
  private readonly passoJustificativa = viewChild(PassoJustificativaComponent);

  /** `nao-encontrada`: id que não existe; `sem-caso`: o caso foi excluído; `submetida`: vai para o resultado. */
  protected readonly estado = computed<'nao-encontrada' | 'sem-caso' | 'submetida' | 'pronta'>(() => {
    const resolucao = this.resolucao();
    if (!resolucao) {
      return 'nao-encontrada';
    }
    if (resolucao.status === 'submetida') {
      return 'submetida';
    }
    return this.doCaso() ? 'pronta' : 'sem-caso';
  });

  constructor() {
    // Tentativa submetida não se edita: abre o resultado no lugar (e o botão Voltar não volta para cá).
    effect(() => {
      const resolucao = this.resolucao();
      if (resolucao?.status === 'submetida') {
        void this.router.navigate(['/resolucoes', resolucao.id, 'resultado'], { replaceUrl: true });
      }
    });
  }

  /** Ao sair de um passo que tem rascunho (Etapas ou Justificativa), salva o que estava na tela. */
  protected aoMudarPasso(evento: StepperSelectionEvent): void {
    if (evento.previouslySelectedIndex === PASSO_ETAPAS) {
      this.passoEtapas()?.salvarAtual();
    } else if (evento.previouslySelectedIndex === PASSO_JUSTIFICATIVA) {
      this.passoJustificativa()?.salvarAtual();
    }
  }

  /** Leva ao passo pedido e, numa pendência de etapa, abre essa etapa (as pendências do passo Revisar usam isto). */
  protected irParaPasso(destino: DestinoDaPendencia): void {
    const stepper = this.stepper();
    if (stepper) {
      stepper.selectedIndex = destino.passo;
    }
    const ordem = destino.etapaId ? this.etapas().find((e) => e.id === destino.etapaId)?.ordem : undefined;
    if (ordem !== undefined) {
      this.passoEtapas()?.abrirEtapa(ordem);
    }
  }

  protected numero(valor: number): string {
    return valor.toLocaleString('pt-BR');
  }
}
