# Plano de implementação — Arquitetura SEO (Acesso Equipamentos)

> **Arquivo temporário** — substituído por [docs/SEO-ARQUITETURA.md](docs/SEO-ARQUITETURA.md) (ago/2026).
>
> **Base:** diagrama “Arquitetura SEO Ideal – Acesso Equipamentos” + inventário do site atual (ago/2026).
>
> **Regra de ouro:** **nunca implementar um sprint sem confirmação explícita do José** sobre o formato desejado (URLs, template, conteúdo, prioridade). Cada sprint abaixo tem um bloco **CONFIRMAR ANTES** — só depois disso o agente pode codar.
>
> **Última atualização:** 2026-08-25 (S1+S2 no ar; S2 heroes/cenários publicados em `7b1bbde`)

---

## 0. Como vamos trabalhar

1. O agente apresenta o sprint (escopo + decisões abertas).
2. Você opina / ajusta / escolhe opções.
3. Só após um **“pode implementar o Sprint X”** (ou equivalente claro) o agente executa.
4. Se o pedido for ambíguo, o agente **para e pergunta** — não assume.
5. Commits/deploy de um sprint só quando você pedir.

### Status rápido

| Sprint | Tema | Status |
|--------|------|--------|
| S0 | Polish barato (FAQ, relacionados, breadcrumbs, aliases) | ✅ Implementado (FAQ categorias, breadcrumb ficha/catálogo, SolucaoLinks, `/treinamento` → canônico) |
| S1 | `/regioes` (hub + 10 cidades) | ✅ No ar |
| S2 | `/solucoes` (hub + 7 segmentos) | ✅ No ar + enriquecimento (`7b1bbde`) |
| S3 | Conteúdo / cases / clusters em `/dicas` | ⏸ Pausado — José pediu só S0 por agora; cases depois |
| S4 | Programático cidade × categoria (controlado) | ✅ Implementado — 6×4 = 24 rotas `/regioes/{cidade}/{categoria}` |
| S5 | Institucional + conversão + interlinks finos | ⏳ Aguardando confirmação |

---

## 1. Diagnóstico (site hoje × diagrama)

| Pilar do diagrama | Situação atual | Gap |
|-------------------|----------------|-----|
| Equipamentos | `/equipamentos`, `/categorias/{slug}`, fichas `/equipamentos/{slug}` (~111) | Forte — manter |
| Soluções por segmento | Só copy em `/sobre` + logos | **Ausente** |
| Regiões | Lista de cidades + schema, sem páginas | **Ausente** |
| Conteúdo | `/dicas` + `/faq` | Parcial (sem cases/hub `/conteudo`) |
| Institucional | sobre, contato, orçamento, treinamento, privacidade | Bom |
| Técnico | sitemap, robots, llms.txt, catalog.json, 301, JSON-LD | Muito forte |

**Não fazer de cara (salvo você pedir):**
- Migrar `/categorias` para nested sob `/equipamentos` (custo de redirect alto).
- Criar `/conteudo` só por estética (manter `/dicas` indexado).
- Abrir dezenas de páginas cidade×equipamento sem texto único.

---

## 2. Fluxo de links internos (alvo)

```text
Home
 → Categoria / Equipamento
 → Solução
 → Região
 → Dica / Case
 → Orçamento / WhatsApp
```

Regras (aplicar ao longo dos sprints):
1. Ficha → 1–2 soluções + 2–4 regiões (quando existirem).
2. Solução → 4–8 equipamentos reais.
3. Região → top categorias + 1 solução dominante.
4. Artigo → ≥1 equipamento + 1 solução ou região.
5. Breadcrumb em 100% das páginas públicas.

---

## Sprint S0 — Polish no que já existe

**Objetivo:** melhorar templates atuais sem criar pilares novos.

