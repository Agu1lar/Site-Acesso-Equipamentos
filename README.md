# Acesso Equipamentos — Site institucional e captação de orçamentos

[![CI](https://github.com/Agu1lar/Landing_Page_Acesso/actions/workflows/CI.yml/badge.svg)](https://github.com/Agu1lar/Landing_Page_Acesso/actions/workflows/CI.yml)

Site da **Acesso Equipamentos** (locação de equipamentos para construção civil). Catálogo público, carrinho de orçamento, envio via **WhatsApp** com confirmação de resposta pelo ChatPro, leads no **PostgreSQL**, e-mail interno (**Resend**) e painel **Clerk** (`/dashboard`).

| Ambiente | URL |
|----------|-----|
| Produção | [acessoequipamentos.com.br](https://acessoequipamentos.com.br/) |
| Preview Vercel | [landing-page-acesso.vercel.app](https://landing-page-acesso.vercel.app/) |

---

## Rodar localmente

**Requisitos:** Node.js **20+** (recomendado 22+), chaves **Clerk** no `.env.local`. O Postgres sobe com o próprio `dev` (PGlite na porta 5433) ou use **Neon** via `DATABASE_URL`.

```shell
cp .env.example .env.local   # Windows: copie manualmente
npm install
npm run dev
```

Abra **http://localhost:3000**

Migrações: aplicadas no `npm run dev` ou com `npm run db:migrate` se usar Neon.

### Painel admin (opcional)

1. Usuário no [Clerk Dashboard](https://dashboard.clerk.com) (Development).
2. **Public metadata:** `{ "role": "admin" }` ou `"comercial"`.
3. `/sign-in` → `/dashboard/leads`

### Comandos úteis

| Comando | Uso |
|---------|-----|
| `npm run dev` | PGlite + Next.js |
| `npm run build` | Migrações + build produção |
| `npm run check:types` | TypeScript |
| `npm run lint` | Lint |
| `npm run test` | Vitest |
| `npm run test:e2e` | Playwright |

Variáveis: [.env.example](.env.example) · e-mail leads: `RESEND_*` · analytics: `NEXT_PUBLIC_POSTHOG_*`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`

---

## Stack

**Next.js 16** (App Router) · **TypeScript** · **Tailwind v4** · **next-intl** (pt-BR) · **Drizzle** + **PostgreSQL** (Neon / PGlite) · **Clerk** · **Vercel Blob** · **Resend** · **PostHog** + **GA4** (com consentimento) · deploy **Vercel**

---

## O que o projeto faz (resumo)

- **Público:** home, catálogo (`/equipamentos`), categorias, fichas, blog (`/dicas`), orçamento, FAQ, contato.
- **Orçamento:** carrinho multi-item → lead no banco → WhatsApp + e-mail comercial.
- **Rastreamento comercial:** origem Google Ads/GA4, clique no WhatsApp, abertura do WhatsApp no envio do orçamento e resposta real do cliente via webhook ChatPro.
- **Admin:** leads (semana + consulta), métricas (`/dashboard/analytics`), CRUD equipamentos com fotos (Blob), CMS de dicas (TipTap).
- **SEO / migração:** redirects 301 do WordPress (`legacy-redirects.json`), sitemap, JSON-LD, `llms.txt` / `catalog.json`.

Histórico de sprints: **[CHANGELOG.md](CHANGELOG.md)** · planejamento: **[ROADMAP.temp.md](ROADMAP.temp.md)**

---

## Publicar (Vercel)

- Branch **main** → deploy automático.
- Build: `npm run build` (roda `db:migrate` antes do Next — ver `vercel.json`).

```shell
git push origin main
```

Variáveis obrigatórias em **Production:** Clerk, `DATABASE_URL`, `NEXT_PUBLIC_APP_URL`, Blob Public (`BLOB_STORE_ID`, `BLOB_ACCESS=public`). Go-live com domínio oficial: **[docs/GO-LIVE-GATE.md](docs/GO-LIVE-GATE.md)**

---

## Documentação

| Tópico | Arquivo |
|--------|---------|
| Go-live e DNS | [docs/GO-LIVE-GATE.md](docs/GO-LIVE-GATE.md) |
| Passos manuais (Clerk, Resend, CRM) | [docs/PASSOS-MANUAIS.md](docs/PASSOS-MANUAIS.md) |
| Deploy / preview Vercel | [docs/DEPLOY-PREVIEW-VERCEL.md](docs/DEPLOY-PREVIEW-VERCEL.md) |
| Clerk e papéis do painel | [docs/CLERK-ACESSO-ADMIN.md](docs/CLERK-ACESSO-ADMIN.md) |
| GA4 e Google Ads | [docs/GOOGLE-ADS-GA4.md](docs/GOOGLE-ADS-GA4.md) |
| ChatPro ROI e worker local | [docs/CHATPRO-ROI-WORKER.md](docs/CHATPRO-ROI-WORKER.md) |
| API interna para app externo | [docs/INTERNAL-ADS-QUALITY-API.md](docs/INTERNAL-ADS-QUALITY-API.md) |
| Migração SEO WordPress | [docs/MIGRACAO-SEO-WP.md](docs/MIGRACAO-SEO-WP.md) |
| GEO / IAs (`llms.txt`) | [docs/GEO-AI-SEARCH.md](docs/GEO-AI-SEARCH.md) |
| Fotos de equipamentos | [docs/SPRINT-9-FOTOS.md](docs/SPRINT-9-FOTOS.md) |
| Validação do preview | [docs/PREVIEW-VALIDACAO.md](docs/PREVIEW-VALIDACAO.md) |
| CI e branch protection | [docs/CI.md](docs/CI.md) |
| Fluxo solo (`main` direto) | [docs/FLUXO-SOLO.md](docs/FLUXO-SOLO.md) |
| Sitelinks / RSA (agência Ads) | [src/data/google-ads-rsa-suggestions.json](src/data/google-ads-rsa-suggestions.json) |

Scripts: `docs/scripts/audit-legacy-redirects.mjs` · `audit-equipment-catalog.mjs` · `import-google-ads-urls.mjs`

---

## Licença

Código sob [MIT License](LICENSE). Conteúdo institucional e marca pertencem à Acesso Equipamentos.
