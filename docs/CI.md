# CI e gate de produção

O pipeline em [`.github/workflows/CI.yml`](../.github/workflows/CI.yml) impede merge em `main` com regressões na aplicação, na API de leads ou nas migrations. O fluxo diário está em [FLUXO-SOLO.md](./FLUXO-SOLO.md).

## Jobs

| Job | Quando roda | O que valida |
|-----|-------------|---------------|
| **Build with 24.x** | Pull request e `main` | `npm run build-local` com PGlite em memória |
| **Validate migration and build** | Pull request e `main` | `npm run build:with-migrate` contra PostgreSQL descartável |
| **Run static checks** | Pull request e `main` | Oxlint, tipos, dependências, i18n e commitlint |
| **Run unit tests** | Pull request e `main` | Vitest e cobertura |
| **Run E2E tests** | `main` | Playwright para marketing, redirects e API de leads |
| **Run Storybook** | `main` | Testes dos componentes do Storybook |

## Proteção da `main`

Configure em **Settings -> Branches -> Branch protection**:

1. Exigir pull request antes do merge.
2. Exigir branch atualizada.
3. Exigir `Build with 24.x`, `Validate migration and build`, `Run static checks` e `Run unit tests`.
4. Bloquear push direto, force push e exclusão da branch.

Não torne obrigatórios checks de integrações que não fazem parte do gate, como Vercel, Checkly ou Chromatic, enquanto dependerem de configuração externa ou rodarem somente depois do merge.

## Migrations

Há três comandos com responsabilidades distintas:

| Comando | Finalidade |
|---------|------------|
| `npm run build` | Compila o Next.js sem alterar banco |
| `npm run build-local` | Compila usando PGlite local |
| `npm run build:with-migrate` | Aplica migrations e compila; uso no CI descartável |

O deploy da Vercel usa `npm run build`. A migration de produção é executada separadamente pelo workflow manual [`.github/workflows/migrate-production.yml`](../.github/workflows/migrate-production.yml).

Crie um ambiente `production` em **Settings -> Environments**, habilite aprovação obrigatória e cadastre nele o secret `DATABASE_URL`. O workflow exige a confirmação textual `MIGRAR PRODUCAO` e impede duas migrations simultâneas.

## Secrets no GitHub

| Local | Secret | Uso |
|-------|--------|-----|
| Actions | `CLERK_SECRET_KEY` | Build e E2E |
| Actions | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Build e E2E |
| Actions | `CODECOV_TOKEN` | Upload de cobertura, opcional |
| Actions | `CHROMATIC_PROJECT_TOKEN` | Regressão visual, opcional |
| Ambiente `production` | `DATABASE_URL` | Migration manual de produção |

O workflow principal define uma `DATABASE_URL` local para o PostgreSQL descartável. Ela nunca aponta para produção.

## Paridade local

```bash
npm run lint
npm run check:types
npm run check:deps
npm run check:i18n
npm run test
npm run build-local
```

Para validar o caminho de migration com um PostgreSQL local vazio:

```bash
npm run build:with-migrate
```

## Testes críticos

| Arquivo | Fluxo |
|---------|-------|
| `tests/e2e/Marketing.conversion.e2e.ts` | Home, catálogo, formulário e WhatsApp |
| `tests/e2e/Legacy.redirects.e2e.ts` | Redirects do blog WordPress |
| `tests/integration/Leads.api.integ.ts` | Validação, honeypot e criação de leads |
| `src/lib/legacy-redirects.test.ts` | Mapa de redirects |
| `src/lib/quote-whatsapp.test.ts` | Mensagem e URL do WhatsApp |

## Falhas comuns

| Job | Causa frequente | Verificação local |
|-----|-----------------|-------------------|
| Run unit tests | Componente ou fixture desatualizada | `npm run test` |
| Run static checks | Oxlint, tipos, dependências ou traduções | `npm run lint` e demais checks |
| Validate migration and build | Migration inválida ou variável obrigatória ausente | `npm run build:with-migrate` |
| Run E2E tests | Regressão em formulário, redirect ou API | `npm run test:e2e` |

O relatório histórico do lint permanece em `docs/CI-lint-report.txt`.
