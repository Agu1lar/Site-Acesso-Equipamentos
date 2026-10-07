# Fluxo solo com proteção de produção

Mesmo com um único desenvolvedor, a `main` deve representar código revisado e pronto para produção. Mudanças entram por pull request para que o CI valide a aplicação e as migrations antes do deploy automático da Vercel.

## Git no dia a dia

```bash
git checkout main
git pull origin main
git checkout -b tipo/resumo-curto
# ... editar arquivos ...
git add .
git commit -m "feat: descreva o que mudou em uma frase"
git push -u origin tipo/resumo-curto
```

Abra um pull request para `main` e aguarde os checks obrigatórios. Use mensagens `tipo: resumo em minúsculas`, por exemplo `feat:`, `fix:`, `chore:` ou `docs:`.

## O que roda sozinho

| Quando | O quê |
|--------|-------|
| Pull request e `main` | Build, lint, tipos, dependências, i18n e testes unitários |
| Pull request e `main` | Migration e build contra PostgreSQL descartável do CI |
| Push na `main` | Storybook e E2E |
| Merge na `main` | Deploy de produção na Vercel, sem alterar o banco |
| Ação manual protegida | Migration no banco de produção |

## Branch protection

Em **Settings -> Branches -> `main`**, configure:

1. Exigir pull request antes do merge.
2. Exigir que a branch esteja atualizada antes do merge.
3. Bloquear push direto e force push na `main`.
4. Exigir os checks `Build with 24.x`, `Validate migration and build`, `Run static checks` e `Run unit tests`.

Checks de E2E e Storybook podem continuar pós-merge enquanto forem lentos ou dependerem de serviços externos. Eleve-os a obrigatórios quando estiverem estáveis em pull requests.

## Migrations de produção

`npm run build` compila a aplicação e não altera o banco. O CI executa `npm run build:with-migrate` somente contra um PostgreSQL descartável.

Para aplicar uma migration em produção:

1. Prefira migrations aditivas e compatíveis com a versão atual da aplicação.
2. Aguarde o CI verde no pull request.
3. Execute **Actions -> Migrate production database -> Run workflow** na branch revisada.
4. Digite `MIGRAR PRODUCAO` quando solicitado.
5. Confirme o sucesso da migration e só então faça o merge.

Configure o ambiente `production` do GitHub com aprovação obrigatória e o secret `DATABASE_URL`. Alterações destrutivas, como remover coluna ou tabela, devem ocorrer em uma implantação posterior, depois que o código deixar de usá-las.

## Antes do push

```bash
npm run lint
npm run check:types
npm run test
```

Rode `npm run test:e2e` também para mudanças em formulário, redirects ou API de leads.

## Hooks locais

Os hooks do Lefthook antecipam falhas do CI. Use `--no-verify` somente quando o hook estiver tecnicamente indisponível; o pull request ainda precisará passar pelos checks obrigatórios.

## Vercel

A Vercel deve usar `npm run build` tanto em Preview quanto em Production. A conexão de produção com o banco continua disponível em runtime, mas nenhuma migration é executada pelo build.

Detalhes em [DEPLOY-PREVIEW-VERCEL.md](./DEPLOY-PREVIEW-VERCEL.md) e [CI.md](./CI.md).
