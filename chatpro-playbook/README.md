# ChatPro playbook (Postgres local + Obsidian)

Worker paralelo ao site e ao `chatpro-local` (ROI). Puxa atendimentos da **ChatPro Chat**, grava no **Postgres local** (Docker na porta 5434) e gera notas no cofre Obsidian. Não usa Neon.

Fluxo: ChatPro Chat (inbox) → worker local → Postgres `:5434` → Obsidian. O webhook do site não é trocado; o worker **puxa** as conversas. Não usa Neon.

A IA **nunca confirma preço nem frete**. Valores, dias de locação e frete citados nas conversas entram em `Valores captados.md` (não oficial). O pipeline interno fica em `Oportunidades.md` — a IA da sandbox **não lê** esses dois arquivos, para não repetir número ao cliente.

## Setup

```powershell
cd chatpro-playbook
copy .env.example .env
npm install
npm run db:up
```

No `.env`:

| Variável | Função |
|----------|--------|
| `PLAYBOOK_DATABASE_URL` | Postgres local (compose na porta 5434) |
| `CHATPRO_INSTANCE_ID` | Código da instância ChatPro |
| `CHATPRO_INSTANCE_TOKEN` | Token em Configurações → Desenvolvedor |
| `ANTHROPIC_API_KEY` | Mesma chave do worker ROI |
| `OBSIDIAN_VAULT_PATH` | Cofre `Aguilar` |
| `AFTER_HOURS_ALERT_WEBHOOK_URL` | Webhook opcional para alertas operacionais de fila |
| `AFTER_HOURS_LIVE_ENABLED` | Segunda trava para envio real; padrão `false` |
| `AFTER_HOURS_ALLOWED_PHONES` | Telefones internacionais, separados por vírgula, autorizados no piloto |
| `AFTER_HOURS_ALLOW_ALL` | Liberação global explícita; mantenha `false` no piloto |

O Postgres 18 do Windows já ocupa a **5432** e o PGlite do site a **5433**. Este worker sobe outro Postgres no Docker em **5434**, só do playbook.

## Rodar o worker (ChatPro → Obsidian)

A cada **5 min** o tick sincroniza a ChatPro (até **40 leads distintos**; o mesmo WhatsApp transferido entre comercial, logística ou mecânica não conta duas vezes) e **grava o cofre se o inbox mudou**. `Valores captados.md` e `Oportunidades.md` são reescritos **no mesmo ciclo** em que entra mensagem nova, diária, prazo ou frete — sem esperar um segundo intervalo. Haiku **não lê a conversa inteira**: guarda um resumo por lead (como o ROI) e na próxima vez só vê mensagens novas. Inbox igual = não gasta Haiku de novo. Mídia também entra na fila. Tick de intervalo drena poucos jobs; `--once` drena mais.

```powershell
cd chatpro-playbook
npm run worker
```

`Ctrl+C` para. O PC não pode dormir. WhatsApp não é enviado (sandbox).

- `npm start` — um ciclo completo, força reescrever o playbook
- `npm run sync` — puxa ChatPro, atualiza `Inbox recente.md`, não chama Haiku no playbook
- `npm run playbook` — analisa o que já está no Postgres e reescreve o playbook
- `npm run worker -- --once` — um ciclo do watcher
- `npm run sandbox` — conversa local para testar o bot; **não** substitui o worker

## Aviso fora do expediente

Worker que olha as últimas conversas a cada minuto. Fora de **segunda a sexta, 7h30–17h15** (horário de Brasília), se o cliente escreveu e ninguém da equipe respondeu, envia **uma** mensagem fixa. Não orça, não fala de frete, não usa Claude.

No expediente fica mudo. Se um consultor responder de noite, também não manda. Fim de semana inteiro conta como uma janela: no máximo um aviso por conversa.

```powershell
cd chatpro-playbook
npm run after-hours -- --once
```

Isso é **sandbox**: só registra no Postgres o que *teria* enviado. **Nenhum WhatsApp sai** até você liberar.