### Escopo proposto
- FAQ em fichas (ou expandir nas categorias que ainda não têm).
- Relacionados mais úteis (mesma categoria; depois “também em solução/região”).
- Breadcrumbs consistentes.
- Preparar home/`ServiceAreaSection` para virar links (só ativa quando S1 existir).
- Alias opcional `/treinamento` → `/treinamento-plataformas-aereas`.

### CONFIRMAR ANTES
- [ ] FAQ na **ficha** de cada equipamento, só em **categorias**, ou ambos?
- [ ] Quer alias `/treinamento` agora ou deixar para depois?
- [ ] Relacionados: só mesma categoria nesta fase, ou já inventar blocos “Usado em…” vazios?

**Critério de pronto:** páginas atuais com FAQ/breadcrumb/relacionados alinhados à decisão; sem rotas novas de região/solução.

**Bloqueio:** não iniciar até confirmação deste sprint.

---

## Sprint S1 — `/regioes` (prioridade SEO local)

**Objetivo:** abrir o pilar de Local SEO com **um template único bem desenhado** (estrutura igual; conteúdo/cidade e mídia variáveis).

### Decisões do José (2026-08-25)
- [x] URL como no diagrama: `/regioes` + `/regioes/{slug}`
- [x] Hub indexável: **sim**
- [x] v1 = top 8 perto de BH, foco **indústria + mineração** e porte
- [x] Conteúdo: **IA gera texto e imagens**
- [x] Interlinks: seguir recomendação do agente (robustez)
- [x] Observação UX: páginas podem ser praticamente idênticas na estrutura (padrão Mills), mas **design não pode parecer genérico** — UX/UI caprichado, composição forte

### Lista v1 (10) — aprovada 2026-08-25
| Slug | Cidade | Por quê |
|------|--------|---------|
| `belo-horizonte` | Belo Horizonte | Sede / âncora |
| `contagem` | Contagem | Polo industrial, grande, colada em BH |
| `betim` | Betim | Indústria (automotivo etc.), porte, perto |
| `nova-lima` | Nova Lima | Porta do quadrilátero / mineração |
| `ibirite` | Ibirité | Cinturão industrial, populosa |
| `santa-luzia` | Santa Luzia | Cinturão industrial RMBH |
| `brumadinho` | Brumadinho | Mineração + proximidade |
| `sabara` | Sabará | Mineração/histórico + cinturão metropolitano |
| `ribeirao-das-neves` | Ribeirão das Neves | Porte populacional RMBH, demanda contínua |
| `sarzedo` | Sarzedo | Parques / cinturão industrial, perto de BH |

*Fora da v1 (schema/copy geral até v2):* Vespasiano, Lagoa Santa, Raposos, Matozinhos, Confins, Pedro Leopoldo.  
*Itabira / Itabirito / Congonhas* — fase mineração ampliada (mais longe).

### Imagens (recomendação do agente — aceita)
- **Gerar hero por cidade na implementação** (não placeholder): publicar live já com atmosfera visual.
- Prompt controlado por perfil (indústria vs mineração vs metrópole), mesmo formato/aspect ratio.
- Fallback: se a geração de uma cidade falhar, usa hero da marca/obra genérica Acesso até regenerar.
- Você revisa no ar; se alguma imagem ficar ruim, regeneramos ou trocamos.

### Publicação
- **Publicar direto** nas 10 + hub.
- Ajustes depois se necessário.
- Após deploy: agente faz **avaliação com prints** (hub + 2–3 cidades) e reporta o que ajustar.

### Referência Mills (o que copiar × o que superar)
**Copiar (estrutura):**
- Mesmo esqueleto de página para todas as cidades
- Troca de nome da cidade + endereço/contexto local + CTA
- Grid de categorias/equipamentos com a cidade no copy
- Bloco de “outras regiões / mapa de atuação”

