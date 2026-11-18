import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Resolucao } from '../../core/models';
import { CasoService } from '../../core/services/caso.service';
import { ContagemEtapas, ResolucaoService } from '../../core/services/resolucao.service';
import {
  ConfirmarExclusaoResolucaoComponent,
  DadosConfirmarExclusaoResolucao,
} from './confirmar-exclusao-resolucao/confirmar-exclusao-resolucao.component';

const SEM_DATA = '—';

const doisDigitos = (n: number): string => String(n).padStart(2, '0');

function formatarData(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return SEM_DATA;
  }
  return `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)}/${d.getFullYear()} ${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
}

export interface LinhaResolucao {
  resolucao: Resolucao;
  caso: string;
  casoExiste: boolean;
  dataTexto: string;
  rotulo: string;
  contagem?: ContagemEtapas;
}

@Component({
  selector: 'app-resolucoes',
  standalone: false,
  styleUrl: './resolucoes.component.scss',
  templateUrl: './resolucoes.component.html',
})
export class ResolucoesComponent {
  private readonly service = inject(ResolucaoService);
  private readonly casos = inject(CasoService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  protected readonly colunas = ['caso', 'data', 'status', 'etapas', 'acoes'];

  protected readonly linhas = computed<LinhaResolucao[]>(() =>
    this.service.listar().map((resolucao) => {
      const caso = this.casos.buscarPorId(resolucao.casoId);
      const titulo = caso?.caso.titulo ?? 'Caso excluído';
      const dataTexto = formatarData(resolucao.data);
      return {
        resolucao,
        caso: titulo,
        casoExiste: caso !== undefined,
        dataTexto,
        rotulo: dataTexto === SEM_DATA ? titulo : `${titulo} de ${dataTexto}`,
        contagem: this.service.contagemEtapas(resolucao.id),
      };
    }),
  );

  protected statusTexto(resolucao: Resolucao): string {
    return resolucao.status === 'submetida' ? 'Submetida' : 'Em andamento';
  }

  protected continuar(resolucao: Resolucao): void {
    void this.router.navigate(['/resolucoes', resolucao.id]);
  }

  protected verResultado(resolucao: Resolucao): void {
    void this.router.navigate(['/resolucoes', resolucao.id, 'resultado']);
  }

  protected refazer(resolucao: Resolucao): void {
    const nova = this.service.refazer(resolucao.id);
    if (!nova) {
      this.snackBar.open('Não foi possível refazer: o caso não existe mais', 'Fechar', { duration: 4000 });
      return;
    }
    void this.router.navigate(['/resolucoes', nova.id]);
  }

  protected excluir(linha: LinhaResolucao): void {
    this.dialog
      .open<ConfirmarExclusaoResolucaoComponent, DadosConfirmarExclusaoResolucao, boolean>(
        ConfirmarExclusaoResolucaoComponent,
        { data: { caso: linha.caso, data: linha.dataTexto, submetida: linha.resolucao.status === 'submetida' } },
      )
      .afterClosed()
      .subscribe((confirmou) => {
        if (confirmou === true) {
          const excluiu = this.service.excluir(linha.resolucao.id);
          this.snackBar.open(
            excluiu ? 'Resolução excluída' : 'Não foi possível excluir: resolução não encontrada',
            'Fechar',
            { duration: 4000 },
          );
        }
      });
  }
}
