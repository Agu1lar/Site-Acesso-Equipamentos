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
| `CHATPRO_LOCAL_POLL_MS` | Poll da outbox (padrão 900000 = 15 min) |
| `CHATPRO_LOCAL_CONSUME_MS` | Processamento da fila local (padrão acompanha o poll = 15 min) |
| `DASHBOARD_NETWORK_HEARTBEAT_MS` | Renovação do IP autorizado do painel (padrão 21600000 = 6h) |
| `CHATPRO_LOCAL_DEBOUNCE_MS` | Espera antes de analisar (padrão 1800000 = 30 min) |
| `CHATPRO_LOCAL_WHISPER` | Transcrição local de áudio: `off`, `transformers` ou `cli` |
| `CHATPRO_LOCAL_WHISPER_MODEL` | Modelo Hugging Face (padrão `Xenova/whisper-small`) |
| `WHISPER_CLI` | Caminho do `whisper-cli` (modo `cli`) |
| `WHISPER_MODEL` | Caminho do modelo `.bin` (modo `cli`) |

## Transcrição local de áudio (sem OpenAI)

O worker pode transcrever áudios **na sua máquina** antes do Claude analisar. Não precisa de `OPENAI_API_KEY`.

### Modo recomendado — Transformers (Node)

No `.env`:

```env
CHATPRO_LOCAL_WHISPER=transformers
# opcional — modelo menor e mais rápido:
# CHATPRO_LOCAL_WHISPER_MODEL=Xenova/whisper-tiny
```

Na primeira transcrição, o modelo é baixado (~150 MB para `whisper-small`). Depois fica em cache.

Reinstale dependências após atualizar (`npm install` inclui ffmpeg embutido):

```powershell
cd chatpro-local
npm install
npm run test:whisper -- 91
npm start
```

`npm run test:whisper -- {leadId}` transcreve áudios sem texto de um lead (dry-run, não chama Claude).

### Modo alternativo — whisper.cpp (CLI)

Se você já tem [whisper.cpp](https://github.com/ggerganov/whisper.cpp) instalado:

```env
CHATPRO_LOCAL_WHISPER=cli
WHISPER_CLI=C:\caminho\whisper-cli.exe
WHISPER_MODEL=C:\caminho\ggml-small.bin
```

### Fluxo

1. Lead manda áudio no WhatsApp → webhook salva `media_url` (texto pode ficar vazio).
2. Worker local puxa a conversa → baixa o áudio → Whisper local transcreve.
3. Claude recebe o texto transcrito na análise ROI.

A transcrição **não** é gravada de volta no Neon hoje — só entra na análise. Se quiser persistir, avise.

## IP autorizado do painel

Ao iniciar, este worker chama `POST /api/internal/v1/dashboard-network/heartbeat` com `INTERNAL_API_SECRET`. O site grava o IP público que a Vercel detecta para este PC e libera o dashboard por 36 horas. Enquanto o worker estiver aberto, ele renova essa autorização a cada 6 horas.

Na prática: ligou o PC e iniciou `npm start` em `chatpro-local/`, o IP atual da rede é atualizado automaticamente no site. Não precisa editar `DASHBOARD_ALLOWED_IPS` nem redeployar por mudança de IP.

## Economia no Neon Free

O Neon Free inclui cerca de 100 CU-hours por projeto/mês. Se o worker consulta o site a cada 30 segundos, o banco tende a ficar acordado 24h/dia:

```text
1 CU x 24h x 30 dias = 720 CU-hours/mês
0.25 CU x 24h x 30 dias = 180 CU-hours/mês
```

Com poll de 15 minutos e auto-suspend de 5 minutos, o teto teórico fica perto de:

```text
96 consultas/dia x 5 min = 8h/dia
0.25 CU x 8h x 30 dias = 60 CU-hours/mês
```

Isso deixa margem dentro do Free. Para gastar ainda menos, use `CHATPRO_LOCAL_POLL_MS=1800000` (30 min), que reduz o teto para cerca de 30 CU-hours/mês em 0.25 CU.

## Fluxo completo

1. `GET …/chatpro-roi/events` — puxa outbox pendente
2. Enfileira no SQLite (`job_id` = `externalId`, idempotente)
3. Após debounce → `GET …/leads/{id}/context` — lead + histórico (+ evaluation anterior)
4. Claude analisa (1ª vez: conversa completa; depois: só msgs novas)
5. `POST …/chatpro-roi/evaluations` — salva no Neon
6. `POST …/chatpro-roi/events` — **ack só depois** da análise (ou skip seguro)

Não rode `scripts/chatpro-roi-worker.mjs` ao mesmo tempo que este consumer (duplica Claude).

O consumer também aceita somente **uma instância por arquivo SQLite**. Se outro `npm start` já estiver usando a mesma fila, a segunda inicialização encerra com `worker_already_running`, mostrando o PID existente. Use `npm run status` para consultar o pipeline sem abrir outro worker.

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

### Como ler erros do terminal

Erros agora mostram `categoria`, `codigo`, se haverá nova tentativa, endpoint seguro e uma ação recomendada. Headers, `INTERNAL_API_SECRET`, chave Anthropic e query sensível nunca aparecem.

| Categoria | Significado | Ação usual |
|---|---|---|
| `network` | DNS, conexão recusada/interrompida ou internet | conferir rede/URL; retry automático |
| `timeout` | servidor não respondeu em 30 segundos | retry automático |
| `authentication` | HTTP 401/403 ou chave Anthropic inválida | conferir secrets; Anthropic inválida pausa até reiniciar |
| `not_found` | rota HTTP 404 | conferir URL e deploy |
| `rate_limit` | HTTP 429 | aguardar retry automático |
| `remote_server` | HTTP 5xx | conferir deploy/banco se persistir |
| `invalid_response` | resposta não é JSON/contrato esperado | conferir URL e versão publicada |
| `configuration` | variável ausente, mídia bloqueada ou worker duplicado | corrigir `.env`/processo e reiniciar |

Exemplo:

```text
[chatpro-local] ERRO poll da outbox — Não foi possível conectar ao servidor remoto.
  detalhes: { categoria: 'network', codigo: 'fetch_events_fetch_failed', repetira: 'sim', ... }
  ação: Confira a internet e a URL; o worker tentará novamente.
```

### Heartbeat do dashboard

Log esperado ao iniciar:

```text
[chatpro-local] dashboard network renewed {
  ok: true,
  ipAddress: '...',
  expiresAt: '...'
}
```

Falhas comuns:

- `dashboard_network_heartbeat_failed:404`: a produção ainda não publicou a rota nova, ou `CHATPRO_LOCAL_API_URL` aponta para outro ambiente. Aguarde o deploy e reinicie o worker.
- `dashboard_network_heartbeat_failed:401`: `INTERNAL_API_SECRET` local diferente do secret configurado na Vercel.
- `dashboard_network_heartbeat_failed:500`: erro no servidor/banco; verificar `/api/health` e migrations.
