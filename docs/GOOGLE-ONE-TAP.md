# Google One Tap — leads “Google (cookies)”

Leads com origem **Google (cookies)** são criados quando o visitante:

1. Aceita cookies de **analytics** no banner do site
2. Confirma o prompt **Google One Tap** (ou clica no botão fallback “Continuar com Google”)
3. O backend valida o JWT do Google e grava nome + e-mail (`leadKind: cookie_consent`)

Aceitar analytics **sozinho** não cria lead — só liga PostHog/GA4 e registra evento `analytics_consent`.

---

## Checklist de go-live

### 1. Variável na Vercel

| Variável | Onde | Valor |
|----------|------|--------|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Production + Preview | Client ID OAuth 2.0 **Web application** |

Após alterar, faça **redeploy** (variáveis `NEXT_PUBLIC_*` entram no build).

### 2. Google Cloud Console

1. [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**
2. Crie ou edite **OAuth 2.0 Client ID** do tipo **Web application**
3. **Authorized JavaScript origins** (todas as URLs usadas pelo site):

   ```
   https://landing-page-acesso.vercel.app
   https://seu-dominio-oficial.com.br
   http://localhost:3000
   ```

4. **Authorized redirect URIs** — One Tap não usa redirect, mas mantenha coerência se usar o mesmo client em outros fluxos:

   ```
   https://landing-page-acesso.vercel.app
   http://localhost:3000
   ```

5. Tela **OAuth consent screen** publicada (Testing com test users limita quem vê o One Tap)

### 3. Verificação rápida

```bash
curl -s https://landing-page-acesso.vercel.app/api/health | jq '.googleOneTap'
```

Esperado:

- `clientIdConfigured: true`
- `database: ok` (para persistir leads)

No painel **Leads** (`/dashboard/leads`), o callout amarelo some quando o Client ID está configurado.

### 4. Teste manual (aba anônima)

1. Abrir o site em janela anônima **logado no Google** (conta pessoal de teste)
2. Clicar **Aceitar analytics**
3. Aguardar ~1 s — prompt One Tap no canto superior direito
4. Confirmar com um clique
5. Ver lead em `/dashboard/leads` com badge **Google (cookies)**

Se o prompt não aparecer:

- Verifique origem não autorizada (`unregistered_origin` nos eventos)
- Usuário sem sessão Google → `opt_out_or_no_session` (normal)
- Chrome com FedCM — o site usa `use_fedcm_for_prompt: true`
- Deve surgir fallback **Continuar com Google** no canto inferior esquerdo

### 5. Telemetria operacional

Eventos `one_tap_prompt` em `analytics_events` (campo `origin`):

| Origin | Significado |
|--------|-------------|
| `registered:credential_returned` | Lead criado/atualizado |
| `not_displayed:unregistered_origin` | Origem não cadastrada no Google Cloud |
| `not_displayed:opt_out_or_no_session` | Sem sessão Google ativa |
| `skipped:user_cancel` | Usuário fechou — fallback exibido |
| `dismissed:*` | Fluxo encerrado sem credencial |

Consulta SQL útil (Neon):

```sql
SELECT origin, COUNT(*) AS n
FROM analytics_events
WHERE event_type = 'one_tap_prompt'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY origin
ORDER BY n DESC;
```

---

## Comportamento no código

| Arquivo | Função |
|---------|--------|
| `GoogleOneTapManager.tsx` | Prompt, retry, FedCM, botão fallback |
| `register-cookie-consent-lead.ts` | Lead + e-mail na sessão de Conversões otimizadas |
| `register-cookie-consent-phone.ts` | Telefone opcional + sessão EC |
| `POST /api/leads/cookie-consent` | Cria/atualiza lead |
| `POST /api/analytics/one-tap` | Telemetria de exibição |
| `GET /api/health` | `googleOneTap.clientIdConfigured` |

**Limites por sessão:** até 4 tentativas de prompt (navegação entre páginas conta como nova tentativa). Após registro bem-sucedido, não repete na mesma aba.

**Mobile:** em **Android, iPhone/iPad** e Safari desktop o site desliga FedCM e `auto_select` (fluxo legado, mais estável). Navegadores in-app (Instagram, WhatsApp, Facebook etc.) podem não devolver credencial — abra no Chrome/Safari nativo. Após sucesso, um toast verde confirma “Contato salvo com Google”.

**Privacidade:** nome/e-mail só após gesto explícito no One Tap. Telefone continua vindo do formulário de orçamento, do prompt opcional pós–One Tap, ou do WhatsApp.

**Telefone opcional:** logo após confirmar o One Tap, um card discreto pergunta WhatsApp (opcional). “Agora não” fecha e não repete na mesma sessão. Endpoint: `POST /api/leads/cookie-consent/phone`.

**Conversões otimizadas (Google Ads):** após registro OK, o e-mail do JWT (e o telefone, se salvo) são guardados na sessão (`acesso_ec_user`) e enviados como hash SHA-256 no `user_data` da tag Ads no próximo clique WhatsApp/`tel:` ou no envio do orçamento. Detalhes: [GOOGLE-ADS-GA4.md](./GOOGLE-ADS-GA4.md#conversões-otimizadas-enhanced-conversions).

---

## Troubleshooting

| Sintoma | Causa provável | Ação |
|---------|----------------|------|
| Nenhum lead Google (cookies) | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` ausente | Configurar na Vercel + redeploy |
| Callout no painel Leads | Client ID não no build | Redeploy após env |
| Prompt nunca aparece | Origem não autorizada | Adicionar URL exata no Google Cloud |
| Só em produção custom domain | Falta origem `vercel.app` | Incluir ambas URLs |
| Fallback aparece, lead não grava | JWT inválido / Arcjet | Ver logs Vercel em `/api/leads/cookie-consent` |
| Mobile: clica Google, “carrega”, prompt repete | FedCM instável no iOS Safari ou registro falhou em silêncio | Usar Safari/Chrome fora de WebView; ver `dismissed:registration_failed` nos eventos |
| Aceitar cookies sem lead | Esperado sem One Tap | Usuário precisa confirmar Google |

---

## Referências

- [Google One Tap](https://developers.google.com/identity/gsi/web/guides/overview)
- [Display moment](https://developers.google.com/identity/gsi/web/guides/display-moment)
- [FedCM migration](https://developers.google.com/identity/gsi/web/guides/fedcm-migration)
