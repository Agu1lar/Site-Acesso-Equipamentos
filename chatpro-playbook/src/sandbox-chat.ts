import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import type { AttendanceTurn } from './attendance-brain.js';
import { findContactNoteByPhone } from './contact-note.js';
import { loadPlaybookConfig } from './config.js';
import { allTeamFolders } from './attendance-team.js';
import { isBusinessOpen, sandboxNightInstant } from './duty-hours.js';
import { isAfterHoursSandbox } from './sandbox.js';
import { runSandboxTurn } from './sandbox-session.js';
import { readPlaybookVaultKnowledge } from './vault.js';

/**
 * Local REPL to test the attendance bot. WhatsApp stays blocked in sandbox.
 */
async function main() {
  const config = loadPlaybookConfig();
  if (!isAfterHoursSandbox()) {
    throw new Error('Sandbox precisa estar ligado para este chat. AFTER_HOURS_SANDBOX=true');
  }
  if (!config.anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY is required');
  }
  const apiKey = config.anthropicApiKey;

  const forceExpediente = process.argv.includes('--expediente');
  const clock = forceExpediente ? new Date() : sandboxNightInstant(new Date());
  const offHours = !isBusinessOpen(clock);
  const vaultKnowledge = readPlaybookVaultKnowledge({
    vaultPath: config.obsidianVaultPath,
    folder: config.obsidianPlaybookFolder,
  });

  console.log('[sandbox] chat do bot de atendimento — nenhum WhatsApp sai');
  console.log('[sandbox] horário simulado:', offHours ? 'fora do expediente' : 'expediente aberto');
  console.log('[sandbox] playbook:', vaultKnowledge ? 'lido do Obsidian' : 'ainda vazio');
  console.log('[sandbox] /sair encerra · /reset zera · /contato 3199… carrega a nota daquele WhatsApp');
  console.log('');

  const rl = createInterface({ input, output });
  const history: AttendanceTurn[] = [];
  let contactContext: string | null = null;
  let contactLabel = 'nenhum';

  try {
    while (true) {
      const line = (await rl.question('Você: ')).trim();
      if (!line) {
        continue;
      }
      if (line === '/sair' || line === '/exit') {
        break;
      }
      if (line === '/reset') {
        history.length = 0;
        contactContext = null;
        contactLabel = 'nenhum';
        console.log('Bot: conversa zerada. Sem nota de contato.\n');
        continue;
      }
      if (line.startsWith('/contato ')) {
        const found = findContactNoteByPhone({
          vaultPath: config.obsidianVaultPath,
          folders: allTeamFolders(config.obsidianCompanyFolder),
          query: line.slice('/contato '.length),
        });
        if (!found) {
          console.log('Bot: não achei nota desse número. O worker precisa ter lido essa conversa antes.\n');
          continue;
        }
        contactContext = found.body;
        contactLabel = found.noteId.slice(-4);
        console.log(`Bot: nota do contato •••${contactLabel} carregada (só nesta conversa).\n`);
        continue;
      }

      const reply = await runSandboxTurn({
        config,
        apiKey,
        vaultKnowledge,
        history,
        line,
        offHours,
        contactContext,
      });
      history.push({ role: 'user', text: line });
      history.push({ role: 'assistant', text: reply.text });
      console.log(`Bot: ${reply.text}\n`);
    }
  } finally {
    rl.close();
  }
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[sandbox] falhou', message);
  process.exit(1);
}
