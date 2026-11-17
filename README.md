# NutriCase

Ferramenta educacional de nutrição esportiva. O estudante escolhe um caso fictício de atleta, calcula as etapas (TMB, GET, carboidrato, proteína e gordura), monta a dieta do dia com a base de alimentos TACO e submete a resolução. O sistema corrige as etapas, compara a dieta com as metas que o estudante calculou e mostra o resultado com a explicação dos erros. O docente cadastra e edita os casos e os critérios de correção. Os casos são fictícios e não têm finalidade clínica.

- **Autores:** Bruno Shiguematu e Guilherme
- **Curso:** Engenharia de Software, UNIFIO
- **Disciplina:** Projeto Integrador IV, 2026/2
- **Link:** (a publicar)

## Acesso e dados

O app não tem login: abre direto. Os dados (casos e resoluções) ficam no `localStorage` do navegador de cada pessoa. Limpar os dados do navegador apaga tudo, e os casos de exemplo voltam na próxima abertura.

## Como rodar

Precisa de Node.js e npm.

```bash
cd nutricase
npm install
npx ng serve
```

Abra http://localhost:4200.

Testes: `npx ng test --watch=false`. Build de produção: `npx ng build`.

## Telas principais

- **Dashboard:** indicadores calculados a partir das resoluções.
- **Casos:** catálogo dos casos, de onde o estudante começa uma resolução.
- **Minhas resoluções:** tentativas em andamento e submetidas; abre a resolução (etapas, dieta, justificativa e revisão) e o resultado.
- **Gestão de casos:** cadastro, edição e exclusão de casos, fichas de atleta e critérios das etapas.
- **Base de alimentos:** consulta à TACO com busca por nome, filtro por grupo e paginação.

## Diagrama de classes

[docs/diagrama-de-classes.md](docs/diagrama-de-classes.md)
