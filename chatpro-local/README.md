# ChatPro local consumer

Serviço na sua máquina: **poll** da outbox na Vercel → **fila SQLite idempotente** → **debounce por lead** → **Claude** → grava evaluation no Neon.

## Setup

```powershell
cd chatpro-local
copy .env.example .env
# CHATPRO_LOCAL_API_URL=https://acessoequipamentos.com.br
# INTERNAL_API_SECRET=...
# ANTHROPIC_API_KEY=sk-ant-...
npm install
npm start
```

## Variáveis

| Variável | Descrição |
|----------|-----------|
| `CHATPRO_LOCAL_API_URL` | URL do site em produção |
| `INTERNAL_API_SECRET` | Mesmo secret da Vercel |
| `ANTHROPIC_API_KEY` | **Obrigatório** para análise Claude |
| `ANTHROPIC_MODEL` | Padrão `claude-haiku-4-5-20251001` |
| `CHATPRO_LOCAL_SQLITE_PATH` | Fila local (padrão `./data/chatpro-local.db`) |
| `CHATPRO_LOCAL_POLL_MS` | Poll da outbox (padrão 60000) |
| `CHATPRO_LOCAL_DEBOUNCE_MS` | Espera antes de analisar (padrão 1800000 = 30 min) |

## Fluxo completo

1. `GET …/chatpro-roi/events` — puxa outbox pendente
2. Enfileira no SQLite (`job_id` = `externalId`, idempotente)
3. Após debounce → `GET …/leads/{id}/context` — lead + histórico (+ evaluation anterior)
4. Claude analisa (1ª vez: conversa completa; depois: só msgs novas)
5. `POST …/chatpro-roi/evaluations` — salva no Neon
6. `POST …/chatpro-roi/events` — **ack só depois** da análise (ou skip seguro)

Não rode `scripts/chatpro-roi-worker.mjs` ao mesmo tempo que este consumer (duplica Claude).

## Windows — rodar com o PC

Agendador de Tarefas no logon, ou PM2/nssm para manter o processo ativo.

## Depuração

```powershell
# Status da fila + evaluations recentes
npm run status

# Reduzir debounce para testar (5 minutos)
$env:CHATPRO_LOCAL_DEBOUNCE_MS=300000
npm start
```

Ver pending: `GET /api/internal/v1/chatpro-roi/summary` (ou `npm run status`).
