import type { AttendanceTurn } from './attendance-brain.js';
import { loadPlaybookConfig } from './config.js';
import { isBusinessOpen, sandboxNightInstant } from './duty-hours.js';
import { isAfterHoursSandbox } from './sandbox.js';
import {
  ASKS_RENTAL_START,
  CONFIRMS_ANDAIME_TUBO,
  CONFIRMS_TESOURA,
  HYGIENE_JUDGES,
  STAYS_IN_RMBH,
  WAIT_HOURS_JUDGE,
  confirmsFamily,
  failedJudges,
  type SandboxJudge,
} from './sandbox-judge.js';
import { runSandboxTurn } from './sandbox-session.js';
import { recordSandboxTriageRun } from './triage-learn.js';
import { readPlaybookVaultKnowledge } from './vault.js';

type CatalogTurn = {
  user: string;
  judges: SandboxJudge[];
};

type CatalogCase = {
  id: string;
  title: string;
  turns: CatalogTurn[];
};

const NO_TEMOS_MODELO: SandboxJudge = {
  name: 'não confirma modelo em estoque',
  test: (text) => !/\btemos\s+(?:a |o |as |os |um |uma )?(gs|sj|hb|pep|mxt|plataforma|manipulador)|mxt\s*\d/iu.test(text),
};

