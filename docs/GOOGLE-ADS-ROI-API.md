# Google Ads API — gasto automático no relatório ROI

O relatório ChatPro ROI pode buscar **gasto por campanha** direto na Google Ads API, sem CSV manual.

## Variáveis (Vercel + local)

```env
GOOGLE_ADS_CUSTOMER_ID=1234567890
GOOGLE_ADS_LOGIN_CUSTOMER_ID=9876543210
GOOGLE_ADS_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=...
GOOGLE_ADS_REFRESH_TOKEN=...
GOOGLE_ADS_OFFLINE_CONVERSION_ACTION_ID=123456789
GOOGLE_ADS_CONFIRMED_CONTACT_CONVERSION_ACTION_ID=123456791
GOOGLE_ADS_QUALIFIED_LEAD_CONVERSION_ACTION_ID=123456790
```

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Não | Legado; desativado em 09/09/2026 e ignorado pela API atual |
| `GOOGLE_ADS_CUSTOMER_ID` | Sim | ID da conta de anúncios (sem hífens) |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | Se MCC | ID da conta gerente (manager) |
| `GOOGLE_ADS_CLIENT_ID` | Sim | OAuth client (Google Cloud Console) |
| `GOOGLE_ADS_CLIENT_SECRET` | Sim | Secret do OAuth client |
| `GOOGLE_ADS_REFRESH_TOKEN` | Sim | Refresh token com os escopos `adwords` e `datamanager` |
| `GOOGLE_ADS_OFFLINE_CONVERSION_ACTION_ID` | Para upload de conversões | ID da ação de conversão offline do tipo `UPLOAD_CLICKS` |
| `GOOGLE_ADS_OFFLINE_CONVERSION_ACTION_RESOURCE_NAME` | Alternativo ao ID | Resource completo: `customers/1234567890/conversionActions/987654321` |
| `GOOGLE_ADS_CONFIRMED_CONTACT_CONVERSION_ACTION_ID` | Para contato confirmado | ID de uma ação `UPLOAD_CLICKS` exclusiva para WhatsApp aberto ou resposta recebida |
| `GOOGLE_ADS_CONFIRMED_CONTACT_CONVERSION_ACTION_RESOURCE_NAME` | Alternativo ao ID | Resource completo da ação de contato confirmado |
| `GOOGLE_ADS_QUALIFIED_LEAD_CONVERSION_ACTION_ID` | Para lead qualificado | ID de uma segunda ação `UPLOAD_CLICKS`, exclusiva para qualificação comercial |
| `GOOGLE_ADS_QUALIFIED_LEAD_CONVERSION_ACTION_RESOURCE_NAME` | Alternativo ao ID | Resource completo da ação de lead qualificado |

`GOOGLE_ADS_LOGIN_CUSTOMER_ID` só é necessário quando a API é acessada via conta MCC.

Depois de configurar na Vercel Production e redeployar, `/api/health` deve retornar:

```json
{
  "googleAdsApiConfigured": true,
  "googleAdsOfflineConversionConfigured": true,
  "googleAdsConfirmedContactConversionConfigured": true,
  "googleAdsQualifiedLeadConversionConfigured": true,
  "googleAdsContactConversionConfigured": true
}
```

Se `googleAdsApiConfigured=false`, falta uma das credenciais da API. Se
`googleAdsApiConfigured=true` e um dos campos de conversão offline estiver `false`, falta
a ação correspondente. `googleAdsContactConversionConfigured` confirma somente o rótulo
da tag client-side (`NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_CONTACT`); ele não substitui as
ações `UPLOAD_CLICKS` usadas pela API.

