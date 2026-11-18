import { grauDaBusca, nomeContem } from './alimento.service';

describe('busca de alimentos pelo nome', () => {
  it('cada palavra digitada precisa estar no nome, em qualquer ordem e posição, sem acento', () => {
    expect(nomeContem('Frango, peito, sem pele, grelhado', 'peito frango')).toBe(true);
    expect(nomeContem('Frango, peito, sem pele, grelhado', 'PEI')).toBe(true);
    expect(nomeContem('Brasileira', 'lei')).toBe(true);
    expect(nomeContem('Frango, coxa, crua', 'peito frango')).toBe(false);
  });

  it('ordena por grau: começa pelo texto, depois palavra que começa, depois só contém', () => {
    expect(grauDaBusca('Leite, de cabra', 'lei')).toBe(0);
    expect(grauDaBusca('Creme de Leite', 'lei')).toBe(1);
    expect(grauDaBusca('Abóbora, menina brasileira, crua', 'lei')).toBe(2);
    expect(grauDaBusca('Frango, peito, sem pele, cru', 'peito frango')).toBe(1);
    expect(grauDaBusca('Frango, peito, sem pele, cru', 'frango peito')).toBe(0);
  });
});
