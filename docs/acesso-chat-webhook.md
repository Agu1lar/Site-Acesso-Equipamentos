# Acesso Chat → painel administrativo do site

O endpoint `POST /api/webhooks/chatwoot` recebe os webhooks nativos do Chatwoot. Configure `CHATWOOT_WEBHOOK_SECRET` na Vercel com o mesmo segredo do webhook no Acesso Chat. A assinatura HMAC SHA-256 usa os cabeçalhos `X-Chatwoot-Timestamp` e `X-Chatwoot-Signature`, com tolerância de cinco minutos.

Assine `message_created`, `message_updated` e `conversation_updated` na conta 3. O adaptador aceita apenas a caixa WhatsApp de produção (2), mensagens públicas e mudanças explícitas de atendente humano. Notas internas, mensagens de atividade e a caixa de teste são ignoradas.

A integração reutiliza o processamento existente de atribuição de campanhas, correspondência de leads, histórico e conversões. Os nomes internos `chatpro_*` permanecem para preservar os dados existentes. Os novos eventos têm identificadores com prefixo `chatwoot:3:`, evitando colisões com o histórico do provedor anterior.

Antes de habilitar o webhook, confirme `GET /api/webhooks/chatwoot` com `configured: true`, uma requisição sem assinatura retornando 401 e uma requisição de teste assinada, com evento não reconhecido, retornando `ignored: true`. Depois valide um atendimento real do site no painel, sem criar leads ou conversões fictícios.
