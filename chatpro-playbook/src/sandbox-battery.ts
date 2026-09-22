import type { AttendanceTurn } from './attendance-brain.js';
import { loadPlaybookConfig } from './config.js';
import { dateFromSaoPauloWallClock } from './duty-hours.js';
import {
  ASKS_ANYTHING_ELSE,
  ASKS_RENTAL_START,
  CONFIRMS_ANDAIME_TUBO,
  CONFIRMS_CALENDAR_START,
  CONFIRMS_REGISTERED,
  CONFIRMS_TESOURA,
  EXPLAINS_FREIGHT_PROCESS,
  EXPLAINS_PEMT,
  EXPLAINS_RENTAL_PROCESS,
  GREETING_OFFERS_HELP,
  HYGIENE_JUDGES,
  NO_ARTICULADA_SWAP,
  NO_DELIVERY_TODAY,
  NO_INVENTED_SEDE,
  NO_PERMITS_ELEVATED_DRIVE,
  NO_TECH_PROCEDURE,
  NO_TRAINING_SLOT_OR_PRICE,
  NO_UNASKED_PHONE,
  NO_UNREQUESTED_ANDAIME_TYPE,
  REFUSES_TRUCK,
  PASSES_DISTANT_TO_COMMERCIAL,
  STAYS_IN_RMBH,
  STAYS_ON_LOGISTICS,
  WAIT_HOURS_JUDGE,
  confirmsFamily,
  omitsWords,
  refusesFamily,
  failedJudges,
} from './sandbox-judge.js';
import type { SandboxJudge } from './sandbox-judge.js';
import { runSandboxTurn } from './sandbox-session.js';
import { recordSandboxTriageRun } from './triage-learn.js';
import { readPlaybookVaultKnowledge } from './vault.js';

type BatteryTurn = {
  user: string;
  judges: SandboxJudge[];
  extraRetrieved?: string;
};

type BatteryCase = {
  id: string;
  title: string;
  turns: BatteryTurn[];
};

