# Google Ads API — gasto automático no relatório ROI

O relatório ChatPro ROI pode buscar **gasto por campanha** direto na Google Ads API, sem CSV manual.

## Variáveis (Vercel + local)

```env
GOOGLE_ADS_DEVELOPER_TOKEN=...
GOOGLE_ADS_CUSTOMER_ID=1234567890
GOOGLE_ADS_LOGIN_CUSTOMER_ID=9876543210
GOOGLE_ADS_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=...
GOOGLE_ADS_REFRESH_TOKEN=...
```

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Sim | Token de desenvolvedor (Google Ads API Center) |
| `GOOGLE_ADS_CUSTOMER_ID` | Sim | ID da conta de anúncios (sem hífens) |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | Se MCC | ID da conta gerente (manager) |
| `GOOGLE_ADS_CLIENT_ID` | Sim | OAuth client (Google Cloud Console) |
| `GOOGLE_ADS_CLIENT_SECRET` | Sim | Secret do OAuth client |
| `GOOGLE_ADS_REFRESH_TOKEN` | Sim | Refresh token com escopo `https://www.googleapis.com/auth/adwords` |

`GOOGLE_ADS_LOGIN_CUSTOMER_ID` só é necessário quando a API é acessada via conta MCC.

## Obter refresh token (uma vez)

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs → ativar **Google Ads API**
2. Criar credencial OAuth (tipo **Desktop** ou **Web** com redirect local)
3. Usar [OAuth Playground](https://developers.google.com/oauthplayground/) ou script oficial:
   - Scope: `https://www.googleapis.com/auth/adwords`
   - Trocar código por refresh token
4. Solicitar **Developer Token** em [Google Ads API Center](https://ads.google.com/aw/apicenter)

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
| `google_ads_search_failed` | Developer token em modo teste, customer ID errado, ou query bloqueada |

## Segurança

- Credenciais **somente server-side** (nunca `NEXT_PUBLIC_*`)
- Endpoints protegidos por `INTERNAL_API_SECRET`
- Refresh token com escopo mínimo (Ads read)
