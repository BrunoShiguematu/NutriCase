# NutriCase

O NutriCase é uma ferramenta educacional de casos fictícios de nutrição esportiva. O estudante resolve o caso de um atleta: calcula as metas de energia e de macronutrientes e monta a dieta do dia com alimentos da tabela TACO. O sistema corrige a resolução e mostra o desempenho no Dashboard. Os casos não têm finalidade clínica.

Projeto Integrador IV (Angular), Engenharia de Software, UNIFIO, 2026/2.

**App publicada:** https://nutricase-unifio.vercel.app

**Login:** não há. A app abre direto, sem usuário nem senha.

## Integrantes

| Nome completo | ID acadêmico |
|---|---|
| Bruno Shiguematu | 273611 |
| Guilherme Coco da Costa | 272449 |
| Matheus da Silva Gomes | 273137 |

## Antes de começar: dados de demonstração

No primeiro acesso, a app já cria **5 resoluções fictícias**. Assim o Dashboard abre com as KPIs calculadas e o professor pode analisá-las sem precisar resolver vários casos antes. Elas aparecem em **Minhas resoluções** junto com as que você criar. Esses dados servem só para a avaliação e não farão parte do produto final.

Os dados ficam salvos no navegador (localStorage). Para voltar ao estado inicial, limpe os dados do site no navegador e recarregue a página: as 5 resoluções de demonstração são criadas de novo.

## Fluxo principal: passo a passo

O fluxo principal é **resolver um caso de ponta a ponta e ver o resultado refletido no Dashboard**. Use como exemplo o caso **"Maratonista em fase de base"**.

1. **Veja o Dashboard primeiro.** No menu lateral, clique em **Dashboard** e anote os números das KPIs. Eles já incluem as 5 resoluções de demonstração.
2. **Escolha o caso.** No menu, clique em **Casos** e abra **"Maratonista em fase de base"**. A ficha mostra o atleta: Carlos Menezes, homem, 28 anos, 70 kg, 177 cm, 14% de gordura, treino de 90 min/dia.
3. **Resolva as 5 etapas de cálculo.** Em cada etapa, escolha o parâmetro e informe o valor calculado. Para acertar todas, use:

   | Etapa | Parâmetro | Valor |
   |---|---|---|
   | Taxa metabólica basal (TMB) | Equação: Mifflin-St Jeor | 1671 kcal/dia |
   | Gasto energético total (GET) | Fator de atividade: 1,8 | 3008 kcal/dia |
   | Meta de carboidrato | 6 g/kg/dia | 420 g/dia |
   | Meta de proteína | 1,6 g/kg/dia | 112 g/dia |
   | Meta de gordura | 1 g/kg/dia | 70 g/dia |

   Para ver como o sistema corrige os erros, você também pode errar um valor de propósito (por exemplo, TMB = 1400).
4. **Monte a dieta do dia.** Na etapa **Dieta**, crie as refeições (nome e horário, por exemplo "Café da manhã", 07:00). Depois use **Buscar alimento** para adicionar alimentos com a quantidade em gramas. A tabela **Dieta do dia** compara, enquanto você monta, o total da dieta com as metas que você calculou.
5. **Justificativa (opcional).** Explique suas escolhas ou deixe em branco. Esse campo não recebe nota.
6. **Revise e submeta.** A tela de revisão lista as respostas e as pendências. Clique em **Submeter** e confirme.
7. **Veja o resultado.** O sistema mostra cada etapa como correta, aceitável ou errada, com a explicação. Mostra também se a dieta ficou dentro da tolerância das suas metas.
8. **Confira o Dashboard de novo.** As KPIs mudam para incluir a resolução que você acabou de fazer. Os filtros de período (7 dias, 30 dias ou datas escolhidas) também alteram os valores.

## KPIs do Dashboard

Todas são calculadas a partir das resoluções salvas no sistema:

- **Casos resolvidos:** tentativas submetidas no período.
- **Aproveitamento:** percentual de etapas corretas ou aceitáveis. Quando o filtro está em Dieta, é o percentual de dietas dentro da meta.
- **Etapas corretas / Dietas dentro da meta**, **Aceitáveis** e **Erros de fato:** contagem por resultado.
- **Ofensiva:** dias seguidos com casos resolvidos.
- Gráficos de **evolução do aproveitamento** e de **erros por tipo**.

## CRUD

- **Gestão de casos** (menu Administração): cadastrar, editar e excluir casos, junto com o atleta e as etapas.
- **Minhas resoluções:** listar, abrir, refazer e excluir resoluções.
- **Dieta:** criar, editar e excluir refeições e os alimentos de cada uma.
- **Base de alimentos:** consulta à tabela TACO.

## Entidades

`Caso`, `Atleta`, `EtapaCalculo`, `Resolucao`, `RespostaEtapa`, `Refeicao`, `ItemRefeicao` e `Alimento`. Diagrama: [docs/diagrama-de-classes.md](docs/diagrama-de-classes.md).

## Observações

- O perfil no topo ("Bruno Shiguematu") é fixo. Ainda não existe login nem separação entre aluno e administrador, então todas as telas ficam acessíveis pelo menu.
- O MVP foi feito para computador (desktop).

## Tecnologias

Angular com NgModules (`standalone: false`), Angular Router e Angular Material. Sem SSR. Publicado na Vercel.

## Como rodar localmente

Precisa de Node.js e npm.

```bash
cd nutricase
npm install
npx ng serve
```

Abra http://localhost:4200. Testes: `npx ng test --watch=false`.
