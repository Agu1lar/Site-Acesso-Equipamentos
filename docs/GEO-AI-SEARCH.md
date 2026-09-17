# GEO — descoberta por IAs (ChatGPT, Perplexity, Gemini, Copilot)

Recursos para que **crawlers e buscas generativas** encontrem, leiam e citem o site com clareza — antes e depois do domínio oficial.

---

## Endpoints públicos

| URL | Formato | Uso |
|-----|---------|-----|
| `/llms.txt` | Markdown/texto | Mapa para LLMs ([padrão llms.txt](https://llmstxt.org/)): resumo, categorias, contato, links |
| `/catalog.json` | JSON | Catálogo publicado: slug, nome, categoria, specs, URL absoluta |
| `/sitemap.xml` | XML | Todas as páginas indexáveis |
| `/robots.txt` | Texto | Permite crawlers gerais + bots de IA listados abaixo |

**Preview Vercel:** `/llms.txt` e `/catalog.json` retornam **404** quando `VERCEL_ENV=preview` (deploy temporário de branch/PR). Produção em `*.vercel.app` continua disponível.

**Descoberta sem link no rodapé:** páginas de marketing incluem `<link rel="alternate" type="text/plain" href="…/llms.txt">` no `<head>` e links ocultos (`<div hidden>`) no HTML para crawlers de IA.

**Cache:** `llms.txt` 1 h · `catalog.json` 5 min (alinhado ao catálogo).

### Formato do `llms.txt` (set/2026)

Links usam markdown `[rótulo](url absoluta)` (categorias, páginas principais, `catalog.json`, `sitemap.xml`, redes). Facilita parsers que seguem o [padrão llmstxt.org](https://llmstxt.org/).

---

## WebMCP — formulário de orçamento (set/2026)

[WebMCP](https://developer.chrome.com/blog/webmcp-origin-trial) (API declarativa no Chrome / browsing agentic) expõe o formulário de orçamento como ferramenta navegável por agentes.

| Detalhe | Valor |
|---------|--------|
| Onde | `src/components/forms/QuoteForm.tsx` (página `/orcamento` e embeds) |
| `toolname` | `requestEquipmentQuote` |
| `tooldescription` | Solicita orçamento de locação; agente **preenche** o form |
| Campos | `toolparamdescription` em nome, telefone, cidade, e-mail, empresa, equipamento, período, mensagem e honeypot |
| Envio | **Sem** `toolautosubmit` — a pessoa confirma o envio pelo WhatsApp |

Browsers sem suporte ignoram os atributos. Não altera UX humana nem ranking SEO; é readiness para agentes.

---

## Robots — bots de IA permitidos

Explicitamente liberados em `src/app/robots.ts` (mesmas regras do site público):

- `GPTBot`, `OAI-SearchBot`, `ChatGPT-User` (OpenAI)
- `ClaudeBot`, `anthropic-ai` (Anthropic)
- `PerplexityBot`
- `Google-Extended` (Gemini / AI Overviews)

**Bloqueado:** `/dashboard`, `/sign-in`, `/api/*`, `/_next/` (assets internos do Next — evita ruído de “indexada, mas bloqueada” no GSC).

---

## Verificação rápida

```bash
curl -s https://acessoequipamentos.com.br/llms.txt | head -20
curl -s https://acessoequipamentos.com.br/catalog.json | jq '.counts'
curl -s https://acessoequipamentos.com.br/api/health | jq '.aiDiscovery'
```

No HTML de `/orcamento`, inspecionar o `<form>`: atributos `toolname` / `tooldescription` / `toolparamdescription`.

---

## Após apontar o domínio oficial

1. Atualizar `NEXT_PUBLIC_APP_URL` na Vercel (Production) → redeploy.
2. URLs em `llms.txt` e `catalog.json` passam a usar o domínio `.com.br` automaticamente.
3. Search Console + Bing Webmaster: enviar `/sitemap.xml`.
4. Testar citação manual: Perplexity / ChatGPT — *“locação plataforma elevatória Belo Horizonte”*.

---

## Código

| Arquivo | Função |
|---------|--------|
| `src/lib/ai-discovery.ts` | Gera conteúdo de `llms.txt` e payload JSON |
| `src/components/seo/AiDiscoveryHeadLinks.tsx` | `<link rel="alternate">` explícito no `<head>` |
| `src/components/seo/AiDiscoveryCrawlerHints.tsx` | Links ocultos no HTML para crawlers |
| `src/components/forms/QuoteForm.tsx` | WebMCP declarativo (`requestEquipmentQuote`) |
| `src/app/llms.txt/route.ts` | Rota HTTP |
| `src/app/catalog.json/route.ts` | Rota HTTP |
| `src/app/robots.ts` | Regras para crawlers de IA + `Disallow: /_next/` |
| `src/lib/ai-discovery.test.ts` | Testes unitários (inclui links markdown) |

Alterações no catálogo (admin) revalidam `/catalog.json` e `/llms.txt`.

---

## Próximos passos (conteúdo, não código)

- Artigos em `/dicas` com títulos = perguntas que usuários fazem à IA.
- Páginas locais (“locação em Contagem”, “Betim”).
- Manter specs e descrições técnicas atualizadas (já favorecem citação).