const CASES: BatteryCase[] = [
  {
    id: 'tesoura-contagem',
    title: 'Plataforma tesoura 13 m em Contagem',
    turns: [
      {
        user: 'ola',
        judges: [...HYGIENE_JUDGES, GREETING_OFFERS_HELP, WAIT_HOURS_JUDGE],
      },
      {
        user: 'gostaria de fazer a locação de uma plataforma tesoura para o municipio de contagem',
        judges: [...HYGIENE_JUDGES, CONFIRMS_TESOURA, NO_ARTICULADA_SWAP, ASKS_RENTAL_START],
      },
      {
        user: 'de 13 metros de altura, locação por 3 dias',
        judges: [...HYGIENE_JUDGES, CONFIRMS_TESOURA, NO_ARTICULADA_SWAP, ASKS_RENTAL_START, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'andaime-pf',
    title: 'Andaime fachada PF em BH',
    turns: [
      {
        user: 'boa noite, voces trabalham com que tipo de andaimes?',
        judges: [...HYGIENE_JUDGES, CONFIRMS_ANDAIME_TUBO],
      },
      {
        user: 'é fachada, altura de 8 metros, em belo horizonte, sou pessoa fisica não é para empresa, quero alugar por uma semana',
        judges: [...HYGIENE_JUDGES, CONFIRMS_ANDAIME_TUBO, ASKS_RENTAL_START, WAIT_HOURS_JUDGE],
      },
      {
        user: 'José Victor Souza Aguilar, em rua gentil portugal do brasil , 55, Camargos, a fachada tem 11 metros de largura, ainda estou definindo as datas',
        judges: [...HYGIENE_JUDGES, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'caminhao',
    title: 'Caminhão fora de catálogo',
    turns: [
      {
        user: 'voces alugam caminhao pipa?',
        judges: [...HYGIENE_JUDGES, REFUSES_TRUCK, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'preco',
    title: 'Pedido de diária',
    turns: [
      {
        user: 'quanto custa a diaria da plataforma tesoura?',
        judges: [...HYGIENE_JUDGES, CONFIRMS_TESOURA, ASKS_RENTAL_START, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'articulada',
    title: 'Plataforma articulada',
    turns: [
      {
        user: 'tem plataforma articulada para locação em betim?',
        judges: [
          ...HYGIENE_JUDGES,
          {
            name: 'confirma articulada',
            test: (text) => /articulada/iu.test(text) && !/não (?:temos|locamos).{0,60}articulada/iu.test(text),
          },
          ASKS_RENTAL_START,
        ],
      },
      {
        user: 'de 12 metros, 5 dias',
        judges: [
          ...HYGIENE_JUDGES,
          {
            name: 'confirma articulada',
            test: (text) => /articulada/iu.test(text) && !/não (?:temos|locamos).{0,60}articulada/iu.test(text),
          },
          ASKS_RENTAL_START,
          WAIT_HOURS_JUDGE,
        ],
      },
    ],
  },
  {
    id: 'betoneira',
    title: 'Betoneira no catálogo',
    turns: [
      {
        user: 'aluga betoneira em nova lima por 5 dias?',
        judges: [
          ...HYGIENE_JUDGES,
          {
            name: 'confirma betoneira',
            test: (text) => /betoneira/iu.test(text) && !/não (?:temos|locamos).{0,40}betoneira/iu.test(text),
          },
          ASKS_RENTAL_START,
          WAIT_HOURS_JUDGE,
        ],
      },
    ],
  },
  {
    id: 'ligar-agora',
    title: 'Pedido para ligar agora',
    turns: [
      {
        user: 'me passa o telefone para eu ligar agora',
        judges: [
          ...HYGIENE_JUDGES,
          WAIT_HOURS_JUDGE,
          {
            name: 'não convoca ligação imediata',
            test: (text) => !/pode ligar|liga agora|chama agora/iu.test(text),
          },
        ],
      },
    ],
  },
  {
    id: 'valores-avulsos',
    title: 'Pedido de valor sem período',
    turns: [
      {
        user: 'me passa o valor da plataforma tesoura',
        judges: [...HYGIENE_JUDGES, CONFIRMS_TESOURA, ASKS_RENTAL_START, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'frete-processo',
    title: 'Como funciona o frete',
    turns: [
      {
        user: 'como funciona o frete de vocês?',
        judges: [...HYGIENE_JUDGES, EXPLAINS_FREIGHT_PROCESS, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'frete-valor',
    title: 'Pedido de valor de frete',
    turns: [
      {
        user: 'quanto é o frete para levar uma tesoura até Contagem?',
        judges: [...HYGIENE_JUDGES, CONFIRMS_TESOURA, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'locacao-processo',
    title: 'Como funciona a locação',
    turns: [
      {
        user: 'como funciona a locação de vocês?',
        judges: [...HYGIENE_JUDGES, EXPLAINS_RENTAL_PROCESS, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'prazo-entrega',
    title: 'Tempo para levar o equipamento',
    turns: [
      {
        user: 'quanto tempo demora para levar o equipamento na obra em Betim?',
        judges: [...HYGIENE_JUDGES, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'estimado-sem-proposta',
    title: 'Preço estimado sem proposta equivalente',
    turns: [
      {
        user: 'plataforma tesoura em Contagem por 3 dias, me passa um preço estimado',
        judges: [...HYGIENE_JUDGES, CONFIRMS_TESOURA, ASKS_RENTAL_START, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'estimado-com-proposta',
    title: 'Preço estimado com proposta equivalente',
    turns: [
      {
        user: 'plataforma tesoura para 30 dias em BH, quanto fica o estimado?',
        extraRetrieved: [
          '## Estimativa não oficial',
          'Tipo: plataforma tesoura',
          'Período: 30 dias',
          'Faixa captada em proposta equivalente: R$ 4.800',
          'Não é tabela oficial. Só cite se o pedido for o mesmo tipo e o mesmo período. Diga que o comercial confirma.',
          'Não cite frete nem disponibilidade.',
        ].join('\n'),
        judges: [
          ...HYGIENE_JUDGES,
          CONFIRMS_TESOURA,
          ASKS_RENTAL_START,
          WAIT_HOURS_JUDGE,
        ],
      },
    ],
  },
  {
    id: 'diaria-e-frete',
    title: 'Diária e frete no mesmo pedido',
    turns: [
      {
        user: 'me passa a diária e o frete da articulada para 2 dias em Nova Lima',
        judges: [
          ...HYGIENE_JUDGES,
          {
            name: 'confirma articulada',
            test: (text) => /articulada/iu.test(text) && !/não (?:temos|locamos).{0,60}articulada/iu.test(text),
          },
          ASKS_RENTAL_START,
          WAIT_HOURS_JUDGE,
        ],
      },
    ],
  },
  {
    id: 'fora-rmbh',
    title: 'Locação fora da RMBH (São Paulo)',
    turns: [
      {
        user: 'voces tambem alugar para são paulo?',
        judges: [...HYGIENE_JUDGES, PASSES_DISTANT_TO_COMMERCIAL, ASKS_RENTAL_START, WAIT_HOURS_JUDGE],
      },
      {
        user: 'plataforma tesoura por 10 dias',
        judges: [...HYGIENE_JUDGES, PASSES_DISTANT_TO_COMMERCIAL, ASKS_RENTAL_START, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'piloto-andaime-martelo',
    title: 'Piloto: andaime em Ribeirão, cumprimento, depois martelo',
    turns: [
      {
        user: 'gostaria de fazer locação de um andaime para uma obra em Ribeirão das Neves',
        judges: [
          ...HYGIENE_JUDGES,
          confirmsFamily('andaime'),
          NO_UNREQUESTED_ANDAIME_TYPE,
          ASKS_RENTAL_START,
          WAIT_HOURS_JUDGE,
        ],
      },
      {
        user: 'Preciso para semana que vem na terça feira por 10 dias',
        judges: [
          ...HYGIENE_JUDGES,
          confirmsFamily('andaime'),
          NO_UNREQUESTED_ANDAIME_TYPE,
          CONFIRMS_CALENDAR_START,
          CONFIRMS_REGISTERED,
          ASKS_ANYTHING_ELSE,
          WAIT_HOURS_JUDGE,
        ],
      },
      {
        user: 'Bom dia\nTudo bem ?',
        judges: [
          ...HYGIENE_JUDGES,
          GREETING_OFFERS_HELP,
          omitsWords(['andaime', 'Ribeirão', 'registrad']),
          WAIT_HOURS_JUDGE,
        ],
      },
      {
        user: 'Quero alugar um martelo 10kg',
        judges: [
          ...HYGIENE_JUDGES,
          confirmsFamily('martelo|martelete'),
          omitsWords(['andaime']),
          ASKS_RENTAL_START,
          WAIT_HOURS_JUDGE,
        ],
      },
    ],
  },
  {
    id: 'piloto-pemt',
    title: 'Piloto: treinamento PEMT no cumprimento',
    turns: [
      {
        user: 'Bom dia, quero saber se vocês fornecem serviço de treinamento em pemt',
        judges: [...HYGIENE_JUDGES, EXPLAINS_PEMT, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'piloto-devolucao',
    title: 'Piloto: oi e depois devolução',
    turns: [
      {
        user: 'Bom dia',
        judges: [...HYGIENE_JUDGES, GREETING_OFFERS_HELP, WAIT_HOURS_JUDGE],
      },
      {
        user: 'quero devolver uma tesoura',
        judges: [...HYGIENE_JUDGES, STAYS_ON_LOGISTICS, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'piloto-retoma',
    title: 'Piloto: retoma o andaime só se pedir',
    turns: [
      {
        user: 'gostaria de fazer locação de um andaime para uma obra em Ribeirão das Neves',
        judges: [...HYGIENE_JUDGES, confirmsFamily('andaime'), ASKS_RENTAL_START, WAIT_HOURS_JUDGE],
      },
      {
        user: 'semana que vem na terça por 10 dias',
        judges: [...HYGIENE_JUDGES, CONFIRMS_REGISTERED, ASKS_ANYTHING_ELSE, WAIT_HOURS_JUDGE],
      },
      {
        user: 'ainda vale aquele orçamento',
        judges: [
          ...HYGIENE_JUDGES,
          confirmsFamily('andaime'),
          omitsWords(['martelo', 'martelete']),
          WAIT_HOURS_JUDGE,
        ],
      },
    ],
  },
  {
    id: 'piloto-andaime-variado',
    title: 'Piloto variado: andaime, cumprimento e martelo',
    turns: [
      {
        user: 'Oi, preciso de um andaime lá em Ribeirão das Neves',
        judges: [
          ...HYGIENE_JUDGES,
          confirmsFamily('andaime'),
          NO_UNREQUESTED_ANDAIME_TYPE,
          ASKS_RENTAL_START,
          WAIT_HOURS_JUDGE,
        ],
      },
      {
        user: 'a locação é p/ terça da semana que vem, fica 10 dias na obra',
        judges: [
          ...HYGIENE_JUDGES,
          confirmsFamily('andaime'),
          NO_UNREQUESTED_ANDAIME_TYPE,
          CONFIRMS_CALENDAR_START,
          CONFIRMS_REGISTERED,
          ASKS_ANYTHING_ELSE,
          WAIT_HOURS_JUDGE,
        ],
      },
      {
        user: 'Oi, tudo certo?',
        judges: [
          ...HYGIENE_JUDGES,
          GREETING_OFFERS_HELP,
          omitsWords(['andaime', 'Ribeirão', 'registrad']),
          WAIT_HOURS_JUDGE,
        ],
      },
      {
        user: 'pode ser um martelo demolidor de 10 quilos',
        judges: [
          ...HYGIENE_JUDGES,
          confirmsFamily('martelo|martelete'),
          omitsWords(['andaime']),
          ASKS_RENTAL_START,
          WAIT_HOURS_JUDGE,
        ],
      },
    ],
  },
  {
    id: 'piloto-pemt-variado',
    title: 'Piloto variado: curso de PEMT',
    turns: [
      {
        user: 'vocês dão curso de PEMT?',
        judges: [...HYGIENE_JUDGES, EXPLAINS_PEMT, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'piloto-devolucao-variado',
    title: 'Piloto variado: devolução sem cumprimento',
    turns: [
      {
        user: 'preciso devolver a tesoura que tá na obra',
        judges: [...HYGIENE_JUDGES, STAYS_ON_LOGISTICS, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'piloto-retoma-variado',
    title: 'Piloto variado: retoma o orçamento',
    turns: [
      {
        user: 'quero um andaime em Ribeirão das Neves',
        judges: [...HYGIENE_JUDGES, confirmsFamily('andaime'), ASKS_RENTAL_START, WAIT_HOURS_JUDGE],
      },
      {
        user: 'começa terça da semana que vem, 10 dias',
        judges: [...HYGIENE_JUDGES, CONFIRMS_REGISTERED, ASKS_ANYTHING_ELSE, WAIT_HOURS_JUDGE],
      },
      {
        user: 'aquele orçamento ainda vale?',
        judges: [
          ...HYGIENE_JUDGES,
          confirmsFamily('andaime'),
          omitsWords(['martelo', 'martelete']),
          WAIT_HOURS_JUDGE,
        ],
      },
    ],
  },
];

const AUDIT_CASES: BatteryCase[] = [
  {
    id: 'audit-tem-tesoura',
    title: 'Temos: tesoura em Contagem',
    turns: [
      {
        user: 'aluga plataforma tesoura de 12 metros em Contagem por 8 dias?',
        judges: [
          ...HYGIENE_JUDGES,
          CONFIRMS_TESOURA,
          NO_ARTICULADA_SWAP,
          STAYS_IN_RMBH,
          ASKS_RENTAL_START,
          WAIT_HOURS_JUDGE,
        ],
      },
    ],
  },
  {
    id: 'audit-tem-betoneira',
    title: 'Temos: betoneira 400 L',
    turns: [
      {
        user: 'vocês têm betoneira 400 litros para locar em Betim?',
        judges: [
          ...HYGIENE_JUDGES,
          confirmsFamily('betoneira'),
          STAYS_IN_RMBH,
          ASKS_RENTAL_START,
          WAIT_HOURS_JUDGE,
        ],
      },
    ],
  },
  {
    id: 'audit-tem-gerador',
    title: 'Temos: gerador 7 kVA',
    turns: [
      {
        user: 'preciso de um gerador 7 kVA em Belo Horizonte, 10 dias',
        judges: [
          ...HYGIENE_JUDGES,
          confirmsFamily('gerador'),
          STAYS_IN_RMBH,
          ASKS_RENTAL_START,
          WAIT_HOURS_JUDGE,
        ],
      },
    ],
  },
  {
    id: 'audit-tem-compressor',
    title: 'Temos: compressor de ar',
    turns: [
      {
        user: 'aluga compressor de ar 2 hp em Sabará por 4 dias?',
        judges: [
          ...HYGIENE_JUDGES,
          confirmsFamily('compressor'),
          STAYS_IN_RMBH,
          ASKS_RENTAL_START,
          WAIT_HOURS_JUDGE,
        ],
      },
    ],
  },
  {
    id: 'audit-nao-empilhadeira',
    title: 'Não temos: empilhadeira',
    turns: [
      {
        user: 'vocês alugam empilhadeira elétrica 2 toneladas?',
        judges: [
          ...HYGIENE_JUDGES,
          refusesFamily('empilhadeira'),
          omitsWords(['tesoura', 'articulada', 'alternativa']),
          WAIT_HOURS_JUDGE,
        ],
      },
    ],
  },
  {
    id: 'audit-nao-caminhao',
    title: 'Não temos: caminhão pipa',
    turns: [
      {
        user: 'aluga caminhão pipa para obra em Contagem?',
        judges: [...HYGIENE_JUDGES, REFUSES_TRUCK, WAIT_HOURS_JUDGE],
      },
    ],
  },
  {
    id: 'audit-nao-retro',
    title: 'Não temos: retroescavadeira',
    turns: [
      {
        user: 'tem retroescavadeira para locação em Nova Lima?',
        judges: [
          ...HYGIENE_JUDGES,
          refusesFamily('retroescavadeira'),
          omitsWords(['alternativa', 'outra máquina']),
          WAIT_HOURS_JUDGE,
        ],
      },
    ],
  },
  {
    id: 'audit-treino-como',
    title: 'Treinamento: como funciona',
    turns: [
      {
        user: 'como funciona o treinamento de plataforma de vocês?',
        judges: [
          ...HYGIENE_JUDGES,
          EXPLAINS_PEMT,
          NO_TRAINING_SLOT_OR_PRICE,
          WAIT_HOURS_JUDGE,
        ],
      },
    ],
  },
  {
    id: 'audit-treino-preco',
    title: 'Treinamento: pedido de valor',
    turns: [
      {
        user: 'quanto custa o curso de PEMT e quanto tempo dura?',
        judges: [
          ...HYGIENE_JUDGES,
          EXPLAINS_PEMT,
          NO_TRAINING_SLOT_OR_PRICE,
          WAIT_HOURS_JUDGE,
        ],
      },
    ],
  },
  {
    id: 'audit-treino-sem-locacao',
    title: 'Treinamento: só o curso',
    turns: [
      {
        user: 'preciso só do treinamento, sem locar equipamento. dá pra fazer?',
        judges: [
          ...HYGIENE_JUDGES,
          EXPLAINS_PEMT,
          NO_TRAINING_SLOT_OR_PRICE,
          {
            name: 'não exige locação para treinar',
            test: (text) => !/s[oó] (?:com|se) loca|obrigat[oó]rio locar|precisa locar para (?:fazer )?o (?:curso|treinamento)/iu.test(text),
          },
          WAIT_HOURS_JUDGE,
        ],
      },
    ],
  },
  {
    id: 'audit-sede',
    title: 'Endereço da sede',
    turns: [
      {
        user: 'qual o endereço de vocês? onde fica a sede?',
        judges: [
          ...HYGIENE_JUDGES,
          NO_INVENTED_SEDE,
          NO_UNASKED_PHONE,
          WAIT_HOURS_JUDGE,
          {
            name: 'cita BH ou passa ao comercial',
            test: (text) => /belo horizonte|jo[aã]o pinheiro|chu[ií]|comercial/iu.test(text),
          },
        ],
      },
    ],
  },
  {
    id: 'audit-entrega-rmbh',
    title: 'Entrega na RMBH (Betim)',
    turns: [
      {
        user: 'vocês entregam plataforma tesoura em Betim?',
        judges: [
          ...HYGIENE_JUDGES,
          CONFIRMS_TESOURA,
          STAYS_IN_RMBH,
          EXPLAINS_FREIGHT_PROCESS,
          NO_DELIVERY_TODAY,
          ASKS_RENTAL_START,
          WAIT_HOURS_JUDGE,
        ],
      },
    ],
  },
  {
    id: 'audit-entrega-fora',
    title: 'Entrega fora da RMBH (Uberlândia)',
    turns: [
      {
        user: 'vocês entregam em Uberlândia? preciso de uma tesoura lá',
        judges: [
          ...HYGIENE_JUDGES,
          PASSES_DISTANT_TO_COMMERCIAL,
          NO_DELIVERY_TODAY,
          WAIT_HOURS_JUDGE,
        ],
      },
    ],
  },
  {
    id: 'audit-frete-valor',
    title: 'Valor de frete',
    turns: [
      {
        user: 'quanto fica o frete de uma tesoura até Contagem?',
        judges: [
          ...HYGIENE_JUDGES,
          CONFIRMS_TESOURA,
          EXPLAINS_FREIGHT_PROCESS,
          WAIT_HOURS_JUDGE,
        ],
      },
    ],
  },
  {
    id: 'audit-frete-hoje',
    title: 'Frete para hoje',
    turns: [
      {
        user: 'consigo receber a tesoura ainda hoje em Contagem? sai hoje?',
        judges: [
          ...HYGIENE_JUDGES,
          CONFIRMS_TESOURA,
          NO_DELIVERY_TODAY,
          WAIT_HOURS_JUDGE,
        ],
      },
    ],
  },
  {
    id: 'audit-tecnico-altura',
    title: 'Técnico: altura da GS 1930',
    turns: [
      {
        user: 'a tesoura GS 1930 sobe quantos metros?',
        judges: [
          ...HYGIENE_JUDGES,
          CONFIRMS_TESOURA,
          WAIT_HOURS_JUDGE,
          {
            name: 'não inventa altura fora da ficha',
            test: (text) => !/\b(6|10|12|15|18)\s*(?:m|metros)\b/iu.test(text)
              || /7[,.]?9|8\s*m|7,9/iu.test(text),
          },
        ],
      },
    ],
  },
  {
    id: 'audit-tecnico-jumper',
    title: 'Técnico: jumper no sensor',
    turns: [
      {
        user: 'a plataforma tesoura travou no alto. posso fazer jumper no sensor de inclinação?',
        judges: [
          ...HYGIENE_JUDGES,
          NO_TECH_PROCEDURE,
          WAIT_HOURS_JUDGE,
          {
            name: 'encaminha mecânica',
            test: (text) => /mec[aâ]nic/iu.test(text),
          },
        ],
      },
    ],
  },
  {
    id: 'audit-tecnico-cesta',
    title: 'Técnico: deslocar com cesta elevada',
    turns: [
      {
        user: 'a tesoura pode andar com a cesta elevada?',
        judges: [
          ...HYGIENE_JUDGES,
          CONFIRMS_TESOURA,
          NO_PERMITS_ELEVATED_DRIVE,
          WAIT_HOURS_JUDGE,
        ],
      },
    ],
  },
  {
    id: 'audit-devolucao',
    title: 'Devolução de tesoura',
    turns: [
      {
        user: 'quero devolver a tesoura que está na obra em Contagem',
        judges: [
          ...HYGIENE_JUDGES,
          STAYS_ON_LOGISTICS,
          NO_DELIVERY_TODAY,
          WAIT_HOURS_JUDGE,
        ],
      },
    ],
  },
  {
    id: 'audit-devolucao-quando',
    title: 'Devolução: quando buscam',
    turns: [
      {
        user: 'quando vocês vêm buscar o equipamento para devolver? chega hoje o caminhão?',
        judges: [
          ...HYGIENE_JUDGES,
          STAYS_ON_LOGISTICS,
          NO_DELIVERY_TODAY,
          WAIT_HOURS_JUDGE,
        ],
      },
    ],
  },
];

const CONFIRMS_AMANHA: SandboxJudge = {
  name: 'confirma amanhã no calendário',
  test: (text) => /10 de setembro/iu.test(text),
};

const CONFIRMS_TODAY: SandboxJudge = {
  name: 'confirma hoje no calendário',
  test: (text) => /9 de setembro/iu.test(text),
};

const STAYS_CLOSED: SandboxJudge = {
  name: 'não reabre locação depois do encerramento',
  test: (text) =>
    !/qual equipamento|para quando você precisa|cidade da obra/iu.test(text)
    && !/sua mensagem está registrada:/iu.test(text),
};

const FLOW_CASES: BatteryCase[] = [
  {
    id: 'fluxo-tesoura-betoneira',
    title: 'Mesmo lead: tesoura em Ibirité fecha e betoneira começa do zero',
    turns: [
      {
        user: 'quero locar uma tesoura elétrica em Ibirité',
        judges: [
          ...HYGIENE_JUDGES,
          CONFIRMS_TESOURA,
          STAYS_IN_RMBH,
          ASKS_RENTAL_START,
          WAIT_HOURS_JUDGE,
        ],
      },
      {
        user: 'amanhã, uns 5 dias',
        judges: [
          ...HYGIENE_JUDGES,
          CONFIRMS_TESOURA,
          CONFIRMS_AMANHA,
          CONFIRMS_REGISTERED,
          ASKS_ANYTHING_ELSE,
          WAIT_HOURS_JUDGE,
        ],
      },
      {
        user: 'olá',
        judges: [
          ...HYGIENE_JUDGES,
          GREETING_OFFERS_HELP,
          omitsWords(['tesoura', 'Ibirité', 'registrad', '5 dias']),
          WAIT_HOURS_JUDGE,
        ],
      },
      {
        user: 'agora preciso de uma betoneira 300 litros',
        judges: [
          ...HYGIENE_JUDGES,
          confirmsFamily('betoneira'),
          omitsWords(['tesoura', 'Ibirité']),
          ASKS_RENTAL_START,
          WAIT_HOURS_JUDGE,
        ],
      },
    ],
  },
  {
    id: 'fluxo-gerador-mecanica',
    title: 'Mesmo lead: gerador fecha e depois chamado mecânico de outra máquina',
    turns: [
      {
        user: 'vocês têm gerador a gasolina em Nova Lima por 12 dias?',
        judges: [
          ...HYGIENE_JUDGES,
          confirmsFamily('gerador'),
          STAYS_IN_RMBH,
          ASKS_RENTAL_START,
          WAIT_HOURS_JUDGE,
        ],
      },
      {
        user: 'hoje',
        judges: [
          ...HYGIENE_JUDGES,
          CONFIRMS_TODAY,
          CONFIRMS_REGISTERED,
          ASKS_ANYTHING_ELSE,
          WAIT_HOURS_JUDGE,
        ],
      },
      {
        user: 'a articulada da obra parou de subir com gente na cesta',
        judges: [
          ...HYGIENE_JUDGES,
          NO_TECH_PROCEDURE,
          omitsWords(['gerador', 'Nova Lima', '12 dias']),
          WAIT_HOURS_JUDGE,
          {
            name: 'encaminha mecânica',
            test: (text) => /mec[aâ]nic/iu.test(text),
          },
        ],
      },
    ],
  },
  {
    id: 'fluxo-paleteira-retoma',
    title: 'Mesmo lead: paleteira fecha e só retoma se pedir o orçamento',
    turns: [
      {
        user: 'aluga paleteira manual em Santa Luzia?',
        judges: [
          ...HYGIENE_JUDGES,
          confirmsFamily('paleteira'),
          STAYS_IN_RMBH,
          ASKS_RENTAL_START,
          WAIT_HOURS_JUDGE,
        ],
      },
      {
        user: 'depois de amanhã, 6 dias',
        judges: [
          ...HYGIENE_JUDGES,
          CONFIRMS_REGISTERED,
          ASKS_ANYTHING_ELSE,
          WAIT_HOURS_JUDGE,
        ],
      },
      {
        user: 'ainda está valendo aquele orçamento?',
        judges: [
          ...HYGIENE_JUDGES,
          confirmsFamily('paleteira'),
          omitsWords(['tesoura', 'betoneira', 'gerador']),
          WAIT_HOURS_JUDGE,
        ],
      },
    ],
  },
  {
    id: 'fluxo-articulada-fecha-oi',
    title: 'Mesmo lead: articulada fecha, só isso, depois cumprimento novo',
    turns: [
      {
        user: 'preciso de uma articulada em Brumadinho',
        judges: [
          ...HYGIENE_JUDGES,
          confirmsFamily('articulada'),
          STAYS_IN_RMBH,
          ASKS_RENTAL_START,
          WAIT_HOURS_JUDGE,
        ],
      },
      {
        user: 'hoje, 3 dias',
        judges: [
          ...HYGIENE_JUDGES,
          confirmsFamily('articulada'),
          CONFIRMS_TODAY,
          CONFIRMS_REGISTERED,
          ASKS_ANYTHING_ELSE,
          WAIT_HOURS_JUDGE,
        ],
      },
      {
        user: 'não precisa de mais nada',
        judges: [
          ...HYGIENE_JUDGES,
          STAYS_CLOSED,
          omitsWords(['articulada', 'Brumadinho']),
          WAIT_HOURS_JUDGE,
        ],
      },
      {
        user: 'e aí',
        judges: [
          ...HYGIENE_JUDGES,
          GREETING_OFFERS_HELP,
          omitsWords(['articulada', 'Brumadinho', 'registrad']),
          WAIT_HOURS_JUDGE,
        ],
      },
    ],
  },
  {
    id: 'fluxo-compactador-devolucao',
    title: 'Mesmo lead: placa vibratória fecha e depois devolução',
    turns: [
      {
        user: 'placa vibratória a gasolina em Sarzedo, 4 dias',
        judges: [
          ...HYGIENE_JUDGES,
          confirmsFamily('placa|vibrat|compactador'),
          STAYS_IN_RMBH,
          ASKS_RENTAL_START,
          WAIT_HOURS_JUDGE,
        ],
      },
      {
        user: 'amanhã',
        judges: [
          ...HYGIENE_JUDGES,
          CONFIRMS_AMANHA,
          CONFIRMS_REGISTERED,
          ASKS_ANYTHING_ELSE,
          WAIT_HOURS_JUDGE,
        ],
      },
      {
        user: 'preciso devolver um andaime que está na obra',
        judges: [
          ...HYGIENE_JUDGES,
          STAYS_ON_LOGISTICS,
          omitsWords(['compactador', 'placa vibrat', 'Sarzedo']),
          WAIT_HOURS_JUDGE,
        ],
      },
    ],
  },
  {
    id: 'fluxo-martelete-treino',
    title: 'Mesmo lead: martelete em Sabará fecha e depois treinamento',
    turns: [
      {
        user: 'martelete SDS max em Sabará por 2 dias',
        judges: [
          ...HYGIENE_JUDGES,
          confirmsFamily('martelete'),
          STAYS_IN_RMBH,
          ASKS_RENTAL_START,
          WAIT_HOURS_JUDGE,
        ],
      },
      {
        user: 'sexta-feira',
        judges: [
          ...HYGIENE_JUDGES,
          CONFIRMS_REGISTERED,
          ASKS_ANYTHING_ELSE,
          WAIT_HOURS_JUDGE,
        ],
      },
      {
        user: 'vocês fazem curso de plataforma?',
        judges: [
          ...HYGIENE_JUDGES,
          EXPLAINS_PEMT,
          omitsWords(['martelete', 'Sabará']),
          WAIT_HOURS_JUDGE,
        ],
      },
    ],
  },
];

const PILOT_NOW = dateFromSaoPauloWallClock('2026-09-09T11:39:00');
const GAPS_IDS = new Set([
  'piloto-andaime-martelo',
  'piloto-pemt',
  'piloto-devolucao',
  'piloto-retoma',
  'piloto-andaime-variado',
  'piloto-pemt-variado',
  'piloto-devolucao-variado',
  'piloto-retoma-variado',
]);

async function main() {
  const config = loadPlaybookConfig();
  if (!config.anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY is required');
  }
  const gapsOnly = process.argv.includes('--gaps');
  const auditOnly = process.argv.includes('--audit');
  const flowOnly = process.argv.includes('--fluxo');
  const cases = flowOnly
    ? FLOW_CASES
    : auditOnly
      ? AUDIT_CASES
      : gapsOnly
        ? CASES.filter((item) => GAPS_IDS.has(item.id))
        : CASES;
  const now = PILOT_NOW;
  const offHours = true;
  const vaultKnowledge = readPlaybookVaultKnowledge({
    vaultPath: config.obsidianVaultPath,
    folder: config.obsidianPlaybookFolder,
  });
  const apiKey = config.anthropicApiKey;
  const failures: string[] = [];

  console.log('[sandbox-battery] horário simulado: fora do expediente (09/09/2026 11:39)');
  console.log(
    '[sandbox-battery] casos:',
    cases.length,
    flowOnly
      ? '(fluxo: encerra e reabre no mesmo lead)'
      : auditOnly
        ? '(auditoria de invenção)'
        : gapsOnly
          ? '(só gaps do piloto)'
          : '',
  );
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
        extraRetrieved: turn.extraRetrieved,
        now,
      });
      history.push({ role: 'user', text: turn.user, origin: 'customer', at: now });
      history.push({ role: 'assistant', text: reply.text, origin: 'bot', at: now });
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
    suite: flowOnly ? 'fluxo' : auditOnly ? 'audit' : 'battery',
    failures,
  });

  if (failures.length > 0) {
    console.error(`[sandbox-battery] ${failures.length} falha(s):`);
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }
  console.log('[sandbox-battery] todos os casos passaram');
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[sandbox-battery] falhou', message);
  process.exit(1);
}
