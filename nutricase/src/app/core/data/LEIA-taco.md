# taco.json: origem dos dados

`taco.json` guarda a **TACO** (Tabela Brasileira de Composição de Alimentos), com os valores por 100 g de parte comestível. O arquivo é gerado por script a partir do PDF oficial. Nenhum valor foi digitado ou escrito de memória.

## Fonte

| Item | Valor |
|---|---|
| Obra | Tabela Brasileira de Composição de Alimentos – TACO, **4ª edição revisada e ampliada** |
| Autoria | NEPA – Núcleo de Estudos e Pesquisas em Alimentação, UNICAMP. Campinas, SP, 2011 |
| PDF usado | `taco_4_edicao_ampliada_e_revisada.pdf` (164 páginas) |
| Link do download | https://www.cfn.org.br/wp-content/uploads/2017/03/taco_4_edicao_ampliada_e_revisada.pdf (cópia do PDF do NEPA hospedada pelo Conselho Federal de Nutricionistas) |
| Baixado em | 2026-11-11 |
| SHA-256 do PDF | `2002aec5615b5b1395aaa8fa675635bbb7f712c33f278af5e332f1cac8f108c8` |
| Onde ficou o PDF | fora do repositório: `/private/tmp/claude-501/taco-fonte/taco_4_edicao.pdf` (pasta temporária; baixe de novo pelo link e confira o hash) |
| Tabela lida | Tabela 1 (composição centesimal, minerais, vitaminas e colesterol), a partir da página 29 do PDF |

A página 5 do PDF diz: "É permitida a reprodução parcial ou total desta obra, desde que citada a fonte." Por isso a citação abaixo vai também no rodapé da tela.

## Campos

Cada item de `taco.json` tem: `id`, `nome`, `grupo`, `kcal`, `carboidrato`, `proteina`, `gordura` e `origem: "TACO"`.

| Campo | De onde vem na Tabela 1 |
|---|---|
| `id` | `taco-` + número do alimento no PDF com 3 dígitos (ex.: `taco-003` = nº 3, "Arroz, tipo 1, cozido") |
| `nome` | coluna "Descrição dos alimentos", como está no PDF |
| `grupo` | título do grupo (ex.: "Cereais e derivados"), são 15 grupos |
| `kcal` | coluna Energia (kcal) |
| `proteina` | coluna Proteína (g) |
| `gordura` | coluna Lipídeos (g) |
| `carboidrato` | coluna Carboidrato (g) |

Os números do PDF usam vírgula decimal. O script troca por ponto.

## Regras de conversão

1. **`Tr` (traço) vira 0.** Pela nota da TACO, traço é valor arredondado entre 0 e 0,5 (ou 0 e 0,05 etc.) ou abaixo do limite de quantificação.
2. **`NA` (não aplicável) vira 0.**
3. **`*` fica fora.** Na TACO, `*` quer dizer "as análises estão sendo reavaliadas": não há valor publicado. Virar 0 daria um alimento com 0 kcal, que é falso. O alimento que tem `*` em kcal, proteína, gordura ou carboidrato não entra no `taco.json`.
4. **Célula em branco fica fora.** Pela nota da TACO, "valores em branco: análises não solicitadas". Mesmo tratamento do `*`.

Rodando o script, no estado atual, o resultado é:

- 597 alimentos lidos na Tabela 1 (a numeração 1 a 597 é conferida, sem pulo nem repetição).
- 36 valores `Tr` e 24 valores `NA` viraram 0 (conta só as 4 colunas usadas).
- **5 alimentos ficaram de fora** (regras 3 e 4):

| Nº | Alimento | Colunas sem valor |
|---|---|---|
| 450 | Iogurte, sabor abacaxi | kcal, proteína, gordura, carboidrato |
| 457 | Leite, de vaca, desnatado, UHT | kcal, proteína, gordura, carboidrato |
| 458 | Leite, de vaca, integral | kcal, proteína, gordura, carboidrato |
| 472 | Cana, aguardente | proteína, gordura, carboidrato |
| 591 | Coco, verde, cru | kcal, proteína, gordura, carboidrato |

- **592 itens** gravados em `taco.json`.

Se o grupo decidir incluir esses 5 de outra forma (por exemplo, com valores de outra fonte), é uma decisão a registrar aqui.

## Como regenerar

Dentro de `nutricase/`:

```
npm install --no-save pdfjs-dist@4.10.38
node scripts/converter-taco.mjs <caminho-do-pdf> [saida.json]
```

O script imprime o hash do PDF, o total de itens, os alimentos excluídos e a contagem de `Tr`/`NA`. Ele falha, em vez de gravar dado duvidoso, se a numeração sair de ordem, se o total lido não for 597 ou se aparecer um valor que não seja número, `Tr`, `NA` ou `*`.

A dependência `pdfjs-dist` não entra no `package.json` do app: ela só serve para gerar o arquivo, e o `taco.json` já está no repositório.

## Observações sobre os dados

- Os dados refletem a TACO como publicada. Ex.: "Fermento em pó, químico" tem 90 kcal e 43,9 g de carboidrato (a TACO não descreve esse carboidrato como digestível). Não foi corrigido.
- Alimentos com `Tr`/`NA` em carboidrato, proteína ou gordura ficam com 0 nesse nutriente, o que pode deixar a soma de calorias menor que a energia indicada.

## Como citar

NÚCLEO DE ESTUDOS E PESQUISAS EM ALIMENTAÇÃO (NEPA). **Tabela Brasileira de Composição de Alimentos (TACO)**. 4. ed. rev. e ampl. Campinas: NEPA-UNICAMP, 2011.
