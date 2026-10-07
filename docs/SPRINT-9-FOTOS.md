# Sprint 9 — Fotos da frota (guia legado)

> **Atualização (jun/2026):** o fluxo oficial de fotos é o **painel admin** (`/dashboard/equipamentos` → galeria → **Vercel Blob**). Este guia e o script Python servem só para **manutenção do acervo antigo** ainda indexado em `equipment-image-manifest.json` ou em `public/equipamentos/`. Veja também o [README.md](../README.md) § Fotos e mídia.

## Maneira mais rápida (legado — não use para fotos novas em produção)

**Não edite** `equipamentos.json` para cada foto. O site lê arquivos em:

```text
public/equipamentos/{slug}.jpg
```

(slug = mesmo nome da URL, ex.: `/equipamentos/betoneira` → arquivo `betoneira.jpg`)

Formatos aceitos: `.webp` (melhor), `.jpg`, `.jpeg`, `.png`

### Passo a passo

1. **Peça ao comercial** uma pasta com fotos (celular ou Google Drive).
2. **Renomeie** cada arquivo igual ao slug (veja lista abaixo).
3. **Copie** para `public/equipamentos/_incoming/` (pasta de entrada).
4. Rode o script:
   ```shell
   python docs/scripts/sync-equipment-photos.py
   ```
5. **Reinicie** o `npm run dev` ou faça deploy — a foto aparece no card e na página do equipamento.

O script também atualiza `src/data/equipment-image-manifest.json` (necessário para o catálogo no navegador).

Se o nome do arquivo não bater com o slug (ex.: `plataforma HB 1430.png`), o mapeamento está em `src/data/equipment-photo-aliases.json`. Depois de adicionar fotos novas, rode o sync de novo.

Para padronizar títulos no catálogo (maiúsculas/minúsculas):

```shell
python docs/scripts/normalize-equipment-names.py
```

### Ver o que falta

```shell
python docs/scripts/sync-equipment-photos.py --list-missing
```

### Testar sem copiar

```shell
python docs/scripts/sync-equipment-photos.py --dry-run
```

---

## Prioridade (80/20)

Não precisa das 110 fotos no dia 1. Comece por:

| Prioridade | O quê | Quantidade sugerida |
|------------|--------|---------------------|
| 1 | Itens **destaque na home** (`featured` no inventário) | ~6 |
| 2 | **Plataformas aéreas** (maior ticket + Ads) | 15–20 |
| 3 | **Betoneiras, compactadores, martelos** (volume) | 15–20 |
| 4 | Restante do catálogo | gradual |

---

## Como achar o slug certo

- Abra o site: `/equipamentos` → clique no item → a URL mostra o slug.  
  Ex.: `.../equipamentos/betoneira` → arquivo `betoneira.webp`
- Ou consulte `src/data/equipamentos.json` (campo `"slug"`).
- Ou exporte do CSV: `docs/inventario-equipamentos.csv` coluna `slug`.

---

## Dicas de foto (rápido)

| Dica | Motivo |
|------|--------|
| Paisagem (horizontal) | Encaixa no card e na página de detalhe |
| Máquina limpa, fundo simples | Parece profissional no celular |
| 1200–1600 px de largura | Suficiente para web; arquivo leve |
| Converter para **WebP** (Squoosh, Photoshop, etc.) | Site mais rápido |
| Mesma luz / sem marca d’água gigante | Consistência no catálogo |

Ferramenta gratuita: [squoosh.app](https://squoosh.app)

---

## Estrutura de pastas

```text
public/equipamentos/
  _incoming/          ← coloque fotos novas aqui
  betoneira.webp      ← fotos publicadas (script copia para cá)
  plataforma-....jpg
```

Arquivos em `_incoming` **não** aparecem no site até rodar o script.

---

## O que já está no código

- Cards e página de detalhe usam foto automaticamente se existir.
- Sem foto → placeholder “Imagem em breve” (como hoje).
- SEO (JSON-LD Product) inclui `image` quando há arquivo.

---

## Descrição técnica e especificações

Após adicionar fotos, rode (se ainda não rodou após atualizar o catálogo):

```shell
python docs/scripts/enrich-equipment-specs.py
```

Isso preenche **descrição técnica** e **especificações** em todos os itens; plataformas aéreas ganham altura de trabalho, peso, alimentação e **classificação ABNT (NBR 16776)** — tesouras/mastros **3A**, lanças **3B**, empurrar **1A** (`fix-platform-specs.py`).

Para ajustar um item específico, edite `docs/inventario-equipamentos.csv` (colunas `descricao_longa`, `spec_*`) e regenere:

```shell
python docs/scripts/csv-to-equipment-json.py
python docs/scripts/enrich-equipment-specs.py
```

---

## Próximo passo da Sprint 9 (depois das fotos)

- **9.2** Cases de obra na home (2–3 fotos de obra real + texto curto).
- **9.3** Textos long-tail (já parcialmente em categorias).

Ver [GO-LIVE-GATE.md](./GO-LIVE-GATE.md).
