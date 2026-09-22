# Google Analytics 4 + Google Ads — configuração pós-deploy

O site envia **conversões para o GA4** quando o visitante aceita cookies de analytics. Use o GA4 para alimentar o **Google Ads** (o problema de “0 conversões” no site antigo era ausência de tag no clique WhatsApp/orçamento).

## O que o código faz

| Evento/sinal | Quando dispara | Uso no Ads |
|--------------|----------------|------------|
| `whatsapp_click` | Clique em qualquer botão WhatsApp rastreado | Conversão auxiliar de intenção |
| `phone_click` | Clique em `tel:` (barra mobile, orçamento) | Conversão secundária |
| `generate_lead` | Orçamento enviado com sucesso (formulário) | Conversão primária inicial |
| `whatsapp_opened` | O navegador conseguiu abrir o WhatsApp após o envio do orçamento | Sinal operacional no painel |
| `whatsapp_replied_at` | ChatPro registrou mensagem recebida do cliente | Sinal comercial de conversa real |

Além disso:

- **`gclid` / `gbraid` / `wbraid`** da URL são guardados no lead (Neon) e nos eventos internos — para cruzar com campanhas.
- **Consent Mode v2**: GA4 só grava após “Aceitar analytics” (mesmo banner do PostHog).
- Tag automática do Google Ads (`gclid` na URL) deve permanecer **ativada** na conta.
- **Conversões otimizadas** (Enhanced Conversions): quando há e-mail/telefone na sessão, a tag Ads recebe `user_data` hasheado (SHA-256) para melhorar atribuição no iOS — ver seção abaixo.

O funil de WhatsApp fica separado em três camadas:

```text
clique no botão → WhatsApp aberto → cliente respondeu no ChatPro
```

Na prática, `whatsapp_click` mede intenção, `whatsapp_opened` mostra que o fluxo conseguiu abrir o aplicativo/site do WhatsApp, e `whatsapp_replied_at` confirma que a conversa realmente começou com mensagem recebida do cliente.

### Backup server-side para Google Ads

Quando a Google Ads API estiver configurada, o backend também envia uma conversão offline para cliques no WhatsApp com `gclid`, `gbraid` ou `wbraid`. Isso reduz perda por bloqueio de navegador, fechamento rápido da aba ou falha da tag client-side.

Esse backup exige uma ação de conversão separada no Google Ads, criada como **Importação de cliques** (`UPLOAD_CLICKS`). Configure na Vercel:

```env
GOOGLE_ADS_OFFLINE_CONVERSION_ACTION_ID=123456789
```

ou:

```env
GOOGLE_ADS_OFFLINE_CONVERSION_ACTION_RESOURCE_NAME=customers/1234567890/conversionActions/123456789
```

O status aparece em `/api/health` como `googleAdsOfflineConversionConfigured`.

### Webhook ChatPro

O site expõe:

```text
POST /api/webhooks/chatpro?token=SEU_SECRETO
```

Configure o mesmo valor em `CHATPRO_WEBHOOK_SECRET`. O endpoint aceita o segredo por query string, `x-chatpro-secret`, `x-webhook-secret` ou `Authorization: Bearer`.

Regras atuais:

- só eventos inbound do cliente marcam resposta (`whatsapp_replied_at`);
- abertura de sessão (`opened_session`) não conta como resposta;
- o match é feito por telefone normalizado contra leads recentes/ativos dos últimos 45 dias;
- na primeira resposta, o lead recebe `whatsapp_replied_at`, `last_activity_at` e nota interna do ChatPro;
- status **`contacted`** só avança quando o ChatPro envia `assigned_session` com atendente humano (`assing_to`) — mensagem do cliente ou do bot **não** promove o lead sozinha;
- também há parsing de `sent_message` (status de entrega) e `transferred_session`.

---

## Conversão única do Google Ads (tag direta)

Independente do GA4, o site dispara **uma única ação de conversão** do Ads para os três CTAs de contato: botão WhatsApp, envio do orçamento e clique em `tel:`.

```env
NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_CONTACT=AW-XXXXXXXXX/RotuloDaAcao
```

Enquanto essa variável não existir, o código usa `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LEAD` e depois `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_WHATSAPP` como fallback.

### Por que uma ação só

Antes havia duas ações (`LEAD` e `WHATSAPP`). Enviar o orçamento disparava as duas — conversão primária no envio e conversão de WhatsApp logo depois, quando o app abria. Um lead contava como dois no painel do Ads.

### Como a duplicata é evitada

Duas camadas:

