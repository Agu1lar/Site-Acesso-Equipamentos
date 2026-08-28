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

### Site público
- **Catálogo e orçamento:** home, `/equipamentos`, categorias, fichas, carrinho multi-item → lead no banco → WhatsApp + e-mail comercial (**Resend**).
- **SEO regional (S4):** landings por cidade × equipamento em `/regioes/{cidade}/{equipamento}` (BH, Contagem, Betim, Nova Lima, Santa Luzia, Ibirité, Vespasiano, Lagoa Santa, etc.) com JSON-LD e matriz de URLs indexáveis.
- **Conteúdo:** blog `/dicas` (CMS TipTap), FAQ, contato, redirects 301 do WordPress (`legacy-redirects.json`), sitemap, `llms.txt` / `catalog.json`.

### Rastreamento e campanhas
- **Atribuição paga:** origem Google Ads/GA4 (`gclid`, UTM), clique no WhatsApp, abertura do WhatsApp no envio do orçamento.
- **Ponte clique → lead:** código `Cód. AB12CD34` no prefill do `wa.me` liga visitante de campanha ao lead mesmo sem formulário (`whatsapp_attribution_tokens`).
- **Resposta real:** webhook **ChatPro** marca `whatsapp_replied_at` no CRM para qualquer lead.

### ChatPro ROI (leads de campanha)
Pipeline **fora do painel** — só leads com atribuição paga (`gclid`/`gbraid`/`wbraid` ou `utm_medium` cpc/ppc/paid):

1. **Vercel** recebe webhook → grava `chatpro_messages` + outbox (texto, PDF, imagem, **áudio**).
2. **Worker local** (`chatpro-local/`) faz poll da outbox, debounce por lead, chama **Claude** e grava evaluation no Neon.
3. **Análise incremental:** 1ª vez lê a conversa inteira; depois só mensagens novas (reprocessa tudo se chegar PDF/imagem/áudio).
4. **Áudio:** webhook usa `alt_message` do ChatPro quando disponível; no worker, **Whisper local** (sem OpenAI) transcreve áudios antes do Claude. Opcional na Vercel: `OPENAI_API_KEY` para Whisper na ingestão.
5. **Painel:** `/dashboard/chatpro-roi` — histórico de evaluations, estágio do funil, deal likelihood, equipamentos mencionados.
6. **Relatório Ads:** API/CLI cruza evaluations × CRM won × gasto Google Ads por campanha.

Detalhes: **[docs/CHATPRO-ROI-WORKER.md](docs/CHATPRO-ROI-WORKER.md)** · setup worker: **[chatpro-local/README.md](chatpro-local/README.md)**

### Admin (`/dashboard`, Clerk)
- Leads (semana + consulta), métricas operacionais (`/dashboard/analytics`), CRUD equipamentos com fotos (**Vercel Blob**), CMS de dicas.
- **IP dinâmico:** worker local renova autorização de rede via heartbeat (36 h) — não precisa editar allowlist a cada mudança de IP.

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