**Superar (UX/UI — pedido explícito):**
- Não virar landing fina só com H1 + parágrafo + lista de links
- Hero full-bleed com imagem de atmosfera (obra/indústria/mineração da região), gerada/selecionada por IA e revisável
- Uma composição clara no 1º viewport: marca + H1 + 1 frase + CTA (sem cards no hero)
- Tipografia e direção visual alinhadas ao site Acesso (não layout “SEO factory”)
- Seções com hierarquia e respiro; motion leve (2–3) se couber no padrão do projeto
- Variáveis CSS / tokens do design system existente

### Template único (slots de dados por cidade)
1. Hero (imagem + H1 “Locação de equipamentos em {Cidade}” + CTA)
2. Intro curta (logística a partir de BH + foco indústria/mineração daquela cidade)
3. Categorias / equipamentos em destaque (links reais do catálogo)
4. Para quem atendemos na região (tags até S2 virar páginas)
5. Diferenciais locais (base BH, prazo, atendimento RMBH)
6. Cidades próximas (links internos)
7. FAQ curto local (3–5 perguntas)
8. CTA final WhatsApp + orçamento
9. JSON-LD + breadcrumb + sitemap

### Conteúdo por IA
- Texto: rascunho Claude por cidade (único o suficiente para não ser doorway óbvio; estrutura igual)
- Imagens: capa/hero por cidade (prompt controlado; upload no fluxo admin/blob como blog)
- Você revisa antes de publicar (rascunho → publish)

### Interlinks (recomendação de robustez)
| Onde | O quê |
|------|--------|
| Hub `/regioes` | Todas as 8 |
| Home `ServiceAreaSection` | As **10** viram links (não só pills) |
| Footer | Hub + BH + Contagem + Betim (ou as 10 se couber sem poluir) |
| Categorias | Até **4** cidades (BH + 3 do perfil) |
| Fichas | Até **4** (BH fixa + 3 da v1 por perfil da categoria) |
| Página de cidade | 3–4 cidades próximas + hub |

### Ainda aberto antes de codar
- [x] Lista das 10 aprovada (8 + Ribeirão das Neves + Sarzedo)
- [x] Imagens: gerar na implementação (recomendação aceita)
- [x] Publicação: live; editar depois; avaliação com prints pós-deploy
- [ ] Liberação final: **“pode implementar o S1”**

**Critério de pronto:** hub + 10 páginas com template caprichado, conteúdo/imagem gerados, sitemap/schema/CTAs, interlinks da tabela, review visual com prints.

**Bloqueio:** não iniciar código até o “pode implementar o S1”.

---

## Sprint S2 — `/solucoes` (intenção B2B)

**Objetivo:** landings por segmento industrial.

### Decisões travadas (2026-08-25)
1. Prefixo: `/solucoes` ✅
2. Segmentos v1: mineração, indústria, siderurgia, construção civil, manutenção industrial, logística, montagens industriais ✅
3. Matriz de equipamentos: agente monta (priorizar **categorias** + poucos modelos featured inequívocos) ✅
4. Cases reais: **não** na v1. Hub no estilo Mills — **cards/ícones ilustrados clicáveis** por segmento (não depoimentos inventados). Cases ficam para S3 ✅

### Escopo v1
- Hub `/solucoes` com grid de segmentos (ícones desenhados, clicáveis — linha Mills)
- Páginas `/solucoes/{slug}` (mesmo template light split do S1)
- Conteúdo: desafios, aplicações, categorias/equipamentos recomendados, regiões relacionadas, FAQ, CTA
- Interlinks: solução ↔ categorias/fichas ↔ regiões
- Sitemap + JSON-LD

**Status:** ⏳ Aguardando “pode implementar o S2”

**Critério de pronto:** hub + 7 segmentos, schema/sitemap, interlinks mínimos, visual tipo Mills (ícones).

---

## Sprint S3 — Conteúdo, cases e clusters

**Objetivo:** reforçar o pilar Conteúdo **sem** matar `/dicas`.

### Decisões do José (2026-08-25) — em discussão / parcialmente travadas
- [x] Quantidade v1: **2 cases médios**
- [x] Temas: **quentes da área agora** + **recorrentes** (proposta do agente abaixo)
- [x] Depois do S3 → **S0** (ordem confirmada pelo José)
- [ ] Formato de URL / onde publicar (recomendação do agente pendente de ok)

