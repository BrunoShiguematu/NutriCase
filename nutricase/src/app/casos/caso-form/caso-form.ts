import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { Nivel, Sexo } from '../../core/models';
import { CasoComAtleta, CasoService, DadosAtleta, DadosCaso } from '../../core/services/caso.service';

/** Texto obrigatório: espaços sozinhos não valem. */
function textoObrigatorio(controle: AbstractControl): ValidationErrors | null {
  return String(controle.value ?? '').trim() === '' ? { required: true } : null;
}

/** Número preenchido tem que ser maior que zero (vazio é com o `required`). */
function positivo(controle: AbstractControl): ValidationErrors | null {
  const valor = controle.value;
  return valor !== null && valor !== '' && Number(valor) <= 0 ? { positivo: true } : null;
}

/** "a, b ,, c" vira ["a", "b", "c"]. */
function listaDeTexto(texto: string): string[] {
  return texto
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
}

/** Formulário de cadastro (`/casos/gestao/novo`) e edição (`/casos/gestao/:id/editar`) de caso e ficha do atleta. */
@Component({
  selector: 'app-caso-form',
  standalone: false,
  styleUrl: './caso-form.scss',
  templateUrl: './caso-form.html',
})
export class CasoForm {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly casoService = inject(CasoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly niveis: Nivel[] = ['Iniciante', 'Intermediário', 'Avançado'];
  protected readonly sexos: { valor: Sexo; rotulo: string }[] = [
    { valor: 'feminino', rotulo: 'Feminino' },
    { valor: 'masculino', rotulo: 'Masculino' },
  ];

  /** Id do caso em edição; `null` no cadastro. */
  protected readonly idEmEdicao = signal<string | null>(null);

  protected readonly form = this.fb.group({
    // Caso
    titulo: ['', textoObrigatorio],
    modalidade: ['', textoObrigatorio],
    nivel: this.fb.control<Nivel | ''>('', Validators.required),
    competencia: ['', textoObrigatorio],
    descricao: ['', textoObrigatorio],
    comentarioReferencia: [''],
    // Ficha do atleta
    nome: ['', textoObrigatorio],
    idade: this.fb.control<number | null>(null, [Validators.required, positivo]),
    sexo: this.fb.control<Sexo | ''>('', Validators.required),
    peso: this.fb.control<number | null>(null, [Validators.required, positivo]),
    altura: this.fb.control<number | null>(null, [Validators.required, positivo]),
    percentualGordura: this.fb.control<number | null>(null, [positivo, Validators.max(100)]),
    volumeTreino: ['', textoObrigatorio],
    horarioTreino: ['', textoObrigatorio],
    fasePeriodizacao: ['', textoObrigatorio],
    objetivo: ['', textoObrigatorio],
    restricoes: [''],
    preferencias: [''],
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => this.carregar(params.get('id')));
  }

  protected salvar(): void {
    const dados = this.lerFormulario();
    if (this.form.invalid || !dados) {
      this.form.markAllAsTouched();
      return;
    }

    const id = this.idEmEdicao();
    if (id === null) {
      this.casoService.criar(dados.caso, dados.atleta);
      this.snackBar.open('Caso criado', 'Fechar', { duration: 4000 });
    } else if (this.casoService.atualizar(id, dados.caso, dados.atleta)) {
      this.snackBar.open('Caso atualizado', 'Fechar', { duration: 4000 });
    } else {
      this.snackBar.open('Caso não encontrado', 'Fechar', { duration: 4000 });
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
    if (erros['positivo']) {
      return 'Informe um número maior que zero';
    }
    if (erros['max']) {
      return 'O valor máximo é 100';
    }
    return 'Valor inválido';
  }

  private carregar(id: string | null): void {
    if (id === null) {
      this.idEmEdicao.set(null);
      this.form.reset();
      return;
    }
    const existente = this.casoService.buscarPorId(id);
    if (!existente) {
      this.snackBar.open('Caso não encontrado', 'Fechar', { duration: 4000 });
      void this.router.navigate(['/casos/gestao']);
      return;
    }
    this.idEmEdicao.set(id);
    this.preencher(existente);
  }

  private preencher({ caso, atleta }: CasoComAtleta): void {
    this.form.reset({
      titulo: caso.titulo,
      modalidade: caso.modalidade,
      nivel: caso.nivel,
      competencia: caso.competencia,
      descricao: caso.descricao,
      comentarioReferencia: caso.comentarioReferencia,
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
  private lerFormulario(): { caso: DadosCaso; atleta: DadosAtleta } | null {
    const v = this.form.getRawValue();
    if (v.nivel === '' || v.sexo === '' || v.idade === null || v.peso === null || v.altura === null) {
      return null;
    }
    return {
      caso: {
        titulo: v.titulo.trim(),
        modalidade: v.modalidade.trim(),
        nivel: v.nivel,
        competencia: v.competencia.trim(),
        descricao: v.descricao.trim(),
        comentarioReferencia: v.comentarioReferencia.trim(),
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
