# Acesso ao painel (login com senha)

> Nome do arquivo `CLERK-ACESSO-ADMIN.md` é legado. O painel **não** usa mais Clerk.

O painel (`/dashboard`) usa **login próprio** com e-mail e senha armazenados no banco (Neon).

## Login

- URL: `/sign-in`
- Usuário padrão (após migração `0031`): `tecnologia@acessoequipamentos.com.br`
- Senha inicial: definida na migração — altere em **Painel → Acesso** após o primeiro login.

## Gerenciar usuários

1. Entre como **administrador**
2. **Painel → Acesso**
3. Adicione e-mail, senha (mín. 8 caracteres) e papel (`admin` ou `comercial`)
4. Use **Redefinir senha** para usuários legados sem senha

## Variáveis (Vercel Production)

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `DASHBOARD_SESSION_SECRET` | Sim | String aleatória com **mín. 32 caracteres** (cookie de sessão) |
| `DATABASE_URL` | Sim | Neon (pooler recomendado) |

Remova `CLERK_SECRET_KEY` e `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` da Vercel se ainda estiverem configuradas.

## Health check

`GET /api/health` → `auth.mode: "dashboard_password"` e `sessionSecretConfigured: true`
