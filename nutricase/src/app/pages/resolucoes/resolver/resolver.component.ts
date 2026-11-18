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
import { DestinoDaPendencia } from '../etapas-ui';
import { PassoJustificativaComponent } from '../passo-justificativa/passo-justificativa.component';
import { ResolucaoService } from '../../../core/services/resolucao.service';

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

const PASSO_ETAPAS = 0;
const PASSO_JUSTIFICATIVA = 2;

const ROTULO_FAIXA: Partial<Record<TipoEtapa, string>> = {
  GET: 'Fator de atividade (GET)',
  CHO: 'Carboidrato (g/kg/dia)',
  PTN: 'Proteína (g/kg/dia)',
  LIP: 'Gordura (g/kg/dia)',
};

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

  protected readonly etapas = computed(() => {
    const doCaso = this.doCaso();
    return doCaso ? this.casoService.listarEtapas(doCaso.caso.id) : [];
  });

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
    effect(() => {
      const resolucao = this.resolucao();
      if (resolucao?.status === 'submetida') {
        void this.router.navigate(['/resolucoes', resolucao.id, 'resultado'], { replaceUrl: true });
      }
    });
  }

  protected aoMudarPasso(evento: StepperSelectionEvent): void {
    if (evento.previouslySelectedIndex === PASSO_ETAPAS) {
      this.passoEtapas()?.salvarAtual();
    } else if (evento.previouslySelectedIndex === PASSO_JUSTIFICATIVA) {
      this.passoJustificativa()?.salvarAtual();
    }
  }

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
