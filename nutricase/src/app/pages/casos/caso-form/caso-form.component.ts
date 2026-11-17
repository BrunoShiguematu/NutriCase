import { Component, ElementRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormArray, FormGroup, NonNullableFormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { EQUACOES_TMB } from '../../../core/avaliacao/formulas';
import { etapasPadrao, TIPOS_ETAPA } from '../../../core/data/casos-exemplo';
import { EtapaCalculo, Nivel, Sexo, TipoEtapa, TOLERANCIA_DIETA_PADRAO } from '../../../core/models';
import { CasoComAtleta, CasoService, DadosAtleta, DadosCaso } from '../../../core/services/caso.service';
import { CAMPOS_DA_ETAPA, mensagemNumero, numeroPositivo } from '../../resolucoes/etapas-ui';

/** Texto obrigatório: espaços sozinhos não valem. */
function textoObrigatorio(controle: AbstractControl): ValidationErrors | null {
  return String(controle.value ?? '').trim() === '' ? { required: true } : null;
}

/** Idade plausível de um atleta do catálogo, em anos inteiros (decisão da A5: de 10 a 100). */
export const IDADE_MINIMA = 10;
export const IDADE_MAXIMA = 100;

/** Número preenchido tem que ser inteiro (vazio é com o `required`). */
function inteiro(controle: AbstractControl): ValidationErrors | null {
  const valor = controle.value;
  return valor !== null && valor !== '' && !Number.isInteger(Number(valor)) ? { inteiro: true } : null;
}

const numeroOuNulo = (controle: AbstractControl | null | undefined): number | null =>
  typeof controle?.value === 'number' && Number.isFinite(controle.value) ? controle.value : null;

/** No campo da referência: tem que estar entre o mínimo e o máximo da mesma etapa (RN02). */
function referenciaNaFaixa(controle: AbstractControl): ValidationErrors | null {
  const referencia = numeroOuNulo(controle);
  const min = numeroOuNulo(controle.parent?.get('min'));
  const max = numeroOuNulo(controle.parent?.get('max'));
  if (referencia === null) {
    return null;
  }
  return (min !== null && referencia < min) || (max !== null && referencia > max) ? { foraDaFaixa: true } : null;
}

/** No campo do mínimo: não pode passar do máximo. */
function minimoAteMaximo(controle: AbstractControl): ValidationErrors | null {
  const min = numeroOuNulo(controle);
  const max = numeroOuNulo(controle.parent?.get('max'));
  return min !== null && max !== null && min > max ? { minMaiorQueMax: true } : null;
}

/** No campo do máximo: não pode ficar abaixo do mínimo. */
function maximoDesdeMinimo(controle: AbstractControl): ValidationErrors | null {
  const max = numeroOuNulo(controle);
  const min = numeroOuNulo(controle.parent?.get('min'));
  return min !== null && max !== null && max < min ? { maxMenorQueMin: true } : null;
}

/** O que o formulário guarda de cada etapa; TMB usa `opcoes`, as outras usam `min` e `max`. */
interface ValoresEtapa {
  referencia: string | number | null;
  opcoes: string[];
  min: number | null;
  max: number | null;
  tolerancia: number | null;
  criterio: string;
}

/** "a, b ,, c" vira ["a", "b", "c"]. */
function listaDeTexto(texto: string): string[] {
  return texto
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
}

const AVISO_ETAPAS = 'Caso salvo, mas não foi possível salvar as etapas';

/** Formulário de cadastro (`/casos/gestao/novo`) e edição (`/casos/gestao/:id/editar`) de caso e ficha do atleta. */
@Component({
  selector: 'app-caso-form',
  standalone: false,
  styleUrl: './caso-form.component.scss',
  templateUrl: './caso-form.component.html',
})
export class CasoFormComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly casoService = inject(CasoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly niveis: Nivel[] = ['Iniciante', 'Intermediário', 'Avançado'];
  protected readonly sexos: { valor: Sexo; rotulo: string }[] = [
    { valor: 'feminino', rotulo: 'Feminino' },
    { valor: 'masculino', rotulo: 'Masculino' },
  ];

  /** Id do caso em edição; `null` no cadastro. */
  protected readonly idEmEdicao = signal<string | null>(null);

  /** A rota de edição pediu um id que não existe: a tela mostra a mensagem em vez do formulário. */
  protected readonly naoEncontrado = signal(false);

  protected readonly idadeMinima = IDADE_MINIMA;
  protected readonly idadeMaxima = IDADE_MAXIMA;

  /** As 5 etapas, sempre nesta ordem (a mesma de `etapas` no formulário). */
  protected readonly tipos: readonly TipoEtapa[] = TIPOS_ETAPA;
  protected readonly campos = CAMPOS_DA_ETAPA;
  protected readonly equacoes: readonly string[] = EQUACOES_TMB;

  protected readonly form = this.fb.group({
    // Caso
    titulo: ['', textoObrigatorio],
    modalidade: ['', textoObrigatorio],
    nivel: this.fb.control<Nivel | ''>('', Validators.required),
    competencia: ['', textoObrigatorio],
    descricao: ['', textoObrigatorio],
    comentarioReferencia: [''],
    toleranciaDieta: this.fb.control<number | null>(TOLERANCIA_DIETA_PADRAO, [Validators.required, numeroPositivo]),
    // Etapas de cálculo (um grupo por tipo, na ordem de `tipos`)
    etapas: this.fb.array(TIPOS_ETAPA.map((tipo) => this.criarGrupoDaEtapa(tipo))),
    // Ficha do atleta
    nome: ['', textoObrigatorio],
    idade: this.fb.control<number | null>(null, [Validators.required, inteiro, Validators.min(IDADE_MINIMA), Validators.max(IDADE_MAXIMA)]),
    sexo: this.fb.control<Sexo | ''>('', Validators.required),
    peso: this.fb.control<number | null>(null, [Validators.required, numeroPositivo]),
    altura: this.fb.control<number | null>(null, [Validators.required, numeroPositivo]),
    percentualGordura: this.fb.control<number | null>(null, [numeroPositivo, Validators.max(100)]),
    volumeTreino: ['', textoObrigatorio],
    horarioTreino: ['', textoObrigatorio],
    fasePeriodizacao: ['', textoObrigatorio],
    objetivo: ['', textoObrigatorio],
    restricoes: [''],
    preferencias: [''],
  });

  protected get etapas(): FormArray<FormGroup> {
    return this.form.controls.etapas;
  }

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => this.carregar(params.get('id')));
  }

  protected salvar(): void {
    const dados = this.lerFormulario();
    if (this.form.invalid || !dados) {
      this.form.markAllAsTouched();
      this.focarPrimeiroErro();
      return;
    }

    const id = this.idEmEdicao();
    if (id === null) {
      const criado = this.casoService.criar(dados.caso, dados.atleta);
      this.avisar(this.gravarEtapas(criado.caso.id, dados.etapas) ? 'Caso criado' : AVISO_ETAPAS);
    } else if (this.casoService.atualizar(id, dados.caso, dados.atleta)) {
      this.avisar(this.gravarEtapas(id, dados.etapas) ? 'Caso atualizado' : AVISO_ETAPAS);
    } else {
      this.avisar('Caso não encontrado');
    }
    void this.router.navigate(['/casos/gestao']);
  }

  protected mensagemErro(campo: string): string {
    const erros = this.form.get(campo)?.errors;
    if (!erros) {
      return '';
    }
    if (erros['required']) {
      return 'Campo obrigatório';
    }
    if (campo === 'idade') {
      return erros['inteiro'] ? 'Informe a idade em anos inteiros' : `A idade deve estar entre ${IDADE_MINIMA} e ${IDADE_MAXIMA} anos`;
    }
    if (erros['positivo']) {
      return 'Informe um número maior que zero';
    }
    if (erros['max']) {
      return 'O valor máximo é 100';
    }
    return 'Valor inválido';
  }

  /** Mensagem de erro de um campo da etapa `indice`; só fala de formato e de coerência da faixa. */
  protected mensagemEtapa(indice: number, campo: keyof ValoresEtapa): string {
    const controle = this.etapas.at(indice).get(campo);
    if (!controle || !controle.errors) {
      return '';
    }
    if (controle.hasError('foraDaFaixa')) {
      return 'A referência deve estar entre o mínimo e o máximo';
    }
    if (controle.hasError('minMaiorQueMax')) {
      return 'O mínimo não pode ser maior que o máximo';
    }
    if (controle.hasError('maxMenorQueMin')) {
      return 'O máximo não pode ser menor que o mínimo';
    }
    if (campo === 'opcoes') {
      return 'Escolha pelo menos uma equação';
    }
    if (campo === 'referencia' && this.tipos[indice] === 'TMB') {
      return 'Escolha uma equação';
    }
    return mensagemNumero(controle) || 'Valor inválido';
  }

  /** Leva o foco ao primeiro campo com erro, na ordem em que aparecem na tela. */
  private focarPrimeiroErro(): void {
    this.elemento.nativeElement
      .querySelector<HTMLElement>('input.ng-invalid, textarea.ng-invalid, mat-select.ng-invalid')
      ?.focus();
  }

  private avisar(texto: string): void {
    this.snackBar.open(texto, 'Fechar', { duration: 4000 });
  }

  /**
   * Um grupo de campos para a etapa. Na TMB: equação de referência e equações aceitas. Nas outras: referência
   * e faixa (mín e máx). Em todas: tolerância e critério em texto. Os campos da faixa se revalidam entre si.
   */
  private criarGrupoDaEtapa(tipo: TipoEtapa): FormGroup {
    const tolerancia = this.fb.control<number | null>(null, [Validators.required, numeroPositivo]);
    const criterio = this.fb.control('', textoObrigatorio);
    if (tipo === 'TMB') {
      return this.fb.group({
        referencia: this.fb.control<string | null>(null, Validators.required),
        opcoes: this.fb.control<string[]>([], Validators.required),
        tolerancia,
        criterio,
      });
    }
    const referencia = this.fb.control<number | null>(null, [Validators.required, numeroPositivo, referenciaNaFaixa]);
    const min = this.fb.control<number | null>(null, [Validators.required, numeroPositivo, minimoAteMaximo]);
    const max = this.fb.control<number | null>(null, [Validators.required, numeroPositivo, maximoDesdeMinimo]);
    const grupo = this.fb.group({ referencia, min, max, tolerancia, criterio });
    // Mudar a faixa muda o que vale para a referência e para o outro limite.
    const revalidar = (...outros: AbstractControl[]) => () =>
      outros.forEach((c) => c.updateValueAndValidity({ onlySelf: true, emitEvent: false }));
    min.valueChanges.subscribe(revalidar(referencia, max));
    max.valueChanges.subscribe(revalidar(referencia, min));
    referencia.valueChanges.subscribe(revalidar());
    return grupo;
  }

  /** Põe nos campos os critérios das etapas (o que o caso já tem, ou o padrão num caso novo). */
  private preencherEtapas(etapas: readonly EtapaCalculo[]): void {
    this.tipos.forEach((tipo, i) => {
      const etapa = etapas.find((e) => e.tipo === tipo);
      if (!etapa) {
        return;
      }
      const comum = { tolerancia: etapa.tolerancia, criterio: etapa.criterioReferencia };
      this.etapas.at(i).reset(
        tipo === 'TMB'
          ? {
              ...comum,
              referencia: String(etapa.parametroReferencia),
              // Só as equações que a tela conhece: um texto estranho no dado salvo não vira opção fantasma.
              opcoes: EQUACOES_TMB.filter((e) => etapa.opcoesAceitaveis?.includes(e)),
            }
          : {
              ...comum,
              referencia: etapa.parametroReferencia,
              min: etapa.faixaAceitavel?.min ?? null,
              max: etapa.faixaAceitavel?.max ?? null,
            },
      );
    });
  }

  /** Guarda os critérios do formulário nas 5 etapas que o caso já tem; `false` se o serviço recusar. */
  private gravarEtapas(casoId: string, valores: readonly ValoresEtapa[]): boolean {
    const novas = this.casoService.listarEtapas(casoId).map((etapa): EtapaCalculo => {
      const v = valores[this.tipos.indexOf(etapa.tipo)];
      const base = { ...etapa, tolerancia: v.tolerancia ?? etapa.tolerancia, criterioReferencia: v.criterio.trim() };
      if (etapa.tipo === 'TMB') {
        return { ...base, parametroReferencia: String(v.referencia), opcoesAceitaveis: EQUACOES_TMB.filter((e) => v.opcoes.includes(e)) };
      }
      return { ...base, parametroReferencia: Number(v.referencia), faixaAceitavel: { min: v.min ?? 0, max: v.max ?? 0 } };
    });
    return this.casoService.atualizarEtapas(casoId, novas) !== undefined;
  }

  private carregar(id: string | null): void {
    this.naoEncontrado.set(false);
    if (id === null) {
      this.idEmEdicao.set(null);
      this.form.reset();
      // Caso novo começa com as 5 etapas padrão e a tolerância padrão da dieta (o serviço gera as mesmas).
      this.form.controls.toleranciaDieta.setValue(TOLERANCIA_DIETA_PADRAO);
      this.preencherEtapas(etapasPadrao('novo'));
      return;
    }
    const existente = this.casoService.buscarPorId(id);
    if (!existente) {
      this.idEmEdicao.set(null);
      this.naoEncontrado.set(true);
      return;
    }
    this.idEmEdicao.set(id);
    this.preencher(existente);
    this.preencherEtapas(this.casoService.listarEtapas(id));
  }

  private preencher({ caso, atleta }: CasoComAtleta): void {
    this.form.reset({
      titulo: caso.titulo,
      modalidade: caso.modalidade,
      nivel: caso.nivel,
      competencia: caso.competencia,
      descricao: caso.descricao,
      comentarioReferencia: caso.comentarioReferencia,
      toleranciaDieta: caso.toleranciaDieta,
      nome: atleta.nome,
      idade: atleta.idade,
      sexo: atleta.sexo,
      peso: atleta.peso,
      altura: atleta.altura,
      percentualGordura: atleta.percentualGordura ?? null,
      volumeTreino: atleta.volumeTreino,
      horarioTreino: atleta.horarioTreino,
      fasePeriodizacao: atleta.fasePeriodizacao,
      objetivo: atleta.objetivo,
      restricoes: atleta.restricoes.join(', '),
      preferencias: atleta.preferencias.join(', '),
    });
  }

  /** Devolve os dados prontos para o serviço, ou `null` se ainda falta algum campo obrigatório. */
  private lerFormulario(): { caso: DadosCaso; atleta: DadosAtleta; etapas: ValoresEtapa[] } | null {
    const v = this.form.getRawValue();
    if (
      v.nivel === '' ||
      v.sexo === '' ||
      v.idade === null ||
      v.peso === null ||
      v.altura === null ||
      v.toleranciaDieta === null
    ) {
      return null;
    }
    return {
      etapas: v.etapas as ValoresEtapa[],
      caso: {
        titulo: v.titulo.trim(),
        modalidade: v.modalidade.trim(),
        nivel: v.nivel,
        competencia: v.competencia.trim(),
        descricao: v.descricao.trim(),
        comentarioReferencia: v.comentarioReferencia.trim(),
        toleranciaDieta: v.toleranciaDieta,
      },
      atleta: {
        nome: v.nome.trim(),
        idade: v.idade,
        sexo: v.sexo,
        peso: v.peso,
        altura: v.altura,
        ...(v.percentualGordura !== null ? { percentualGordura: v.percentualGordura } : {}),
        volumeTreino: v.volumeTreino.trim(),
        horarioTreino: v.horarioTreino.trim(),
        fasePeriodizacao: v.fasePeriodizacao.trim(),
        objetivo: v.objetivo.trim(),
        restricoes: listaDeTexto(v.restricoes),
        preferencias: listaDeTexto(v.preferencias),
      },
    };
  }
}
