# Arquitetura SEO — Acesso Equipamentos

> Plano consolidado (ago/2026). Atualizado set/2026: Service schema, CWV mobile, WebMCP, GSC/`robots`. **Cases (`/casos`) permanecem fora de escopo** até nova decisão.

## Status dos sprints

| Sprint | Tema | Status |
|--------|------|--------|
| S0 | Polish (FAQ, breadcrumbs, interlinks) | ✅ FAQ categorias + fichas; breadcrumbs hubs; `/treinamento` alias |
| S1 | `/regioes` (12 cidades + hub) | ✅ No ar |
| S2 | `/solucoes` (7 segmentos + hub) | ✅ No ar |
| S3 | Cases `/casos` | ⏸ Pausado |
| S4 | Programático cidade × categoria | ✅ **12×4 = 48** rotas `/regioes/{cidade}/{categoria}` |
| S5 | Institucional + nav + conversão | ✅ Nav/footer; `/termos`; cross-links regiões ↔ soluções |

## Pilares indexáveis

```text
Home → Categorias / Equipamentos → Soluções → Regiões → Dicas / FAQ → Orçamento
                              ↘ S4: /regioes/{cidade}/{categoria}
```

### S4 — matriz atual (48 URLs)

**Cidades:** belo-horizonte, contagem, betim, nova-lima, ibirite, ribeirao-das-neves, brumadinho, santa-luzia, vespasiano, lagoa-santa, sabara, sarzedo

**Categorias:** plataformas-elevatorias, guindaste-industrial, manipuladores-telescopicos, andaimes

Enrichment long-form prioritário em **plataformas-elevatorias** (6 cidades) e em **guindaste / manipulador / andaimes** (6 cidades industriais ou metropolitanas cada). Demais combos usam template com intro + FAQ por slots.

## Interlinks implementados

| Origem | Destino |
|--------|---------|
| Categoria | Regiões (S4 quando existe) + soluções |
| Ficha equipamento | Regiões S4 + soluções + FAQ da categoria |
| Região (cidade) | Categorias/S4 + cidades próximas + soluções por foco |
| S4 cidade×cat | Soluções + cidades próximas (mesma categoria) + catálogo |
| Solução | Categorias + equipamentos + regiões (deep link S4) |
| Hubs `/regioes` ↔ `/solucoes` | Cross-link dedicado |
| Home / Sobre / Contato | ServiceAreaSection com links para regiões existentes |
| Footer | Regiões principais + soluções + termos + privacidade |

## Técnico

- Sitemap: hub regiões, 12 cidades, 48 S4, soluções, equipamentos, `/termos`
- JSON-LD: LocalBusiness, FAQPage, ItemList, BreadcrumbList por template
- Fichas de equipamento: **`Service`** (não `Product`) — locação sob consulta, sem preço inventado (`src/lib/json-ld.ts`)
- Redirects 301 WordPress + alias `/treinamento` (`legacy-redirects.json` + `proxy.ts`)
- `robots.txt`: `Disallow: /_next/` além de dashboard / sign-in / api
- `llms.txt` / `catalog.json` para descoberta por IAs — ver [GEO-AI-SEARCH.md](./GEO-AI-SEARCH.md)
- WebMCP no `QuoteForm` (`requestEquipmentQuote`, sem auto-submit)

## Core Web Vitals (set/2026)

Ajustes focados em **mobile** (lab PageSpeed / CrUX). Campo GSC demora ~28 dias para refletir.

| Métrica | Problema observado | Mitigação no código |
|---------|-------------------|---------------------|
| **CLS** | Header sticky compactando / fonte | Layout estável do `SiteHeader` + carregamento de fonte |
| **LCP** | Hero bloqueado por catálogo + gtag | Stream do hero antes do await do catálogo (`Suspense`); hero WebP; `priority` limitado; gtag em `lazyOnload` |

Home: `HomeBelowFold` streama seções de catálogo após o hero (`src/app/[locale]/(marketing)/page.tsx`). Revalidar no PageSpeed Insights após deploy; CrUX no GSC só depois da janela de campo.

## Search Console — notas operacionais (set/2026)

- Sitemap canônico: `/sitemap.xml` (não inventar paths tipo `/solucoes` como sitemap).
- Cobertura 404: completar `legacy-redirects.json` a partir dos CSVs de Coverage / Drilldown do GSC.
- URLs `/_next/*` “indexadas, mas bloqueadas por robots” são esperadas após o `Disallow`; não são páginas de conteúdo.
- Relatório de experiência (CWV) usa dados de campo — lab “passou” ≠ campo imediato.

## Fora de escopo (por enquanto)

- `/casos` e hub `/conteudo`
- Migrar `/categorias` para nested URL
- 111 equipamentos × cidade (thin content)
- Cidades sem página dedicada (Raposos, Confins etc.) — removidas de pills não linkadas

## Próximos incrementos opcionais

1. Enrichment S4 para guindaste/manipulador/andaimes nas demais cidades da matriz
2. Breadcrumbs em `/sobre`, `/contato`, `/faq`
3. Cases reais (S3) quando houver conteúdo autorizado
4. Re-medir LCP/CLS em campo (GSC) após ~28 dias do deploy set/2026