const CASES: CatalogCase[] = [
  {
    id: 'grande-tesoura-gs',
    title: 'Tesoura GS 1930 em Contagem (locação grande)',
    turns: [
      {
        user: 'aluga plataforma tesoura gs 1930 em contagem por 20 dias? quanto custa?',
        judges: [...HYGIENE_JUDGES, CONFIRMS_TESOURA, STAYS_IN_RMBH, ASKS_RENTAL_START, WAIT_HOURS_JUDGE, NO_TEMOS_MODELO],
      },
    ],
  },
  {
    id: 'grande-tesoura-alta',
    title: 'Tesoura 15 m GS 4655 em BH (locação grande)',
    turns: [
      {
        user: 'preciso de tesoura de 15 metros em belo horizonte, 30 dias, me passa a diaria',
        judges: [
          ...HYGIENE_JUDGES,
          CONFIRMS_TESOURA,
          STAYS_IN_RMBH,
          ASKS_RENTAL_START,
          WAIT_HOURS_JUDGE,
          NO_TEMOS_MODELO,
          {
            name: 'não despeja lista GS',
            test: (text) => !/gs[\s-]?\d{3,}.{0,40}gs[\s-]?\d{3,}/iu.test(text),
          },
        ],
      },
    ],
  },
  {
    id: 'grande-articulada',
    title: 'Articulada diesel em Betim (locação grande)',
    turns: [
      {
        user: 'voces locam plataforma articulada diesel em betim por 15 dias?',
        judges: [...HYGIENE_JUDGES, confirmsFamily('articulada'), STAYS_IN_RMBH, ASKS_RENTAL_START, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'grande-franna',
    title: 'Franna 45 dias em Contagem (locação grande)',
    turns: [
      {
        user: 'preciso de guindaste franna em contagem por 45 dias, tem?',
        judges: [
          ...HYGIENE_JUDGES,
          confirmsFamily('franna|guindaste'),
          STAYS_IN_RMBH,
          ASKS_RENTAL_START,
          WAIT_HOURS_JUDGE,
          {
            name: 'não troca por andaime',
            test: (text) => !/tubo e bra/iu.test(text),
          },
        ],
      },
    ],
  },
  {
    id: 'grande-andaime',
    title: 'Andaime tubo e braçadeira 8 m em BH (locação grande)',
    turns: [
      {
        user: 'aluga andaime tubo e bracadeira 8 metros em belo horizonte por uma semana?',
        judges: [...HYGIENE_JUDGES, CONFIRMS_ANDAIME_TUBO, STAYS_IN_RMBH, ASKS_RENTAL_START, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'grande-manitou',
    title: 'Manitou em Nova Lima 15 dias (locação grande)',
    turns: [
      {
        user: 'manipulador telescopico manitou em nova lima, 15 dias, valor e frete',
        judges: [...HYGIENE_JUDGES, confirmsFamily('manitou|manipulador'), STAYS_IN_RMBH, ASKS_RENTAL_START, WAIT_HOURS_JUDGE, NO_TEMOS_MODELO],
      },
    ],
  },
  {
    id: 'grande-mastro',
    title: 'Plataforma mastro em Santa Luzia (locação grande)',
    turns: [
      {
        user: 'aluga plataforma de mastro vertical em santa luzia por 10 dias?',
        judges: [...HYGIENE_JUDGES, confirmsFamily('mastro'), STAYS_IN_RMBH, ASKS_RENTAL_START, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'pequena-betoneira',
    title: 'Betoneira 400 L em Contagem (locação pequena)',
    turns: [
      {
        user: 'aluga betoneira 400 litros em contagem por 5 dias? quanto fica?',
        judges: [...HYGIENE_JUDGES, confirmsFamily('betoneira'), STAYS_IN_RMBH, ASKS_RENTAL_START, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'pequena-martelete',
    title: 'Martelete SDS Plus em Sabará (locação pequena)',
    turns: [
      {
        user: 'martelete sds plus em sabará, 3 dias, qual o valor?',
        judges: [...HYGIENE_JUDGES, confirmsFamily('martelete'), STAYS_IN_RMBH, ASKS_RENTAL_START, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'pequena-esmerilhadeira',
    title: 'Esmerilhadeira 7" em Vespasiano (locação pequena)',
    turns: [
      {
        user: 'esmerilhadeira 7 polegadas, 4 dias, vespasiano, quanto é o frete?',
        judges: [...HYGIENE_JUDGES, confirmsFamily('esmerilhadeira'), STAYS_IN_RMBH, ASKS_RENTAL_START, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'pequena-furadeira',
    title: 'Furadeira de impacto em Ibirité (locação pequena)',
    turns: [
      {
        user: 'voces alugam furadeira de impacto em ibirité por 2 dias?',
        judges: [...HYGIENE_JUDGES, confirmsFamily('furadeira'), STAYS_IN_RMBH, ASKS_RENTAL_START, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'pequena-serra-marmore',
    title: 'Serra mármore em BH (locação pequena)',
    turns: [
      {
        user: 'aluga serra marmore 220v em belo horizonte por 3 dias?',
        judges: [...HYGIENE_JUDGES, confirmsFamily('serra'), STAYS_IN_RMBH, ASKS_RENTAL_START, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'pequena-placa',
    title: 'Placa vibratória em Betim (locação pequena)',
    turns: [
      {
        user: 'aluga placa vibratoria a gasolina em betim por uma semana?',
        judges: [...HYGIENE_JUDGES, confirmsFamily('placa|vibrat|compactador'), STAYS_IN_RMBH, ASKS_RENTAL_START, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'pequena-bomba',
    title: 'Bomba d’água 2" em Contagem (locação pequena)',
    turns: [
      {
        user: 'precisa de bomba de agua 2 polegadas em contagem, 4 dias, tem?',
        judges: [...HYGIENE_JUDGES, confirmsFamily('bomba'), STAYS_IN_RMBH, ASKS_RENTAL_START, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'pequena-gerador',
    title: 'Gerador 7 kVA em Betim (locação pequena)',
    turns: [
      {
        user: 'aluga gerador 7kva em betim por 10 dias? quanto fica?',
        judges: [...HYGIENE_JUDGES, confirmsFamily('gerador'), STAYS_IN_RMBH, ASKS_RENTAL_START, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'pequena-paleteira',
    title: 'Paleteira hidráulica em Contagem (locação pequena)',
    turns: [
      {
        user: 'aluga paleteira hidraulica em contagem por 7 dias?',
        judges: [...HYGIENE_JUDGES, confirmsFamily('paleteira'), STAYS_IN_RMBH, ASKS_RENTAL_START, WAIT_HOURS_JUDGE],
      },
    ],
  },
];

async function main() {
  const config = loadPlaybookConfig();
  if (!isAfterHoursSandbox()) {
    throw new Error('Sandbox precisa estar ligado. AFTER_HOURS_SANDBOX=true');
  }
  if (!config.anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY is required');
  }
  const offHours = !isBusinessOpen(sandboxNightInstant(new Date()));
  const vaultKnowledge = readPlaybookVaultKnowledge({
    vaultPath: config.obsidianVaultPath,
    folder: config.obsidianPlaybookFolder,
  });
  const apiKey = config.anthropicApiKey;
  const failures: string[] = [];

  console.log('[sandbox-catalog] horário simulado:', offHours ? 'fora do expediente' : 'expediente aberto');
  console.log('[sandbox-catalog] casos:', CASES.length);
  console.log('');

  for (const item of CASES) {
    const history: AttendanceTurn[] = [];
    console.log(`## ${item.id} — ${item.title}`);
    for (const [index, turn] of item.turns.entries()) {
      const reply = await runSandboxTurn({
        config,
        apiKey,
        vaultKnowledge,
        history,
        line: turn.user,
        offHours,
      });
      history.push({ role: 'user', text: turn.user });
      history.push({ role: 'assistant', text: reply.text });
      const failed = failedJudges(reply.text, turn.judges);
      const mark = failed.length === 0 ? 'ok' : 'FALHOU';
      console.log(`Você: ${turn.user}`);
      console.log(`Bot: ${reply.text}`);
      console.log(`[${mark}] turno ${index + 1}${failed.length ? ` — ${failed.join(', ')}` : ''}`);
      console.log('');
      if (failed.length > 0) {
        failures.push(`${item.id}#${index + 1}: ${failed.join(', ')}`);
      }
    }
  }

  recordSandboxTriageRun({
    vaultPath: config.obsidianVaultPath,
    folder: config.obsidianPlaybookFolder,
    suite: 'catalog',
    failures,
  });

  if (failures.length > 0) {
    console.error(`[sandbox-catalog] ${failures.length} falha(s):`);
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }
  console.log('[sandbox-catalog] todos os casos passaram');
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[sandbox-catalog] falhou', message);
  process.exit(1);
}
