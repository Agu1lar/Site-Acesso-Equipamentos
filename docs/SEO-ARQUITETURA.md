# Arquitetura SEO — Acesso Equipamentos

> Plano consolidado (ago/2026). **Cases (`/casos`) permanecem fora de escopo** até nova decisão.

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

Enrichment long-form prioritário em `plataformas-elevatorias` para cidades industriais/mineração; demais combos usam template com intro + FAQ únicos por slots.

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
- Redirects 301 WordPress + alias `/treinamento`
- `llms.txt` / `catalog.json` para descoberta por IAs

## Fora de escopo (por enquanto)

- `/casos` e hub `/conteudo`
- Migrar `/categorias` para nested URL
- 111 equipamentos × cidade (thin content)
- Cidades sem página dedicada (Raposos, Confins etc.) — removidas de pills não linkadas

## Próximos incrementos opcionais

1. Enrichment S4 para guindaste/manipulador/andaimes nas cidades top
2. Breadcrumbs em `/sobre`, `/contato`, `/faq`
3. Cases reais (S3) quando houver conteúdo autorizado
