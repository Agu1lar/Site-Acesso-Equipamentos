import type { AttendanceTurn } from './attendance-brain.js';
import { loadPlaybookConfig } from './config.js';
import { isBusinessOpen, sandboxNightInstant } from './duty-hours.js';
import { isAfterHoursSandbox } from './sandbox.js';
import {
  ASKS_RENTAL_START,
  CONFIRMS_TESOURA,
  DOES_NOT_REASK_START,
  EXPLAINS_FREIGHT_PROCESS,
  HYGIENE_JUDGES,
  PASSES_DISTANT_TO_COMMERCIAL,
  STAYS_IN_RMBH,
  WAIT_HOURS_JUDGE,
  confirmsFamily,
  failedJudges,
  type SandboxJudge,
} from './sandbox-judge.js';
import { runSandboxTurn } from './sandbox-session.js';
import { recordSandboxTriageRun } from './triage-learn.js';
import { readPlaybookVaultKnowledge } from './vault.js';

type ProbeTurn = {
  user: string;
  judges: SandboxJudge[];
};

type ProbeCase = {
  id: string;
  title: string;
  turns: ProbeTurn[];
};

const NO_PIX = {
  name: 'não inventa Pix',
  test: (text: string) => !/chave\s*pix|pix:\s*\S+@[^\s]+/iu.test(text),
};

const NO_OPERATOR_INCLUDED = {
  name: 'não inclui operador',
  test: (text: string) => !/vem com operador|inclui operador|operador incluso/iu.test(text),
};

