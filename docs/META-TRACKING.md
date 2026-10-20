# Meta: Pixel e contatos confirmados

O Pixel carrega nas paginas publicas somente apos aceitar analytics e publicidade.
O painel e rotas internas nao enviam eventos. A revogacao dos cookies suspende o Pixel.

## Eventos

- `PageView`: navegacao publica, sem repetir a mesma rota em renders consecutivos.
- `WhatsAppButtonClick`, `PhoneButtonClick` e `QuoteFormSubmitted`: eventos
  personalizados de interacao, deduplicados por tipo na sessao. Nao sao vendas nem
  confirmacao de que houve uma mensagem no WhatsApp.
- `Contact`: API de Conversoes, apos mensagem recebida e associada a um lead com
  referencia consentida do site. Usa telefone normalizado e SHA-256, identificadores
  de cookies quando presentes e `event_id` estavel por lead para reenvios.

## Configuracao

- `NEXT_PUBLIC_META_PIXEL_ID`: identificador publico do Pixel. O navegador possui
  fallback para o Pixel do dominio `1447966330544118`; o servidor exige a variavel.
- `META_CONVERSIONS_ACCESS_TOKEN`: segredo exclusivamente do servidor. Sem ele, o
  envio de `Contact` fica desativado; o Pixel continua independente.
- `META_GRAPH_API_VERSION`: versao da Graph API, configuravel em `Env.ts`.

Aplicar `0051_meta_confirmed_contacts.sql` pelo fluxo de migrations antes de publicar
o codigo que utiliza `meta_context` e `meta_contact_sent_at`. A migration e aditiva:
nao remove leads, conversas ou valores existentes.

Nao registrar tokens ou dados de contato nos logs. Uma falha na Meta nao deve
impedir a tentativa de envio independente ao Google Ads. Uma entrega Meta que falha
nao grava sucesso; outra mensagem pode repetir a tentativa com o mesmo `event_id`.
Nao ha fila dedicada de retentativas Meta nesta implementacao.

## Metricas de origem

O painel separa Google Ads, Meta Ads e outros anuncios dentro do total pago.
Google e identificado por `gclid`, `gbraid`, `wbraid` ou origem UTM com midia paga.
Meta exige origem UTM reconhecida (`facebook`, `instagram`, `meta`, etc.) e midia
paga, como `paid_social`. Uma referencia social sem midia paga continua organica.
Usar nos anuncios `utm_source=facebook&utm_medium=paid_social` (ou `instagram`).
Os contadores do site nao comprovam atribuicao nem aceite de conversao pela Meta.

## Validacao

Executar os testes `meta-pixel`, `meta-confirmed-contact`,
`meta-confirmed-contact-payload`, `traffic-channel` e `whatsapp-attribution-bridge`.
Em producao, confirmar ausencia do SDK antes do consentimento e carregamento de
`connect.facebook.net/en_US/fbevents.js` apos aceitar. Verificar recebimento no
Gerenciador de Eventos; nao criar leads reais ficticios para testar conversoes.
