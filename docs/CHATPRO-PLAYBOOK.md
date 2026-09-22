# ChatPro playbook — índice

Worker **paralelo** ao site Next.js e ao `chatpro-local` (ROI). Puxa atendimentos da **ChatPro Chat**, grava em **Postgres local** (Docker porta **5434**) e gera notas no cofre **Obsidian**. **Não usa Neon** e **não substitui** o webhook `POST /api/webhooks/chatpro` do site.

| Pacote | Banco | Função |
|--------|-------|--------|
| Site + webhook (Vercel) | Neon | Leads, CRM, ROI outbox, atribuição Ads |
| [`chatpro-local/`](../chatpro-local/README.md) | Neon (via API interna) | Claude avalia leads **de campanha** |
| [`chatpro-playbook/`](../chatpro-playbook/README.md) | Postgres `:5434` | Inbox → Obsidian + after-hours + sandbox |

## O que o playbook faz

- Sync periódico da inbox (até ~40 WhatsApps distintos por tick)
- Pastas de equipe no vault: Comercial / Logística / Mecânica
- Transcrição de áudio (Whisper local) e resumo de PDF/foto (Haiku)
- **After-hours:** aviso fixo fora de seg–sex 7h30–17h15 BRT (sandbox por padrão)
- **Sandbox:** conversa local para testar regras e catálogo sem enviar WhatsApp
- Deploy VPS opcional (DigitalOcean) via `scripts/deploy-vps.ps1`

Regras duras da IA: **nunca confirma preço, frete nem disponibilidade**; recomendações só com base no catálogo publicado.

## Documentação operacional

Tudo o que é setup, env, live gates e comandos está no package:

→ **[chatpro-playbook/README.md](../chatpro-playbook/README.md)**

## Relação com o webhook do site

O webhook do site continua sendo a fonte de verdade para CRM/ROI. Ele reconhece `received_message`, `sent_message`, `assigned_session` e `transferred_session`:

- Mensagem do cliente → `whatsapp_replied_at` / atividade
- **`contacted`** no lead só quando um humano assume (`assigned_session` com `assing_to`)

Detalhes Ads/CRM: [GOOGLE-ADS-GA4.md](./GOOGLE-ADS-GA4.md) · ROI: [CHATPRO-ROI-WORKER.md](./CHATPRO-ROI-WORKER.md)