Quando o envio real estiver liberado, a sessão é relida pelo endpoint oficial `getSessionById` antes do envio. O aviso entra em `sent_awaiting_unassign` e só muda para `queued_verified` depois que outra leitura confirmar `open: true`, o departamento original e `assing_to` vazio. Falha da API, resposta parcial ou ausência de departamento nunca concluem o ciclo. Pendências são processadas mesmo depois da abertura do expediente e mesmo que a sessão saia do limite de conversas recentes.

Antes de repetir o `unassign`, o worker compara atendente, data de atribuição e departamento com o estado salvo antes do envio. Se um humano assumiu, grava `human_claimed`; se houve transferência legítima, grava `transferred`; nos dois casos não chama `unassign`. Na terceira tentativa ainda sem confirmação, grava `alerted_at`, emite um alerta no log e, se `AFTER_HOURS_ALERT_WEBHOOK_URL` estiver configurada, publica o alerta nesse canal. A linha do bot fica marcada no Postgres (`bot_origin`) para o Follow-up e o treino não a tratarem como consultor humano.

Com `ANTHROPIC_API_KEY`, o envio real usa a mesma triagem protegida e a mesma recomendação determinística por especificações do catálogo testadas na sandbox. Sem a chave, cai no texto fixo. Sucesso HTTP de envio fica registrado como `api_accepted`; o worker consulta o histórico até confirmar `provider_confirmed` ou detectar `provider_failed` e alertar. Ausência de id na resposta vira `api_response_without_message_id`, sem reenviar cegamente e duplicar texto.

O modo real falha fechado e exige todas as travas: `AFTER_HOURS_SANDBOX=false`, `AFTER_HOURS_LIVE_ENABLED=true`, `--live`, webhook de alerta, credenciais, chave Anthropic, allowlist não vazia e o arquivo local `.after-hours-live`. No piloto, use números com DDI, por exemplo `5531...`, e mantenha `AFTER_HOURS_ALLOW_ALL=false`.

Para armar um piloto depois de validar a sandbox:

```powershell
New-Item -ItemType File .after-hours-live
npm run after-hours -- --live
```

Parada de emergência, efetiva no próximo tick (até um minuto):

```powershell
Remove-Item -LiteralPath .after-hours-live
```

Sem esse arquivo, o worker recusa qualquer envio mesmo que as variáveis tenham sido alteradas por engano.

## Rodar 24h (DigitalOcean)

O bot **puxa** a ChatPro; o droplet não precisa de porta HTTP pública. Não rode o worker live neste Windows **e** no droplet ao mesmo tempo.

1. No painel da DigitalOcean: **Create → Droplets**.
2. Imagem **Ubuntu 24.04 LTS**. Região **New York (NYC3)**.
3. Plano **Basic Regular, 2 GB RAM** (1 GB costuma estourar na build do Node).
4. Authentication: cole a chave pública deste PC (`~/.ssh/id_ed25519_vm.pub`).
5. User data (opcional): o arquivo `deploy/digitalocean-cloud-init.yml`.
6. Crie o droplet e mande o IP. Daqui o deploy é:

```powershell
cd chatpro-playbook
npm run vault:snapshot
.\scripts\deploy-vps.ps1 -HostName SEU_IP
```

Postgres **não** fica exposto na internet. Parada de emergência no droplet: `rm ~/eva/.after-hours-live` e `docker compose -f docker-compose.vps.yml down`.

Deixe o processo rodando no PC se quiser ver os ticks (não pode dormir). `Ctrl+C` para. O webhook do site reconhece `received_message`, `sent_message`, `assigned_session` e `transferred_session`. Resposta do cliente registra atividade, mas não muda o CRM para atendido; somente `assigned_session` com `assing_to` preenchido pode avançar um lead novo para `contacted`.

Texto padrão:

> Olá! Recebemos sua mensagem.
>
> O comercial da Acesso Equipamentos atende de segunda a sexta, das 7h30 às 17h15.
>
> Retornamos no próximo dia útil. Fora desse horário não passamos valor nem frete.