## Obter refresh token (uma vez)

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs → ativar **Google Ads API** e **Data Manager API**
2. Criar credencial OAuth (tipo **Desktop** ou **Web** com redirect local)
3. Usar [OAuth Playground](https://developers.google.com/oauthplayground/) ou script oficial:
   - Scopes: `https://www.googleapis.com/auth/adwords https://www.googleapis.com/auth/datamanager`
   - Trocar código por refresh token
4. Conferir o nível de acesso na página **Google Ads API Overview** do projeto no Google Cloud

Guia oficial: [OAuth2 Google Ads API](https://developers.google.com/google-ads/api/docs/oauth/overview)

## Uso no relatório ROI

### API interna

```http
GET /api/internal/v1/chatpro-roi/report?campaignPrefix=nova_&from=2026-08-01&to=2026-08-31&useGoogleAdsSpend=true
Authorization: Bearer INTERNAL_API_SECRET
```

Gasto manual ainda funciona e **sobrescreve** a API quando a mesma campanha aparece em `spendJson`:

```http
GET ...&useGoogleAdsSpend=true&spendJson=%7B%22nova_plataformas_mg%22%3A2500%7D
```

Resposta inclui:

```json
{
  "spendSource": "google_ads",
  "spendMeta": {
    "googleAdsCurrency": "BRL",
    "googleAdsCampaignsMatched": 3
  }
}
```

`spendSource`: `none` | `manual` | `google_ads` | `merged`

## Upload offline de conversão WhatsApp

Além do disparo client-side da tag Ads, o backend pode subir uma conversão offline quando:

- o evento interno é `whatsapp_click`;
- existe `gclid`, `gbraid` ou `wbraid` na atribuição salva;
- as credenciais da Google Ads API estão completas;
- `GOOGLE_ADS_OFFLINE_CONVERSION_ACTION_ID` ou `GOOGLE_ADS_OFFLINE_CONVERSION_ACTION_RESOURCE_NAME` está configurado.

O upload usa `POST https://datamanager.googleapis.com/v1/events:ingest` com:

```text
destinations[].productDestinationId = ID da ação UPLOAD_CLICKS
events[].eventTimestamp = horário do clique recebido no backend
events[].adIdentifiers = gclid, gbraid ou wbraid
events[].conversionValue = 1
events[].currency = BRL
events[].transactionId = identificador estável do evento ou lead
```

Crie no Google Ads uma ação de conversão de **Importação** para **cliques**. A ação precisa ser do tipo `UPLOAD_CLICKS`; o rótulo `AW-.../label` usado pela tag do site não serve para esse endpoint.

O banco registra cada tentativa em `google_ads_offline_conversions`, com status `uploaded` ou `failed`, para auditoria e deduplicação. Nesse contexto, `uploaded` significa que a Data Manager API aceitou o lote e devolveu um `requestId`; o processamento e a atribuição são assíncronos e podem ser consultados posteriormente em `requestStatus:retrieve`.

### Idempotência e recuperação

- Clique de WhatsApp: `transactionId` = `wa-{tipo-do-click-id}-{click-id}`. Um mesmo
  clique atribuído não cria outro upload, mesmo que o navegador repita a requisição.
- Lead qualificado: `transactionId` = `qualified-lead-{id-do-lead}`. A conversão
  qualificada é independente da conversão de contato do navegador e da conversão offline
  de clique no WhatsApp; elas devem apontar para ações distintas no Google Ads.
- Contato confirmado: `transactionId` = `confirmed-contact-{id-do-lead}`. O primeiro
  `whatsapp_opened` e a primeira resposta recebida pelo ChatPro disputam o mesmo ID; se os
  dois ocorrerem, apenas o primeiro upload é aceito. Isso também cobre o caso raro em que
  o visitante abre o WhatsApp e chama por outro número, sem correspondência posterior.
- Se uma tentativa falhar por timeout ou erro da API, o registro fica como `failed` com a
  resposta/erro preservados. Salvar novamente o mesmo lead como **Qualificado** reutiliza
  o mesmo registro e tenta o envio outra vez. Registros `pending` ou `uploaded` nunca são
  reenviados.
- A aceitação da API não equivale à atribuição final pelo Google Ads. Consulte o status da
  solicitação no Data Manager e aguarde o processamento antes de avaliar resultados.

## Upload offline de lead qualificado

O painel administrativo envia essa segunda ação apenas quando todos os requisitos abaixo
existem:

- a equipe salvou o lead como **Qualificado**;
- o lead tem `gclid`, `gbraid` ou `wbraid`;
- há confirmação de passagem pelo WhatsApp (`whatsapp_opened` ou resposta recebida pelo
  ChatPro);
- as credenciais da API e a ação
  `GOOGLE_ADS_QUALIFIED_LEAD_CONVERSION_ACTION_*` estão configuradas.

Leads orgânicos e leads sem identificador de clique podem ser qualificados no CRM, mas não
são enviados ao Google Ads. Marcar como **Não qualificado** também não envia conversão.
Enquanto a empresa ainda não tiver volume consistente de qualificações, mantenha essa ação
como secundária no Ads; a ação de contato do site continua sendo a referência de otimização.

## Upload offline de contato confirmado

Um lead pago com `gclid`, `gbraid` ou `wbraid` é enviado para a ação de contato confirmado
quando ocorre o primeiro destes sinais:

- o navegador confirma que abriu o WhatsApp após o orçamento;
- o ChatPro recebe uma mensagem do telefone associado ao lead.

Configure `GOOGLE_ADS_CONFIRMED_CONTACT_CONVERSION_ACTION_ID` ou o resource name equivalente.
Leads orgânicos não são enviados. O clique inicial continua sendo uma ação distinta; use a
ação de contato confirmado como secundária durante a validação e promova-a somente depois de
confirmar volume e atribuição no Data Manager.

### CLI

```powershell
dotenv -c -- npx tsx scripts/chatpro-roi-report.mjs --campaignPrefix=nova_ --use-google-ads-spend
```

## Matching campanha ↔ utm_campaign

A API retorna `campaign.name` do Google Ads. O relatório normaliza para bater com `utm_campaign`:

- minúsculas
- espaços → `_` (ex.: `Nova Plataformas` → `nova_plataformas`)

Confirme que o **template de URL** ou **UTM automático** no Ads usa o mesmo nome (`{campaignname}` ou valor custom alinhado).

## Moeda

O custo vem em micros da moeda da conta Google Ads (`customer.currency_code`, em geral **BRL**). Valores estimados pelo Claude também estão em BRL.

## Erros

| HTTP / erro | Causa |
|-------------|--------|
| `503 google_ads_not_configured` | Env incompleto ou `useGoogleAdsSpend` sem credenciais |
| `google_ads_token_failed` | Refresh token inválido ou revogado |
| `google_ads_search_failed` | Projeto Cloud sem acesso à conta, customer ID errado ou query bloqueada |

## Segurança

- Credenciais **somente server-side** (nunca `NEXT_PUBLIC_*`)
- Endpoints protegidos por `INTERNAL_API_SECRET`
- Refresh token com escopo mínimo (Ads read)