1. **No código** — `src/lib/ads-contact-conversion.ts` grava uma trava em `sessionStorage` (`acesso_ads_contact_conversion`) no primeiro disparo. Qualquer CTA seguinte na mesma sessão do navegador é ignorado **salvo o upgrade de Conversões otimizadas** (abaixo). Cada disparo leva um `transaction_id` único, que o Google também usa para deduplicar.
2. **No painel do Ads** — a ação de conversão deve estar com **Contagem = “Uma”**. Assim o Google conta uma conversão por clique no anúncio mesmo que a tag dispare novamente em outra sessão.

### Consentimento

A conversão **não** exige o cookie de analytics — é medição essencial de clique e segue o Consent Mode (`ad_storage` + `ad_user_data`). Para visitas pagas o `gclid`/`gbraid`/`wbraid` é restaurado na URL antes do disparo. GA4 e PostHog continuam bloqueados até o aceite.

Quando há e-mail ou telefone (orçamento, One Tap ou prompt de telefone), o site envia esses dados **apenas como hash SHA-256** no `user_data` da tag — ver **Conversões otimizadas** abaixo.

### Configuração no Google Ads

1. **Ferramentas** → **Conversões** → **Nova ação de conversão** → **Site** → **Adicionar manualmente**
2. Categoria: **Contato** (ou **Enviar formulário de lead**)
3. **Contagem**: **Uma**
4. Copie o `AW-…/rótulo` para `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_CONTACT` na Vercel e faça redeploy
5. Marque como conversão **primária** e deixe as ações antigas (`LEAD`, `WHATSAPP`) como **secundárias** para não somar duas vezes no período de transição
6. Na mesma ação, ative **Conversões otimizadas** (Enhanced Conversions) — gerenciadas pela tag do Google

---

## Conversões otimizadas (Enhanced Conversions)

No painel do Google Ads (pt-BR) o recurso aparece como **Conversões otimizadas**, não “aprimoradas”. Melhora a atribuição em iOS/Safari (ATT / `wbraid`), cruzando o hash do visitante com contas Google logadas — sem enviar PII em claro.

### O que o código faz

1. Normaliza e-mail (lowercase), telefone E.164 BR (`+55…`) e nome (`first_name` / `last_name`).
2. Calcula **SHA-256** no navegador (`crypto.subtle`).
3. Antes do `gtag('event', 'conversion')`, chama `gtag('set', 'user_data', { email, phone_number, address? })` com os hashes.
4. Guarda identificadores **normalizados** na sessão (`acesso_ec_user`) para reutilizar no próximo CTA da mesma aba.

| Fonte | Quando grava na sessão |
|-------|------------------------|
| Formulário de orçamento | No submit — e-mail, telefone e nome vão direto na conversão |
| Google One Tap | Após registro OK — e-mail do JWT |
| Prompt opcional de telefone (pós–One Tap) | Após salvar — telefone |
| Clique WhatsApp / `tel:` | Lê a sessão; se já houver e-mail/telefone, anexa `user_data` |

### Upgrade na mesma sessão

Se o visitante clicou WhatsApp **antes** de informar PII, a conversão dispara sem `user_data`. Quando o orçamento (ou telefone) chega depois, o código **reenvia** a mesma conversão com o **mesmo** `transaction_id` e `user_data` hasheado (`reason: enhanced_upgrade`). Com **Contagem = Uma**, o Ads não dobra o lead.

### Checklist no Ads

Na ação usada por `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_CONTACT` (ex.: “WhatsApp site novo”):

- **Conversões otimizadas** = ativadas
- Método: **Gerenciadas pela tag do Google**

Sem isso, o `user_data` enviado pelo site é ignorado.

### Código

- `src/lib/enhanced-conversions.ts` — normalização, hash, `sessionStorage`
- `src/lib/ads-contact-conversion.ts` — dispara tag + upgrade
- `src/lib/google-analytics.ts` — `gtag('set', 'user_data', …)`
- `src/lib/register-cookie-consent-lead.ts` / `register-cookie-consent-phone.ts` — One Tap / telefone → sessão

---

## Passo 1 — Criar propriedade GA4 (manual)