Opcional no `.env`: `AFTER_HOURS_MESSAGE` (uma linha) e `AFTER_HOURS_POLL_MS` (padrão **3000**). `AFTER_HOURS_SANDBOX` fica `true` até você autorizar envio real.

## Chat sandbox (testar o bot)

Conversa com a IA **neste PC**. Simula noite (20h10) mesmo de dia. WhatsApp não sai.

Pedidos de recomendação são resolvidos deterministicamente pelas aplicações, alturas e capacidades publicadas no catálogo. Se uma exigência não estiver comprovada nas especificações, o bot não sugere um modelo e encaminha a avaliação ao comercial; nenhuma recomendação significa estoque ou disponibilidade.

```powershell
cd chatpro-playbook
npm run sandbox
```

`/sair` encerra. `/reset` zera. `/contato 3199…` carrega **só** a nota daquele WhatsApp (retorno). Sem `/contato`, o bot não lê ficha de cliente.

## Notas por contato

O worker grava `Clientes/c-{whatsapp}.md` a cada leitura da ChatPro. O bot **não** mistura essas fichas no playbook. Ele só abre a nota se:

- a pessoa voltar a escrever (produção) ou você der `/contato` no sandbox
- o contato estiver em `Follow-up.md` (última fala foi do cliente, equipe ainda não respondeu)

Em cada ficha, o bloco `Notas da equipe` é seu: o worker não apaga.

## Áudio, PDF e foto

No `npm start` / `npm run playbook`, o worker enfileira transcrição de áudio (Whisper local) e resumo de PDF/foto (Haiku). A mesma mensagem não entra de novo na fila. Word não é lido. Nada disso vai para o cliente.

O WhatsApp é um só. No Obsidian as equipes ficam em pastas distintas:

- `Acesso Equipamentos/Comercial/` — locação, orçamento, propostas
- `Acesso Equipamentos/Logistica/` — troca, devolução, programação de coleta
- `Acesso Equipamentos/Mecanica/` — chamado (plataformas, andaimes, ferramentas elétricas e a combustão)

O worker classifica pela mesa da ChatPro (departamento / menu 3 mecânica / menu 6 logística). Financeiro entra na pasta Comercial com rótulo e não treina o playbook de locação.

Na mecânica, `Conhecimento/` nasce com as quatro linhas. Em `Manuais/` a equipe cola trechos em `.md` (PDF do fabricante a busca não lê). O bot **pesquisa** essas notas quando a pergunta é defeito ou operação; não carrega o cofre inteiro no prompt.

O patrimônio (`listaDePatrimonios.xls`, coluna Equipamento) vira `data/fleet-catalog.json`: **185 tipos**, sem status, cliente ou quantidade. O bot **busca** se trabalhamos com aquele tipo e só recebe até 5 hits. Nunca lê a lista inteira e **nunca confirma disponibilidade**. Para atualizar: `python scripts/extract-fleet-catalog.py` (precisa `xlrd==1.2.0`).

Em `Modulos/` a IA **cria, edita e apaga** notas quando o treino vê outro jeito de resolver. Cada ciclo: resumo do lead (problema → o que a equipe fez → resultado → lição) → atualiza `Como atendemos.md` / `Negocio e tom.md` / `Exemplos` **em cima do playbook atual** (não joga fora o que ainda vale) → cria ou reescreve módulos. O bot pesquisa esses módulos na hora de atender. Não mexe em `Notas humanas.md`, `Manuais/` nem fichas de cliente. Para travar um módulo, ponha `protegido: true` no frontmatter.

Arquivos gerados (sobrescritos a cada run, exceto `Notas humanas.md` e o que estiver em `Mecanica/Manuais` depois da primeira criação):

- `Como atendemos.md`
- `Exemplos de atendimento.md` — problema, o que a equipe fez, resultado, jeito humanizado
- `Negocio e tom.md`
- `Valores captados.md`
- `Oportunidades.md` — pipeline interno (preço, dias, frete citados; a IA não confirma ao cliente)
- `Lacunas e tratamentos.md`
- `Melhorias proximos 7 dias.md`
- `Regras da IA.md`
