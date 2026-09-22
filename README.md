# Acesso Equipamentos — Site institucional e captação de orçamentos

[![CI](https://github.com/Agu1lar/Site-Acesso-Equipamentos/actions/workflows/CI.yml/badge.svg)](https://github.com/Agu1lar/Site-Acesso-Equipamentos/actions/workflows/CI.yml)

Site da **Acesso Equipamentos** (locação de equipamentos para construção civil). Catálogo público, carrinho de orçamento, envio via **WhatsApp** com confirmação de resposta pelo ChatPro, leads no **PostgreSQL**, e-mail interno (**Resend**) e painel admin com **login por senha** (`/dashboard`).

| Ambiente | URL |
|----------|-----|
| Produção | [acessoequipamentos.com.br](https://acessoequipamentos.com.br/) |
| Preview Vercel | [landing-page-acesso.vercel.app](https://landing-page-acesso.vercel.app/) |

---

## Rodar localmente

**Requisitos:** Node.js **20+** (recomendado 22+), `.env.local` com `DATABASE_URL` (ou PGlite no `dev`) e `DASHBOARD_SESSION_SECRET` (≥ 32 caracteres) se for usar o painel.

```shell
cp .env.example .env.local   # Windows: copie manualmente
npm install
npm run dev
```

Abra **http://localhost:3000**

Migrações: aplicadas no `npm run dev` ou com `npm run db:migrate` se usar Neon.

### Painel admin (opcional)

1. Defina `DASHBOARD_SESSION_SECRET` no `.env.local`.
2. Após migrações, use o usuário seed (ver [docs/CLERK-ACESSO-ADMIN.md](docs/CLERK-ACESSO-ADMIN.md) — título legado; o login é por senha).
3. `/sign-in` → `/dashboard/leads` · gerencie acessos em **Painel → Acesso**.

### Comandos úteis

| Comando | Uso |
|---------|-----|
| `npm run dev` | PGlite + Next.js |
| `npm run build` | Migrações + build produção |
| `npm run check:types` | TypeScript |
| `npm run lint` | Lint |
| `npm run test` | Vitest |
| `npm run test:e2e` | Playwright |

Variáveis: [.env.example](.env.example) · e-mail leads: `RESEND_*` · analytics: `NEXT_PUBLIC_POSTHOG_*`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_GOOGLE_ADS_*`

---

## Stack

**Next.js 16** (App Router) · **TypeScript** · **Tailwind v4** · **next-intl** (pt-BR) · **Drizzle** + **PostgreSQL** (Neon / PGlite) · **login por senha** (sessão no Neon) · **Vercel Blob** · **Resend** · **PostHog** + **GA4** / **Google Ads** (Consent Mode) · deploy **Vercel**

Workers locais (opcionais): **`chatpro-local/`** (ROI Claude no Neon) · **`chatpro-playbook/`** (inbox → Postgres `:5434` → Obsidian + after-hours)

---

## O que o projeto faz (resumo)

### Site público
- **Catálogo e orçamento:** home, `/equipamentos`, categorias, fichas, carrinho multi-item → lead no banco → WhatsApp + e-mail comercial (**Resend**).
- **SEO regional (S4):** landings por cidade × categoria em `/regioes/{cidade}/{categoria}` — **12 cidades × 4 categorias = 48 URLs** indexáveis.
- **Conteúdo:** blog `/dicas` (CMS TipTap + rascunho assistido por Claude no admin), FAQ, contato, redirects 301 do WordPress (`legacy-redirects.json`), sitemap, `llms.txt` / `catalog.json`.

### Rastreamento e campanhas
- **Atribuição paga:** origem Google Ads/GA4 (`gclid` / `gbraid` / `wbraid`, UTM), clique no WhatsApp, abertura do WhatsApp no envio do orçamento.
- **Conversões otimizadas:** hash SHA-256 de e-mail/telefone (orçamento, One Tap, telefone opcional) no `user_data` da tag Ads — melhora atribuição no iOS. Guia: [docs/GOOGLE-ADS-GA4.md](docs/GOOGLE-ADS-GA4.md).
- **Ponte clique → lead:** código `Cód. AB12CD34` no prefill do `wa.me` liga visitante de campanha ao lead mesmo sem formulário (`whatsapp_attribution_tokens`).
- **Resposta real:** webhook **ChatPro** marca `whatsapp_replied_at` no CRM. Status `contacted` só avança quando um **humano** assume a sessão no ChatPro (`assigned_session`), não na primeira mensagem do cliente.

### ChatPro ROI (leads de campanha)
Pipeline **fora do painel** — só leads com atribuição paga (`gclid`/`gbraid`/`wbraid` ou `utm_medium` cpc/ppc/paid):

1. **Vercel** recebe webhook → grava `chatpro_messages` + outbox (texto, PDF, imagem, **áudio**).
2. **Worker local** (`chatpro-local/`) faz poll da outbox, debounce por lead, chama **Claude** e grava evaluation no Neon.
3. **Análise incremental:** 1ª vez lê a conversa inteira; depois só mensagens novas (reprocessa tudo se chegar PDF/imagem/áudio).
4. **Áudio:** Whisper local no worker (opcional `OPENAI_API_KEY` na Vercel para ingestão).
5. **Painel:** `/dashboard/chatpro-roi` — evaluations, funil, deal likelihood.
6. **Relatório Ads:** API/CLI cruza evaluations × CRM won × gasto Google Ads.

Detalhes: **[docs/CHATPRO-ROI-WORKER.md](docs/CHATPRO-ROI-WORKER.md)** · setup: **[chatpro-local/README.md](chatpro-local/README.md)**

### ChatPro playbook (cofre + after-hours)
Package **paralelo** (`chatpro-playbook/`): puxa a inbox da ChatPro → Postgres Docker **`:5434`** → notas Obsidian (Comercial / Logística / Mecânica). Não usa Neon e **não** substitui o webhook do site nem o ROI.

- Worker de sync + aprendizado no vault
- Aviso fora do expediente (sandbox por padrão; live com travas)
- Sandbox local para testar o bot sem WhatsApp

Guia: **[docs/CHATPRO-PLAYBOOK.md](docs/CHATPRO-PLAYBOOK.md)** · ops: **[chatpro-playbook/README.md](chatpro-playbook/README.md)**

### Admin (`/dashboard`, senha)
- Leads (semana + consulta), **clientes** (CRM-lite), métricas (`/dashboard/analytics` — 6 seções; campanhas UTM em **Tráfego**), ChatPro ROI, CRUD equipamentos (**Vercel Blob**), CMS de dicas (TipTap + gerador IA).
- **Acesso:** e-mail allowlist + senha + sessão + papel (`admin` / `comercial`) + rate limit. Login funciona de **qualquer rede** (sem gate por IP). Guia: [docs/CLERK-ACESSO-ADMIN.md](docs/CLERK-ACESSO-ADMIN.md).

Histórico: **[CHANGELOG.md](CHANGELOG.md)** · planejamento: **[ROADMAP.temp.md](ROADMAP.temp.md)**

---

## Publicar (Vercel)

- Branch **main** → deploy automático.
- Build: `npm run build` (roda `db:migrate` antes do Next — ver `vercel.json`).

```shell
git push origin main
```

Variáveis obrigatórias em **Production:** `DATABASE_URL`, `DASHBOARD_SESSION_SECRET`, `NEXT_PUBLIC_APP_URL`, Blob Public (`BLOB_STORE_ID`, `BLOB_ACCESS=public`). Go-live: **[docs/GO-LIVE-GATE.md](docs/GO-LIVE-GATE.md)**

---

## Documentação

| Tópico | Arquivo |
|--------|---------|
| Go-live e DNS | [docs/GO-LIVE-GATE.md](docs/GO-LIVE-GATE.md) |
| Passos manuais (Resend, CRM, DNS) | [docs/PASSOS-MANUAIS.md](docs/PASSOS-MANUAIS.md) |
| Deploy / preview Vercel | [docs/DEPLOY-PREVIEW-VERCEL.md](docs/DEPLOY-PREVIEW-VERCEL.md) |
| Acesso ao painel (senha / papéis) | [docs/CLERK-ACESSO-ADMIN.md](docs/CLERK-ACESSO-ADMIN.md) |
| GA4 e Google Ads (tag, Conversões otimizadas, offline) | [docs/GOOGLE-ADS-GA4.md](docs/GOOGLE-ADS-GA4.md) |
| Google One Tap e leads cookie | [docs/GOOGLE-ONE-TAP.md](docs/GOOGLE-ONE-TAP.md) |
| ChatPro ROI e worker local | [docs/CHATPRO-ROI-WORKER.md](docs/CHATPRO-ROI-WORKER.md) |
| ChatPro playbook (Obsidian / after-hours) | [docs/CHATPRO-PLAYBOOK.md](docs/CHATPRO-PLAYBOOK.md) |
| API interna para app externo | [docs/INTERNAL-ADS-QUALITY-API.md](docs/INTERNAL-ADS-QUALITY-API.md) |
| Migração SEO WordPress | [docs/MIGRACAO-SEO-WP.md](docs/MIGRACAO-SEO-WP.md) |
| Arquitetura SEO (regiões, S4, interlinks) | [docs/SEO-ARQUITETURA.md](docs/SEO-ARQUITETURA.md) |
| GEO / IAs (`llms.txt`, WebMCP) | [docs/GEO-AI-SEARCH.md](docs/GEO-AI-SEARCH.md) |
| Fotos de equipamentos | [docs/SPRINT-9-FOTOS.md](docs/SPRINT-9-FOTOS.md) |
| Validação do preview | [docs/PREVIEW-VALIDACAO.md](docs/PREVIEW-VALIDACAO.md) |
| CI e branch protection | [docs/CI.md](docs/CI.md) |
| Fluxo solo (`main` direto) | [docs/FLUXO-SOLO.md](docs/FLUXO-SOLO.md) |
| Sitelinks / RSA (agência Ads) | [src/data/google-ads-rsa-suggestions.json](src/data/google-ads-rsa-suggestions.json) |

Scripts: `docs/scripts/audit-legacy-redirects.mjs` · `audit-equipment-catalog.mjs` · `import-google-ads-urls.mjs`

---

## Licença

Código sob [MIT License](LICENSE). Conteúdo institucional e marca pertencem à Acesso Equipamentos.
