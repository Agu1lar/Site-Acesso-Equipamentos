# Deploy na Vercel

Guia para publicar Preview e Production sem executar migrations durante o build.

## Ambientes

| Ambiente | Uso | Build |
|----------|-----|-------|
| Preview | Validar pull requests | `npm run build` |
| Production | Site oficial após merge em `main` | `npm run build` |

O build apenas compila o Next.js. Migrations são validadas no CI contra PostgreSQL descartável e aplicadas em produção pelo workflow manual protegido do GitHub.

## Pré-requisitos

- Conta na [Vercel](https://vercel.com).
- Repositório Git deste projeto.
- `DASHBOARD_SESSION_SECRET` com pelo menos 32 caracteres.
- `DATABASE_URL` PostgreSQL para runtime.
- Demais variáveis validadas por `Env.ts`.

## Configuração do projeto

1. Na Vercel, escolha **Add New Project** e importe o repositório.
2. Se necessário, selecione `LandPage-Acesso` como **Root Directory**.
3. Use o preset Next.js.
4. Configure os comandos abaixo.

| Campo | Valor |
|-------|-------|
| **Build Command** | `npm run build` |
| **Install Command** | `npm install` |
| **Output Directory** | Padrão do Next.js |

## Variáveis

Cadastre cada variável somente nos ambientes que realmente a utilizam. Preview deve usar credenciais isoladas sempre que a funcionalidade fizer escrita.

| Variável | Preview | Production |
|----------|---------|------------|
| `DASHBOARD_SESSION_SECRET` | Valor próprio | Valor próprio |
| `DATABASE_URL` | Banco isolado | Banco de produção |
| `NEXT_PUBLIC_APP_URL` | URL do preview | Domínio oficial |
| `NEXT_PUBLIC_SENTRY_DISABLED` | `true`, opcional | Conforme monitoramento |

Variáveis como `RESEND_API_KEY`, `LEADS_NOTIFY_EMAIL` e `RESEND_FROM_EMAIL` devem usar destinos de teste no Preview para evitar notificações reais.

## Migration de produção

1. Abra um pull request e aguarde todos os checks obrigatórios.
2. Confirme que a migration é compatível com a versão atualmente publicada.
3. Em **Actions**, execute **Migrate production database** na branch revisada.
4. Informe `MIGRAR PRODUCAO`.
5. Após o sucesso, faça merge para iniciar o deploy da Vercel.

O ambiente `production` do GitHub deve exigir aprovação e armazenar `DATABASE_URL`. Não cadastre a URL de produção como secret comum do workflow principal.

## Vercel CLI

```bash
npm install
npx vercel login
npx vercel link
npx vercel env pull .env.vercel.preview
npx vercel
```

Para produção, prefira o merge protegido em `main`. `npx vercel --prod` deve ficar restrito a recuperação operacional documentada.

## Verificação

Antes do push:

```bash
npm run build
npm run check:types
npm run test
```

No Preview, valide pelo menos:

- `/`
- `/equipamentos`
- uma página de equipamento
- uma página de categoria
- `/faq`
- formulário de orçamento
- abertura do WhatsApp com contexto correto

## Problemas comuns

| Erro | Tratativa |
|------|-----------|
| Variáveis inválidas | Verifique os ambientes marcados em **Settings -> Environment Variables** |
| Falha em `Env.ts` | Cadastre as variáveis obrigatórias no ambiente do deploy |
| Migration falha | Corrija no pull request; não mova `db:migrate` para o build |
| Escrita de Preview em produção | Use banco e credenciais isolados para Preview |
| Rota retorna 404 | Confira a estratégia de locale e redirects |

O checklist funcional completo está em [PREVIEW-VALIDACAO.md](./PREVIEW-VALIDACAO.md).
