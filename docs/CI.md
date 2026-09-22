# CI — gate de produção (Sprint 8.7)

Pipeline em [`.github/workflows/CI.yml`](../.github/workflows/CI.yml). Objetivo: impedir merge em `main` com regressões em **orçamento**, **API de leads** e **build com migrate**.

**Desenvolvedor solo:** fluxo enxuto em [FLUXO-SOLO.md](./FLUXO-SOLO.md) (push direto na `main`, 3 checks no GitHub).

## Jobs obrigatórios (recomendado no branch protection)

| Job | Quando roda | O que valida |
|-----|-------------|----------------|
| **Build with 24.x** | PR e `main` | `npm run build-local` (Next + PGlite em memória) |
| **Run static checks** | PR e `main` | `lint`, `check:types`, `check:deps`, `check:i18n`, commitlint (só PR) |
| **Run unit tests** | PR e `main` | Vitest + coverage |
| **Build with db migrate** | só push em `main` | `npm run build` (caminho Vercel produção) |
| **Run E2E tests** | só push em `main` | Playwright — marketing, **301**, **API leads** |
| **Run Storybook** | só push em `main` | Storybook tests |

### Branch protection (solo — 3 checks)

| Marcar ✅ | Não marcar |
|-----------|------------|
| Build with 24.x | Build with 22.x (removido do CI) |
| Run static checks | Vercel, Crowdin, Checkly |
| Run unit tests | E2E / Storybook / migrate (rodam na `main` após o push) |

Chromatic e Crowdin não bloqueiam o gate de produção.

Branch protection em `main` exige os seis jobs acima antes do merge.

## Secrets no GitHub (Settings → Secrets → Actions)

| Secret | Uso |
|--------|-----|
| `CLERK_SECRET_KEY` | Build migrate + E2E (servidor) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Build migrate + E2E |
| `CODECOV_TOKEN` | Upload de cobertura (opcional) |
| `CHROMATIC_PROJECT_TOKEN` | Regressão visual (opcional) |

Sem `CLERK_*` ou `DATABASE_URL`, jobs que carregam `Env.ts` (build, unit, Storybook) falham na validação.

O workflow define `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/postgres` (paridade com PGlite do `build-local`).

## Rodar localmente (paridade com CI)

```bash
npm run lint
npm run check:types
npm run test
npm run test:e2e
npm run build-local
```

Com Postgres local (paridade com Vercel):

```bash
# DATABASE_URL apontando para Postgres com schema vazio
npm run build
```

## Testes críticos de negócio

| Arquivo | Fluxo |
|---------|--------|
| `tests/e2e/Marketing.conversion.e2e.ts` | Home, catálogo, formulário orçamento, WhatsApp |
| `tests/e2e/Legacy.redirects.e2e.ts` | 301 do blog WordPress |
| `tests/integration/Leads.api.integ.ts` | `POST /api/leads` — validação, honeypot, criação |
| `src/lib/legacy-redirects.test.ts` | Mapa de redirects |
| `src/lib/quote-whatsapp.test.ts` | Mensagem e URL WhatsApp |

Smoke do painel `/dashboard/leads` (login por senha) fica para quando houver usuário de teste documentado em `docs/CLERK-ACESSO-ADMIN.md`.

## Branch protection em `main`

Configurar no GitHub (**Settings → Branches → Branch protection**):

1. Require status checks: **Build with 22.x**, **Build with 24.x**, **Build with db migrate**, **Run static checks**, **Run unit tests**, **Run E2E tests**
2. Desabilitar bypass para administradores (produção)
3. Vercel Production deploy apenas a partir de `main` com CI verde

## Adicionar redirect WordPress

Ver [MIGRACAO-SEO-WP.md](./MIGRACAO-SEO-WP.md) — editar `src/data/legacy-redirects.json` e rodar testes.

## Falhas comuns no GitHub Actions

### Workflow **CI** vermelho

Abra o run → veja qual **job** falhou (ícone vermelho):

| Job | Causa frequente | Como verificar localmente |
|-----|-----------------|---------------------------|
| Run unit tests | Teste do boilerplate (`BaseTemplate`) desatualizado | `npm run test` |
| Run static checks | `npm run lint` (~centenas de regras Ultracite) ou `check:deps` | `npm run lint` e `npm run check:deps` |
| Build with db migrate | Falta `DATABASE_URL` / migrate ou `DASHBOARD_SESSION_SECRET` | `npm run build` com Postgres |
| Run E2E tests | Playwright (formulário, 301, API leads) | `npm run test:e2e` |

### Vercel Preview vermelho no PR

O check **Vercel** é do deploy na Vercel, não do workflow `CI.yml`. Confira em **Project → Settings → Environment Variables** (Preview e Production): `DATABASE_URL`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_URL`. Ver [DEPLOY-PREVIEW-VERCEL.md](./DEPLOY-PREVIEW-VERCEL.md).

### Commitlint falha em PR do Dependabot

Mensagens como `chore(deps): Bump the npm-deps group...` quebram a regra `subject-case`. O CI ignora commits de dependência e não roda commitlint quando o autor do PR é `dependabot[bot]`.

### **Crowdin Action** vermelho (não é o CI principal)

Falta configurar `CROWDIN_PROJECT_ID` e `CROWDIN_PERSONAL_TOKEN` em **Secrets**. O job em PR no `CI.yml` **não roda** sem esses secrets; não marque como required check. Sync agendado: `crowdin.yml` em `main`.

### **Checkly** vermelho (monitoramento pós-deploy)

Disparado pelo **Vercel** após deploy. Falta `CHECKLY_API_KEY` / `CHECKLY_ACCOUNT_ID`, ou os checks no site de preview falharam. Separado do gate de merge em `main`.

### Por que o CI ficou vermelho por meses

O job **Run static checks → Linter** rodava `ultracite check --type-aware --type-check`, que falha com **centenas de avisos** (JSDoc, regras Vitest, etc.) — não só erros reais. Por isso **CI #3 até #27** aparecem com X vermelho mesmo em commits antigos.

**Correção (2026-05-21):** `npm run lint` passou a usar `oxlint` (falha só em **error**). `check:types` continua no CI em passo separado. Avisos de JSDoc estão como `warn` em `oxlint.config.ts` para ir limpando aos poucos.

### Lint local

```bash
npm run lint          # oxlint (gate do CI)
npm run lint:fix      # ultracite fix (formato + auto-fix)
npm run check:types   # TypeScript
```

Registro completo de avisos históricos: `docs/CI-lint-report.txt`.
