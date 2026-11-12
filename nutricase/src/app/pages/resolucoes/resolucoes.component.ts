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

const doisDigitos = (n: number): string => String(n).padStart(2, '0');

/**
 * "dd/MM/yyyy HH:mm" no fuso do navegador. Feito à mão de propósito: o `formatDate` do Angular, por estar
 * também no código do `main`, entraria inteiro no pacote inicial (+10 kB).
 */
function formatarData(iso: string): string {
  const d = new Date(iso);
  return `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)}/${d.getFullYear()} ${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
}

/** Uma linha da tabela: a tentativa com o que a tela mostra dela. */
export interface LinhaResolucao {
  resolucao: Resolucao;
  /** Título do caso; "Caso excluído" quando o docente removeu o caso depois. */
  caso: string;
  casoExiste: boolean;
  /** "dd/MM/yyyy HH:mm", no fuso do navegador. */
  dataTexto: string;
  /** Contagem das etapas por classificação; só nas submetidas. */
  contagem?: ContagemEtapas;
}

/** Minhas resoluções (RF35): todas as tentativas do estudante, com as ações de cada uma. */
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

  /** Acompanha os signals dos serviços: refazer, excluir e iniciar atualizam a tabela sozinhos. */
  protected readonly linhas = computed<LinhaResolucao[]>(() =>
    this.service.listar().map((resolucao) => {
      const caso = this.casos.buscarPorId(resolucao.casoId);
      return {
        resolucao,
        caso: caso?.caso.titulo ?? 'Caso excluído',
        casoExiste: caso !== undefined,
        dataTexto: formatarData(resolucao.data),
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