### Recomendação do agente — onde publicar (pt-BR)
**Preferência: rota própria `/casos` + `/casos/{slug}`**, mantendo `/dicas` só para artigos/guias.

| Opção | Prós | Contras |
|-------|------|---------|
| **A — `/casos` (recomendada)** | Intenção clara (“prova social”); URL em português; hub dedicado; não mistura com dica/guia | Um pouco mais de rota/template |
| B — dentro de `/dicas` com tipo `caso` | Reaproveita CMS TipTap já pronto | URL fraca para case; blog e case competem no mesmo hub |

**Nav/footer (pt-BR):** link “Casos” (não “Cases”). Breadcrumb: Início / Casos / {título}.  
**Hub `/conteudo`:** **não** na v1 — só footer/nav com Blog + Casos + FAQ.

### 2 cases médios propostos (v1)

| # | Tema | Por que é quente / recorrente | Interlinks |
|---|------|-------------------------------|------------|
| 1 | **Parada de manutenção industrial na RMBH** (Contagem/Betim) — plataformas + manipulador em janela curta | Turnaround/parada é demanda B2B recorrente no polo industrial; ticket e urgência altos | `/solucoes/manutencao-industrial`, `/solucoes/industria`, `/regioes/contagem`, plataformas/manipulador |
| 2 | **Reforma de fachada / acesso em altura em Belo Horizonte** — plataforma elevatória em condomínio/predial | Busca Ads e orgânico constantes (“plataforma fachada BH”); conversão rápida | `/solucoes/construcao-civil`, `/regioes/belo-horizonte`, plataformas elevatórias |

Tom: case **médio** (contexto + desafio + equipamentos + resultado qualitativo + CTA). **Sem inventar cliente nominal** se não houver autorização — usar “empreiteira em Contagem” / “condomínio na região Centro-Sul” ou pedir nomes reais ao José.

### Escopo v1 (após “pode implementar o S3”)
- Hub `/casos` + 2 páginas
- Tipo/template case (hero, desafio, solução, equipamentos, região, CTA)
- Interlinks solução ↔ região ↔ ficha
- Entrada no nav/footer em pt-BR (“Casos”)
- Sitemap + JSON-LD (`Article` ou `CaseStudy` conforme schema disponível)
- `/dicas` permanece para guias; opcional filtro depois

### CONFIRMAR ANTES (faltando)
- [ ] Aceita **`/casos`** (recomendação A)?
- [ ] Ok nos **2 temas** da tabela (ou trocar mineração/Quadrilátero no lugar da fachada)?
- [ ] Pode citar empresa/cliente real ou manter anônimo?
- [ ] Liberação: **“pode implementar o S3”**

**Critério de pronto:** hub + 2 cases médios no ar, interlinks, nav “Casos”, sem matar `/dicas`.

**Bloqueio:** não iniciar código até confirmação deste sprint.

**Próximo depois do S3:** Sprint **S0** (polish FAQ/breadcrumbs/relacionados).

---

## Sprint S4 — Programático controlado (cidade × equipamento/categoria)

**Objetivo:** long-tail local **controlado**, sem fábrica de thin content.

### Pré-requisito
S1 + S2 + S0 ✅ no ar. S3 (cases) permanece pausado.

### Recomendação do agente (2026-08-25)

**1. Granularidade v1 = cidade × categoria** (não × cada SKU do catálogo)  
- Motivo: 10×111 = centenas de páginas finas; categoria já tem SEO forte e FAQ.  
- Equipamento individual continua em `/equipamentos/{slug}` com bloco “Atendemos em”.

