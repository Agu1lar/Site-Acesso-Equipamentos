# Acesso Equipamentos — Comparativo: site atual × nova landing

**Documento para apresentação interna**  
**Data:** maio/2026  
**Site atual (agência):** https://acessoequipamentos.com.br/  
**Nova landing (preview):** https://landing-page-acesso.vercel.app/

---

## Contexto em uma linha

O site oficial continua como vitrine no domínio principal. A nova landing é um canal **paralelo** para tráfego pago (Google Ads), com catálogo completo, formulário de orçamento e métricas de conversão — sem substituir o site atual de imediato.

---

## Tabela comparativa geral

| Capacidade | Site atual (agência) | Nova landing (projeto interno) |
|------------|:--------------------:|:------------------------------:|
| Domínio oficial no ar | Sim | Preview (domínio oficial na fase seguinte) |
| Telefone e WhatsApp visíveis | Sim | Sim |
| Endereço e horário comercial | Sim | Sim |
| Depoimentos Google | Sim | Sim |
| Cases / obras atendidas | Sim (blocos “últimos atendimentos”) | Em evolução (fotos reais planejadas) |
| Catálogo com **110 equipamentos** listados | Não | **Sim** |
| Página individual por equipamento | Não | **Sim** (110 páginas) |
| Busca no site (ex.: “betoneira”) | Não | **Sim** |
| Páginas por categoria (betoneiras, plataformas…) | Parcial (texto geral) | **Sim** (8 categorias com SEO) |
| Ficha técnica em plataformas aéreas | Não estruturada | **Sim** |
| Formulário de orçamento qualificado | Não | **Sim** (cidade, período, equipamento) |
| Lead salvo em banco de dados | Não | **Sim** |
| E-mail automático ao comercial | Não | **Sim** (Resend) |
| WhatsApp com contexto (qual equipamento/página) | Não | **Sim** |
| FAQ dedicada | Parcial | **Sim** |
| Página de treinamento NR (plataformas) | Não destacada | **Sim** |
| Política de privacidade (LGPD) | Sim | **Sim** |
| SEO por equipamento (long-tail Google) | Limitado | **Sim** |
| Pronto para métricas por campanha (UTM) | Depende da agência | **Sim** (planejado PostHog) |
| Painel para ver/exportar leads | Não | **Planejado** (fase 2) |
| Layout otimizado para celular na obra | Básico | **Sim** (prioridade mobile) |

---

## O que o site atual tem e a nova landing não (ainda)

| Item | Observação |
|------|------------|
| Domínio **acessoequipamentos.com.br** | A landing ainda está em URL de preview; o domínio oficial será na fase de go-live. |
| Histórico longo no ar / SEO já indexado | O site atual já está no Google há anos. |
| Blocos de blog “últimos atendimentos” | A landing terá cases/fotos reais na próxima fase; **no go-live:** redirecionamentos **301** das URLs do WP para não perder ranking (Sprint 10.10). |
| Integração já feita pela agência de tráfego | Campanhas atuais apontam para o site antigo; é preciso criar campanhas paralelas para a landing. |

---

## O que a nova landing tem e o site atual não

| Item | Benefício para o negócio |
|------|--------------------------|
| **110 equipamentos** no catálogo | Cliente do anúncio acha o que procura sem ligar para perguntar. |
| **Busca** no topo do site | Menos abandono: “betoneira”, “compactador”, “plataforma 12m”. |
| **Formulário de orçamento** estruturado | Comercial recebe cidade, período e equipamento antes de ligar. |
| **Leads no banco** | Nenhum pedido se perde se o WhatsApp não for respondido na hora. |
| **E-mail ao comercial** | Aviso automático a cada novo pedido. |
| **WhatsApp contextual** | Mensagem já diz de qual equipamento a pessoa veio. |
| **Uma URL por equipamento** | Anúncio no Google pode ir direto para “locação betoneira BH”, etc. |
| **Páginas por categoria** com texto para Google | Mais chance de aparecer em buscas específicas. |
| **Métricas de funil** (visitou → clicou WhatsApp → enviou formulário) | Saber qual campanha paga de verdade. |
| **Exportação de leads** (futuro painel) | Planilha para o comercial sem copiar conversa do WhatsApp. |
| **Menos botões repetidos** | Experiência mais clara: orçamento ou WhatsApp, sem poluição visual. |

---

## Comparativo para decisão de tráfego pago

| Pergunta | Site atual | Nova landing |
|----------|:----------:|:------------:|
| O visitante do anúncio encontra o equipamento exato? | Difícil | Sim |
| Dá para medir envio de orçamento vs. só clique? | Quase não | Sim |
| O comercial sabe cidade e período antes de ligar? | Não | Sim |
| Dá para testar campanha A vs. B com URLs diferentes? | Limitado | Sim |
| Cada equipamento pode ser página de destino do anúncio? | Não | Sim |

---

## Proposta: tráfego em paralelo (sem brigar com a agência)

| Aspecto | Como funciona |
|---------|----------------|
| Site da agência | Continua no domínio principal e nas campanhas atuais. |
| Nova landing | Recebe parte do orçamento de Ads (ex.: teste 30%) com etiquetas de campanha. |
| Período sugerido | 30 a 60 dias comparando custo por lead e qualidade dos contatos. |
| Decisão | Com números: manter só um canal, dividir, ou migrar campanhas para a landing. |

---

## Próximos passos (após aprovação)

1. Fotos reais da frota no catálogo.  
2. Subdomínio ou domínio oficial (ex.: orçamento.acessoequipamentos.com.br).  
3. Ativar analytics (PostHog) nas campanhas paralelas.  
4. Painel interno para o comercial consultar e exportar leads.

---

*Documento gerado a partir do projeto LandPage-Acesso. Detalhes técnicos no README e na documentação de go-live.*
