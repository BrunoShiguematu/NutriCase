import { FormControl } from '@angular/forms';
import { dentroDaFaixa, FAIXAS_USUAIS, mensagemNumero } from './etapas-ui';

describe('faixas usuais dos campos das etapas', () => {
  const fatorDeAtividade = dentroDaFaixa(FAIXAS_USUAIS.GET.parametro!);
  const erro = (valor: number | null) => fatorDeAtividade(new FormControl(valor));

  it('aceita o valor dentro da faixa, inclusive nas bordas', () => {
    expect(erro(1.7)).toBeNull();
    expect(erro(1)).toBeNull();
    expect(erro(2.5)).toBeNull();
  });

  it('recusa o valor fora da faixa e deixa vazio e não positivo para o numeroPositivo', () => {
    expect(erro(8)).toEqual({ foraDaFaixa: { min: 1, max: 2.5 } });
    expect(erro(0.9)).not.toBeNull();
    expect(erro(null)).toBeNull();
    expect(erro(0)).toBeNull();
    expect(erro(-3)).toBeNull();
  });

  it('a mensagem traz a faixa em formato brasileiro', () => {
    const controle = new FormControl(18000, dentroDaFaixa(FAIXAS_USUAIS.TMB.valor));
    expect(mensagemNumero(controle)).toBe('Valor fora do usual (entre 800 e 3.500). Confira a unidade e a vírgula.');
  });
});