**2. URL (pt-BR):** `/regioes/{cidade}/{categoria}`  
Exemplos:
- `/regioes/belo-horizonte/plataformas-elevatorias`
- `/regioes/contagem/guindaste-industrial`  
Alternativa plana (pior hierarquia): `/locacao-plataforma-elevatoria-belo-horizonte` — só se quiser maximizar match de query “aluguel … em …”.

**3. Matriz v1 sugerida: 6 cidades × 4 categorias = 24 páginas**

| Cidades | Categorias |
|---------|------------|
| belo-horizonte, contagem, betim, nova-lima, ibirite, ribeirao-das-neves | plataformas-elevatorias, guindaste-industrial, manipuladores-telescopicos, andaimes |

(Ferramentas elétricas/combustão ficam para v2.)

**4. Template único (slots)**  
Hero curto + H1 “Locação de {categoria} em {cidade}” + 2 parágrafos únicos (logística BH + foco da cidade) + links para fichas top da categoria + link hub região + solução dominante + FAQ 3–4 + CTA.  
**Indexar todas** as 24 (conteúdo gerado com slots suficientes). Sem noindex na v1.

**5. Fora do escopo S4**  
- Cases (S3)  
- 111 equipamentos × cidade  
- Expandir para as 10 cidades de uma vez

### CONFIRMAR ANTES
- [ ] Aceita **cidade × categoria** (não × SKU)?
- [ ] URL **`/regioes/{cidade}/{categoria}`**?
- [ ] Matriz **6×4 = 24** ok (ou outra combinação)?
- [ ] **Indexar todas** as 24?
- [ ] Liberação: **“pode implementar o S4”**

**Critério de pronto:** 24 páginas no ar, sitemap, JSON-LD, interlinks região↔categoria↔solução, sem thin óbvio.

**Bloqueio:** não iniciar código até confirmação.

---

## Sprint S5 — Institucional fino + conversão

**Objetivo:** fechar pontas do diagrama na base institucional/CTA.

### Escopo proposto
- Termos de uso (se necessário)
- Refinar CTAs (1 WhatsApp + 1 orçamento por seção relevante)
- Nav/footer refletindo `/regioes` e `/solucoes`
- Revisar conversão Ads unificada (já existe — só auditoria)
- Checklist GSC: cobertura, canonicals, 404 após novas rotas

### CONFIRMAR ANTES
- [ ] Precisa de página de termos agora?
- [ ] Mudanças de menu: ordem preferida dos itens?
- [ ] Alguma página institucional a unificar/renomear?

**Critério de pronto:** nav/footer alinhados à nova IA; checklist GSC ok.

**Bloqueio:** não iniciar até confirmação deste sprint.

---

## 3. Ordem recomendada (pode mudar se você quiser)

1. **S1 `/regioes`** — maior gap de SEO local  
2. **S2 `/solucoes`** — intenção B2B  
3. **S0 polish** — pode ir em paralelo ou entre S1/S2  
4. **S3 conteúdo/cases**  
5. **S4 programático**  
6. **S5 institucional/nav**

---

## 4. Registro de decisões (preencher conforme você for opinando)

| Data | Sprint | Decisão | Status |
|------|--------|---------|--------|
| 2026-08-25 | — | Arquivo criado; implementação bloqueada até confirmação por sprint | Ativo |
| 2026-08-25 | S1 | URL `/regioes`; hub sim; IA texto+imagem; template único tipo Mills com UX forte; interlinks robustos | Decisões ok |
| 2026-08-25 | S1 | v1 = 10 cidades (+ Ribeirão das Neves, Sarzedo); heroes gerados no deploy; publish live + review com prints | Aguarda “pode implementar S1” |

---

## 5. Próximo passo imediato

**Não implementar nada ainda.**

Quando quiser começar, diga por exemplo:
- `vamos discutir o Sprint S1` — aí eu detalho URLs/template/cidades e você ajusta; **só depois** “pode implementar S1”
- ou `quero mudar a ordem: S2 antes de S1`

Sem essa confirmação explícita, o agente **não** cria rotas, não altera nav e não faz deploy deste plano.
