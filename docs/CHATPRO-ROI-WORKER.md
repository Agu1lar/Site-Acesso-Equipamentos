# ChatPro ROI — outbox + consumer local

Análise de conversas ChatPro com Claude, **fora do painel admin**. A Vercel grava eventos; sua máquina consome via poll + fila SQLite idempotente.

## Arquitetura (pull + outbox)

```
ChatPro → POST /api/webhooks/chatpro (Vercel)
            ├─ whatsapp_replied_at no lead (todos os leads)
            └─ chatpro_messages + outbox **somente leads de campanha**

chatpro-local/ (sua máquina)
            ├─ poll GET …/chatpro-roi/events?since=0
            ├─ fila SQLite (job_id = externalId, dedup)
            ├─ debounce 30 min por lead
            ├─ GET …/leads/{id}/context (403 se não for campanha)
            ├─ Claude → POST …/evaluations
            └─ POST …/events { outboxIds } — ack **após** análise
```

## Regra: Claude só lê campanhas

O Claude **nunca** analisa conversas orgânicas ou sem atribuição paga. Mensagens entram no pipeline ROI apenas quando o lead tem:

- `gclid`, `gbraid` ou `wbraid`, ou
- `utm_medium` cpc/ppc/paid, ou
- Google Ads (`utm_source` google + medium)

`utm_campaign` sozinho **não** entra no pipeline.

Leads orgânicos continuam marcando `whatsapp_replied_at` no CRM, mas **não** geram `chatpro_messages`, outbox nem evaluation.

## Clique WhatsApp sem formulário (ponte por ref)

Visitantes de campanha que clicam no botão WhatsApp **sem** preencher o orçamento recebem um código curto no texto do `wa.me`:

```
Olá! Tenho interesse… Origem: site-home. Cód. AB12CD34
```

Fluxo:

1. Clique rastreado → `POST /api/analytics` grava `whatsapp_click` e devolve `refCode` (só com atribuição paga).
2. Browser abre `wa.me` com o suufixo `Cód. …` no prefill.
3. ChatPro recebe a 1ª mensagem → webhook extrai o código, cria lead `whatsapp_click` (ou enriquece lead existente pelo telefone) com gclid/UTM.
4. Pipeline ROI segue igual ao lead de formulário.

Tabela: `whatsapp_attribution_tokens` (`0039_whatsapp_attribution_tokens.sql`). Ref expira em 7 dias.

Se o visitante apagar o código antes de enviar, volta ao comportamento antigo (só match por telefone de formulário).

## Migrações

```bash
npm run db:migrate
```

- `0037_chatpro_roi_worker.sql` — messages + evaluations
- `0038_chatpro_outbox.sql` — outbox pull
- `0039_whatsapp_attribution_tokens.sql` — ponte clique WhatsApp → ChatPro

## API interna

Todas exigem `Authorization: Bearer INTERNAL_API_SECRET`.

| Método | Rota | Função |
|--------|------|--------|
| GET | `/api/internal/v1/chatpro-roi/events?since=0&limit=50` | Poll outbox |
| POST | `/api/internal/v1/chatpro-roi/events` | Ack `{ "outboxIds": [1,2] }` |
| POST | `/api/internal/v1/chatpro-roi/evaluations` | Grava resultado Claude |
| GET | `/api/internal/v1/chatpro-roi/leads/{id}/context` | Lead + mensagens para Claude |
| GET | `/api/internal/v1/chatpro-roi/summary` | Status geral |
| GET | `/api/internal/v1/chatpro-roi/report?campaignPrefix=…` | Relatório ROI × Ads |

## Consumer local

Ver `chatpro-local/README.md`.

```powershell
cd chatpro-local
copy .env.example .env
npm install
npm start
```

## Worker legado (opcional)

`scripts/chatpro-roi-worker.mjs` ainda funciona (lê Neon direto). Preferir `chatpro-local` para fila + idempotência.

## Idempotência

| Camada | Chave |
|--------|-------|
| Neon messages | `external_id` único |
| Neon outbox | `external_id` único |
| SQLite local | `job_id` (= externalId) UNIQUE |
| Ack | Só marca `delivered_at` após Claude (ou skip seguro) no consumer local |

PDFs baixados para Claude usam allowlist de hosts (`chatpro.com.br`, etc.) + `CHATPRO_PDF_URL_ALLOWLIST` opcional. HTTP e IPs privados são bloqueados.

## Fase 2 (Claude local)

O consumer em `chatpro-local/`:

- Busca contexto completo via `GET /api/internal/v1/chatpro-roi/leads/{id}/context`
- Chama Claude (`chatpro-roi-ai-core.ts`) com PDFs de contrato
- Grava via `POST /api/internal/v1/chatpro-roi/evaluations`

## Sandbox Claude (local)

Valida preflight + chamada Claude **sem gravar no banco**:

```powershell
npx dotenv-cli -e .env.local -o -- npx tsx scripts/chatpro-roi-sandbox.mjs
npx dotenv-cli -e .env.local -o -- npx tsx scripts/chatpro-roi-sandbox.mjs --mock-only
```

Use `-o` para o `.env.local` sobrescrever uma `ANTHROPIC_API_KEY` antiga já presente no shell.

Requer `ANTHROPIC_API_KEY` válida (`.env.local` e Vercel Production). Se retornar 401, gere nova chave em [console.anthropic.com](https://console.anthropic.com/).

## ROI Ads

Relatório cruzando **won no CRM**, **sinais Claude** (`closed_won`, valor estimado) e **gasto Ads manual** por campanha.

### API

```http
GET /api/internal/v1/chatpro-roi/report?campaignPrefix=nova_&from=2026-08-01&to=2026-08-31
Authorization: Bearer INTERNAL_API_SECRET
```

Gasto opcional (JSON URL-encoded) ou automático:

```http
GET /api/internal/v1/chatpro-roi/report?campaignPrefix=nova_&useGoogleAdsSpend=true
```

```http
GET /api/internal/v1/chatpro-roi/report?campaignPrefix=nova_&spendJson=%7B%22nova_plataformas_mg%22%3A2400%7D
```

Retorno por campanha: `leads`, `crmWon`, `aiClosedWon`, `estimatedMonthlyValueBrl`, `spendBrl`, `costPerLeadBrl`, `costPerAiWonBrl`, `estimatedRoas`.

### CLI local

```powershell
# Gasto automático Google Ads API
dotenv -c -- npx tsx scripts/chatpro-roi-report.mjs --campaignPrefix=nova_ --use-google-ads-spend

# Manual (JSON) ou híbrido
dotenv -c -- npx tsx scripts/chatpro-roi-report.mjs --campaignPrefix=nova_ --from=2026-08-01 --to=2026-08-31 --spend-file=docs/examples/campaign-spend.example.json
```

Sem `DATABASE_URL` (só API remota):

```powershell
dotenv -c -- npx tsx scripts/chatpro-roi-report.mjs --remote --campaignPrefix=nova_ --use-google-ads-spend
```

**Google Ads API:** configure as env vars e use `useGoogleAdsSpend=true` na API ou `--use-google-ads-spend` no CLI. Detalhes em [GOOGLE-ADS-ROI-API.md](./GOOGLE-ADS-ROI-API.md).

Gasto manual (`spendJson` / `--spend-file`) sobrescreve valores da API para a mesma campanha.