1. Acesse [Google Analytics](https://analytics.google.com/)
2. **Admin** → **Criar propriedade** → nome: `Acesso Equipamentos — Site`
3. Fluxo de dados: **Web** → URL: `https://acessoequipamentos.com.br`
4. Copie o **ID de medição** (formato `G-XXXXXXXXXX`)

---

## Passo 2 — Variável na Vercel (manual)

Em **Production** (e Preview se quiser testar):

```env
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

Redeploy após salvar.

Opcional: manter PostHog em paralelo (`NEXT_PUBLIC_POSTHOG_KEY`) — são complementares.

---

## Passo 3 — Marcar eventos como conversões no GA4 (manual)

1. GA4 → **Admin** → **Eventos**
2. Aguarde 24–48h após tráfego real **ou** use **DebugView** (extensão [Tag Assistant](https://tagassistant.google.com/))
3. Registre como conversões (toggle **Marcar como conversão**):
   - `generate_lead` — orçamento completo, recomendado como conversão primária inicial
   - `whatsapp_click` — conversão auxiliar para medir intenção no funil
   - `phone_click` — opcional

O sinal de conversa real (`whatsapp_replied_at`) hoje é registrado no banco e no painel administrativo via ChatPro. Ele é melhor para avaliar qualidade comercial, mas não é enviado como evento GA4 client-side porque acontece fora do navegador.

---

## Passo 4 — Vincular GA4 ao Google Ads (manual)

1. [Google Ads](https://ads.google.com/) → **Ferramentas** → **Gerenciador de dados** → **Vinculações de produtos**
2. **Google Analytics (GA4)** → vincular a propriedade criada
3. **Ferramentas** → **Conversões** → **Nova ação de conversão** → **Importar** → **Google Analytics 4**
4. Importe `generate_lead` e, se quiser acompanhar intenção, `whatsapp_click`
5. Defina **generate_lead** como conversão **primária** inicial para campanhas de Pesquisa; mantenha `whatsapp_click` como métrica auxiliar quando o objetivo for qualidade do contato

---

## Passo 5 — Conferir tag automática no Ads (manual)

1. Google Ads → **Configurações da conta** → **Configurações da conta**
2. **Tag automática** = **Ativada**
3. URLs finais devem ser do domínio `acessoequipamentos.com.br` (corrigir campanha Display que aponta para `fornecedoresdaindustria.com.br` — ver `src/data/google-ads-landing-urls.json`)

---

## Passo 6 — Testar antes de confiar nos números

### Teste rápido (produção ou preview com GA_ID)

1. Abra o site com:  
   `?utm_source=google&utm_medium=cpc&utm_campaign=teste&gclid=test_gclid_123`
2. Aceite cookies de analytics
3. Clique em **WhatsApp** ou envie um orçamento teste
4. GA4 → **Relatórios** → **Tempo real** ou **DebugView** — deve aparecer `whatsapp_click` ou `generate_lead`
5. No DevTools → Network / `dataLayer`: no envio do orçamento (ou após One Tap + WhatsApp) deve existir `gtag('set', 'user_data', …)` com hashes de 64 hex antes do evento `conversion`

### Conferir gclid no lead

1. Painel `/dashboard/leads` → abrir o lead de teste
2. Na seção de campanha deve constar `gclid` (se veio da URL)

### Conferir resposta real no WhatsApp

1. Configure `CHATPRO_WEBHOOK_SECRET` na Vercel e no painel ChatPro.
2. No ChatPro, aponte o webhook para:
   `https://acessoequipamentos.com.br/api/webhooks/chatpro?token=SEU_SECRETO`
3. Envie um orçamento pelo site usando um telefone de teste.
4. Responda pelo WhatsApp como cliente.
5. Painel `/dashboard/leads`: o lead deve aparecer como **Cliente respondeu** / `whatsapp_replied_at`.

---

## Passo 7 — Política de privacidade (manual)

Atualize `/privacidade` se necessário: medição com **Google Analytics / Google Ads** após consentimento, dados nos EUA (Google), finalidade de medição de campanhas.

O banner de cookies já bloqueia GA até o aceite (Consent Mode).

---

## Por que o site antigo mostrava 0 conversões

O Google Ads só conta conversão se:

1. Existe **tag ou evento** no site (agora: GA4), **e**
2. O usuário **aceita** cookies de medição (ou usa modelagem do Google), **e**
3. A ação está **importada/vinculada** no Google Ads

Clicar no WhatsApp sem disparar evento = **0 conversões** no painel, mesmo com dezenas de cliques reais.

---

## Referências no repositório

- `src/lib/google-analytics.ts` — Consent Mode + eventos + `user_data`
- `src/lib/enhanced-conversions.ts` — Conversões otimizadas (hash SHA-256)
- `src/lib/ads-contact-conversion.ts` — conversão única Ads + upgrade com PII
- `src/components/marketing/AttributionCapture.tsx` e `src/lib/attribution.ts` — origem, UTMs e IDs Google (`gclid`/`gbraid`/`wbraid`)
- `src/lib/track-whatsapp-click.ts` — Neon + PostHog + GA4 + Ads
- `src/app/api/webhooks/chatpro/route.ts` — webhook ChatPro
- `src/lib/chatpro-webhook.ts` — parser de eventos ChatPro
- `src/lib/chatpro-lead-match.ts` — match por telefone e marcação de `whatsapp_replied_at`
- `migrations/0010_google_click_ids.sql` — colunas no banco
- `migrations/0030_leads_whatsapp_opened.sql` — abertura do WhatsApp no envio
- `migrations/0034_leads_whatsapp_replied.sql` — resposta real recebida no ChatPro