const POOL: ProbeCase[] = [
  {
    id: 'gerador-betim',
    title: 'Gerador em Betim com pedido de valor',
    turns: [
      {
        user: 'aluga gerador 7kva em betim por 10 dias? quanto fica?',
        judges: [...HYGIENE_JUDGES, confirmsFamily('gerador'), STAYS_IN_RMBH, ASKS_RENTAL_START, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'manitou-nova-lima',
    title: 'Manipulador em Nova Lima com valor e frete',
    turns: [
      {
        user: 'preciso de um manitou em nova lima, 15 dias, me passa valor e frete',
        judges: [
          ...HYGIENE_JUDGES,
          confirmsFamily('manitou|manipulador'),
          STAYS_IN_RMBH,
          ASKS_RENTAL_START,
          WAIT_HOURS_JUDGE,
          {
            name: 'não confirma modelo em estoque',
            test: (text) => !/\btemos\s+(?:a |o |um |uma )?(manipulador|manitou|mxt)|mxt\s*\d/iu.test(text),
          },
        ],
      },
    ],
  },
  {
    id: 'franna-contagem',
    title: 'Franna em Contagem por período longo',
    turns: [
      {
        user: 'voces locam guindaste franna em contagem por 45 dias?',
        judges: [
          ...HYGIENE_JUDGES,
          confirmsFamily('franna|guindaste'),
          STAYS_IN_RMBH,
          {
            name: 'não troca por andaime',
            test: (text) => !/tubo e bra/iu.test(text),
          },
          ASKS_RENTAL_START,
          WAIT_HOURS_JUDGE,
        ],
      },
    ],
  },
  {
    id: 'martelete-sabara',
    title: 'Martelete em Sabará',
    turns: [
      {
        user: 'martelete sds plus em sabará, 3 dias, qual o valor?',
        judges: [...HYGIENE_JUDGES, confirmsFamily('martelete'), STAYS_IN_RMBH, ASKS_RENTAL_START, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'compactador-ibirite',
    title: 'Compactador em Ibirité',
    turns: [
      {
        user: 'aluga compactador de solo em ibirité?',
        judges: [...HYGIENE_JUDGES, confirmsFamily('compactador'), STAYS_IN_RMBH, ASKS_RENTAL_START, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'paleteira-contagem',
    title: 'Paleteira em Contagem',
    turns: [
      {
        user: 'aluga paleteira hidraulica em contagem?',
        judges: [...HYGIENE_JUDGES, confirmsFamily('paleteira'), STAYS_IN_RMBH, ASKS_RENTAL_START, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'compressor-bh',
    title: 'Compressor em Belo Horizonte',
    turns: [
      {
        user: 'voces alugam compressor de ar em belo horizonte?',
        judges: [...HYGIENE_JUDGES, confirmsFamily('compressor'), STAYS_IN_RMBH, ASKS_RENTAL_START, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'lagoa-santa',
    title: 'Cobertura em Lagoa Santa (RMBH)',
    turns: [
      {
        user: 'atendem lagoa santa?',
        judges: [...HYGIENE_JUDGES, STAYS_IN_RMBH, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'sete-lagoas',
    title: 'Cobertura em Sete Lagoas (fora da RMBH)',
    turns: [
      {
        user: 'atendem sete lagoas?',
        judges: [...HYGIENE_JUDGES, PASSES_DISTANT_TO_COMMERCIAL, ASKS_RENTAL_START, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'curitiba',
    title: 'Cobertura em Curitiba',
    turns: [
      {
        user: 'consigo locar plataforma em curitiba?',
        judges: [
          ...HYGIENE_JUDGES,
          PASSES_DISTANT_TO_COMMERCIAL,
          ASKS_RENTAL_START,
          WAIT_HOURS_JUDGE,
          {
            name: 'não repregunta tipo já dito',
            test: (text) => !/qual equipamento e por quantos dias/iu.test(text),
          },
        ],
      },
    ],
  },
  {
    id: 'rio',
    title: 'Entrega no Rio de Janeiro',
    turns: [
      {
        user: 'voces entregam no rio de janeiro?',
        judges: [...HYGIENE_JUDGES, PASSES_DISTANT_TO_COMMERCIAL, ASKS_RENTAL_START, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'uberlandia',
    title: 'Plataforma em Uberlândia',
    turns: [
      {
        user: 'aluga plataforma tesoura em uberlandia por 20 dias?',
        judges: [
          ...HYGIENE_JUDGES,
          PASSES_DISTANT_TO_COMMERCIAL,
          ASKS_RENTAL_START,
          WAIT_HOURS_JUDGE,
          {
            name: 'não repregunta tipo e prazo já ditos',
            test: (text) => !/qual equipamento e por quantos dias/iu.test(text),
          },
        ],
      },
    ],
  },
  {
    id: 'empilhadeira',
    title: 'Empilhadeira fora de catálogo',
    turns: [
      {
        user: 'aluga empilhadeira eletrica?',
        judges: [
          ...HYGIENE_JUDGES,
          {
            name: 'recusa empilhadeira',
            test: (text) => /não locamos|não trabalhamos|não alugamos/iu.test(text),
          },
          WAIT_HOURS_JUDGE,
        ],
      },
    ],
  },
  {
    id: 'tesoura-brumadinho',
    title: 'Tesoura em Brumadinho com locação e frete',
    turns: [
      {
        user: 'tesoura 12m em brumadinho 20 dias, valor da locação e do frete',
        judges: [
          ...HYGIENE_JUDGES,
          CONFIRMS_TESOURA,
          STAYS_IN_RMBH,
          EXPLAINS_FREIGHT_PROCESS,
          ASKS_RENTAL_START,
          WAIT_HOURS_JUDGE,
          {
            name: 'não confirma tesoura em estoque',
            test: (text) => !/temos plataformas? tesoura|tesoura.{0,24}dispon/iu.test(text),
          },
        ],
      },
    ],
  },
  {
    id: 'dois-equipamentos',
    title: 'Tesoura e betoneira no mesmo pedido',
    turns: [
      {
        user: 'preciso de tesoura e betoneira em betim por uma semana',
        judges: [
          ...HYGIENE_JUDGES,
          CONFIRMS_TESOURA,
          confirmsFamily('betoneira'),
          STAYS_IN_RMBH,
          ASKS_RENTAL_START,
          WAIT_HOURS_JUDGE,
        ],
      },
    ],
  },
  {
    id: 'operador',
    title: 'Pedido de articulada com operador',
    turns: [
      {
        user: 'a articulada vem com operador?',
        judges: [
          ...HYGIENE_JUDGES,
          confirmsFamily('articulada'),
          NO_OPERATOR_INCLUDED,
          WAIT_HOURS_JUDGE,
        ],
      },
    ],
  },
  {
    id: 'tabela',
    title: 'Pedido de tabela de preços',
    turns: [
      {
        user: 'me manda a tabela de preços de todas as plataformas',
        judges: [...HYGIENE_JUDGES, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'amanha',
    title: 'Urgência para amanhã',
    turns: [
      {
        user: 'preciso da tesoura pra amanhã cedo em contagem, tem?',
        judges: [...HYGIENE_JUDGES, CONFIRMS_TESOURA, STAYS_IN_RMBH, DOES_NOT_REASK_START, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'desconto',
    title: 'Pedido de desconto em gerador',
    turns: [
      {
        user: 'faz desconto se eu fechar 30 dias de gerador em bh?',
        judges: [...HYGIENE_JUDGES, confirmsFamily('gerador'), STAYS_IN_RMBH, ASKS_RENTAL_START, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'pix',
    title: 'Pedido de chave Pix',
    turns: [
      {
        user: 'aceita pix? qual a chave?',
        judges: [...HYGIENE_JUDGES, NO_PIX, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'mini-grua',
    title: 'Mini grua em Santa Luzia',
    turns: [
      {
        user: 'guincho mini grua 500kg em santa luzia por 8 dias, quanto custa o frete?',
        judges: [
          ...HYGIENE_JUDGES,
          confirmsFamily('guincho|grua'),
          STAYS_IN_RMBH,
          ASKS_RENTAL_START,
          WAIT_HOURS_JUDGE,
        ],
      },
    ],
  },
  {
    id: 'esmerilhadeira-frete',
    title: 'Esmerilhadeira em Vespasiano com frete',
    turns: [
      {
        user: 'esmerilhadeira 7 polegadas, 5 dias, vespasiano, quanto é o frete?',
        judges: [
          ...HYGIENE_JUDGES,
          confirmsFamily('esmerilhadeira'),
          STAYS_IN_RMBH,
          ASKS_RENTAL_START,
          WAIT_HOURS_JUDGE,
        ],
      },
    ],
  },
];

function shuffle<T>(items: T[], seed: number) {
  const next = [...items];
  let state = Math.trunc(seed) % 0x1_0000_0000;
  for (let index = next.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) % 0x1_0000_0000;
    if (state < 0) {
      state += 0x1_0000_0000;
    }
    const swapAt = state % (index + 1);
    const current = next[index];
    const other = next[swapAt];
    if (current === undefined || other === undefined) {
      continue;
    }
    next[index] = other;
    next[swapAt] = current;
  }
  return next;
}

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
  const seed = Date.now() % 1_000_000;
  const cases = shuffle(POOL, seed);
  const failures: string[] = [];

  console.log('[sandbox-probe] horário simulado:', offHours ? 'fora do expediente' : 'expediente aberto');
  console.log('[sandbox-probe] seed:', seed);
  console.log('[sandbox-probe] casos:', cases.length);
  console.log('');

  for (const item of cases) {
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
    suite: 'probe',
    failures,
  });

  if (failures.length > 0) {
    console.error(`[sandbox-probe] ${failures.length} falha(s):`);
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }
  console.log('[sandbox-probe] todos os casos passaram');
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[sandbox-probe] falhou', message);
  process.exit(1);
}
