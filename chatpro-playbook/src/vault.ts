import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AttendanceTeam } from './attendance-team.js';
import { listOperationalModules } from './operational-modules.js';
import {
  playbookHardRules,
  stripUnofficialQuotes,
  type CommercialPlaybook,
} from './schema.js';
import {
  formatCapturedEstimateBlock,
  matchCapturedEstimates,
  parseCapturedValueNotes,
  shouldRetrieveCapturedEstimate,
} from './captured-estimates.js';

function todayStamp(now: Date) {
  return now.toISOString().slice(0, 10);
}

function teamKind(team: AttendanceTeam) {
  return team;
}

function teamTitle(team: AttendanceTeam) {
  if (team === 'logistica') {
    return 'Atendimento logística';
  }
  if (team === 'mecanica') {
    return 'Atendimento mecânica';
  }
  return 'Atendimento comercial';
}

function frontmatter(title: string, now: Date, team: AttendanceTeam) {
  return [
    '---',
    `title: ${title}`,
    `tipo: playbook-${teamKind(team)}`,
    `equipe: ${teamKind(team)}`,
    `gerado: ${now.toISOString()}`,
    'fonte: chatpro-playbook',
    'regra: nunca-confirmar-preco-nem-frete',
    '---',
    '',
  ].join('\n');
}

function renderIndex(playbook: CommercialPlaybook, now: Date, team: AttendanceTeam) {
  return [
    frontmatter(teamTitle(team), now, team),
    `# ${teamTitle(team)}`,
    '',
    team === 'logistica'
      ? 'Notas da equipe de **logística** (troca, devolução, programação). A IA **não confirma preço nem frete**.'
      : team === 'mecanica'
        ? 'Notas da **mecânica** (plataformas, andaimes, ferramentas elétricas e a combustão). A IA **não inventa diagnóstico**.'
        : 'Notas da equipe **comercial** (locação e orçamento). A IA **não confirma preço nem frete**.',
    '',
    '- [[Inbox recente]] — últimas conversas lidas da ChatPro (o worker atualiza).',
    '- [[Follow-up]] — só os contatos que o bot pode reabrir.',
    '- [[Como atendemos]]',
    '- [[Exemplos de atendimento]] — casos reais para a equipe; o bot não lê este arquivo.',
    '- [[Negocio e tom]]',
    '- [[Valores captados]] — diária, período e frete citados (não oficial).',
    '- [[Oportunidades]] — pipeline interno: o que pode fechar e o próximo passo.',
    '- [[Aprendizado da triagem]] — acerto e erro do bot; o comercial não mistura aqui.',
    '- [[Lacunas e tratamentos]]',
    '- [[Melhorias proximos 7 dias]]',
    '- [[Heuristicas observadas]] — hábitos da equipe; não são regra de segurança.',
    '- [[Modulos/Indice|Módulos operacionais]] — a IA cria, edita e apaga conforme o treino.',
    '- [[Notas humanas]] — edite só este arquivo; o worker não sobrescreve. Vence o playbook gerado.',
    '',
    playbook.businessSummary,
    '',
  ].join('\n');
}

function renderMethods(playbook: CommercialPlaybook, now: Date, team: AttendanceTeam) {
  const blocks = playbook.methods.map((method) => [
    `## ${method.name}`,
    '',
    method.whenToUse,
    '',
    ...method.steps.map((step) => `- ${step}`),
    '',
    `Exemplo parafraseado: ${method.paraphraseExample}`,
    '',
  ].join('\n'));

  return [
    frontmatter('Como atendemos', now, team),
    '# Como atendemos',
    '',
    'Métodos observados nas conversas reais. Negociação humanizada: ouvir, qualificar, não cravar preço nem frete.',
    '',
    ...blocks,
  ].join('\n');
}

function renderBusiness(playbook: CommercialPlaybook, now: Date, team: AttendanceTeam) {
  return [
    frontmatter('Negócio e tom', now, team),
    '# Negócio e tom',
    '',
    '## O que o negócio parece ser nestas conversas',
    '',
    playbook.businessSummary,
    '',
    '## Forma de trabalhar',
    '',
    playbook.workingStyle,
    '',
    '## Tom',
    '',
    playbook.toneNotes,
    '',
  ].join('\n');
}

function renderCaseNotes(playbook: CommercialPlaybook, now: Date, team: AttendanceTeam) {
  const blocks = playbook.caseNotes.map((note) => [
    `## ${note.problemType}`,
    '',
    `**Situação:** ${note.situation}`,
    '',
    `**O que a equipe fez:** ${note.teamMove}`,
    '',
    `**Resultado:** ${note.outcome}`,
    '',
    `**Como atender melhor:** ${note.humanizedTip}`,
    '',
  ].join('\n'));

  return [
    frontmatter('Exemplos de atendimento', now, team),
    '# Exemplos de atendimento',
    '',
    'Casos reais do inbox (anônimos), só para a equipe. O bot de atendimento **não** lê este arquivo.',
    '',
    ...blocks,
  ].join('\n');
}

function renderValues(playbook: CommercialPlaybook, now: Date, team: AttendanceTeam) {
  const rows = playbook.capturedValues.length === 0
    ? ['Nenhum valor de locação, período ou frete foi citado com segurança nas conversas lidas.']
    : playbook.capturedValues.map((value) => [
      `## ${value.equipment}`,
      '',
      `Cliente (anonimizado): ${value.customerHint}`,
      '',
      `Período citado: ${value.rentalDays}`,
      '',
      value.mentionedAs,
      '',
      `Frete citado: ${value.freightMention}`,
      '',
      value.conversationHint,
      '',
      '**Não oficial. Não repetir ao cliente como tabela.**',
      '',
    ].join('\n'));

  return [
    frontmatter('Valores captados', now, team),
    '# Valores captados',
    '',
    'Preço, dias de locação e frete **só se alguém citou na conversa**. A IA nunca confirma estes números ao cliente. Serve para o comercial ver o que já foi falado.',
    '',
    ...rows,
  ].join('\n');
}

const OPPORTUNITY_STAGE_LABEL: Record<string, string> = {
  quente: 'Quente',
  negociacao: 'Em negociação',
  proposta: 'Proposta',
  'em-risco': 'Em risco',
  qualificacao: 'Qualificação',
  fria: 'Fria',
  fechada: 'Fechada',
  perdida: 'Perdida',
};

function renderOpportunities(playbook: CommercialPlaybook, now: Date, team: AttendanceTeam) {
  const rows = playbook.opportunities.length === 0
    ? ['Nenhuma oportunidade clara neste recorte. Qualifique cidade, equipamento e prazo para aparecer aqui.']
    : playbook.opportunities.map((item) => [
      `## ${OPPORTUNITY_STAGE_LABEL[item.stage] ?? item.stage} — ${item.title}`,
      '',
      `Cliente: ${item.customerHint}`,
      '',
      `- Equipamento: ${item.equipment}`,
      `- Dias / período: ${item.rentalDays}`,
      `- Preço citado: ${item.priceMention} (não oficial)`,
      `- Frete citado: ${item.freightMention} (não oficial)`,
      `- Próximo passo: ${item.nextMove}`,
      `- Por que importa: ${item.whyItMatters}`,
      '',
    ].join('\n'));

  return [
    frontmatter('Oportunidades', now, team),
    '# Oportunidades',
    '',
    'Vista interna do que pode avançar. **Não enviar esta lista ao cliente.** Preço e frete aqui são menção de conversa, não tabela.',
    '',
    ...rows,
  ].join('\n');
}

function renderGaps(playbook: CommercialPlaybook, now: Date, team: AttendanceTeam) {
  const blocks = playbook.gaps.map((gap) => [
    `## ${gap.topic}`,
    '',
    gap.whyMissing,
    '',
    `Tratamento: ${gap.treatment}`,
    '',
  ].join('\n'));

  return [
    frontmatter('Lacunas e tratamentos', now, team),
    '# Lacunas e tratamentos',
    '',
    'O que as conversas não deixam seguro. Padrão: não inventar, confirmar com o comercial e retornar.',
    '',
    ...blocks,
  ].join('\n');
}

function renderImprovements(playbook: CommercialPlaybook, now: Date, team: AttendanceTeam) {
  const blocks = [...playbook.improvements7days]
    .sort((left, right) => left.dayOffset - right.dayOffset)
    .map((item) => {
      const day = new Date(now);
      day.setDate(day.getDate() + item.dayOffset - 1);
      return [
        `## Dia ${item.dayOffset} — ${day.toISOString().slice(0, 10)}`,
        '',
        item.action,
        '',
        item.why,
        '',
      ].join('\n');
    });

  return [
    frontmatter('Melhorias próximos 7 dias', now, team),
    '# Melhorias próximos 7 dias',
    '',
    'Plano curto a partir dos atendimentos lidos. Ajuste em [[Notas humanas]] se algo não couber na operação.',
    '',
    ...blocks,
  ].join('\n');
}

function renderRules(now: Date, team: AttendanceTeam) {
  return [
    frontmatter('Regras da IA', now, team),
    '# Regras da IA',
    '',
    'Estas regras vêm do código. O treino não as altera.',
    '',
    ...playbookHardRules().map((rule) => `- ${rule}`),
    '',
  ].join('\n');
}

function renderHeuristics(playbook: CommercialPlaybook, now: Date, team: AttendanceTeam) {
  const lines = playbook.observedHeuristics.length === 0
    ? ['Nenhuma heurística observada neste recorte.']
    : playbook.observedHeuristics.map((rule) => `- ${rule}`);
  return [
    frontmatter('Heurísticas observadas', now, team),
    '# Heurísticas observadas',
    '',
    'Hábitos da equipe vistos nas conversas. **Não** são regra de segurança. [[Notas humanas]] e as regras de código vencem isto.',
    '',
    ...lines,
    '',
  ].join('\n');
}

function humanNotesStub(now: Date, team: AttendanceTeam) {
  return [
    frontmatter('Notas humanas', now, team),
    '# Notas humanas',
    '',
    'Escreva aqui correções do playbook gerado. O worker **não** sobrescreve este arquivo depois da primeira criação.',
    '',
  ].join('\n');
}

function writeUnlessExists(path: string, body: string) {
  if (existsSync(path)) {
    return false;
  }
  writeFileSync(path, body, 'utf8');
  return true;
}

export type VaultWriteResult = {
  folder: string;
  files: string[];
};

/**
 * Writes generated playbook notes into the Obsidian vault.
 * Leaves `Notas humanas.md` untouched when it already exists.
 */
export function writePlaybookVault(options: {
  vaultPath: string;
  folder: string;
  playbook: CommercialPlaybook;
  team?: AttendanceTeam;
  now?: Date;
}): VaultWriteResult {
  const now = options.now ?? new Date();
  const team = options.team ?? 'comercial';
  const folder = join(options.vaultPath, ...options.folder.split(/[\\/]/u));
  mkdirSync(folder, { recursive: true });

  const generated: Array<{ name: string; body: string }> = [
    { name: 'Indice.md', body: renderIndex(options.playbook, now, team) },
    { name: 'Como atendemos.md', body: renderMethods(options.playbook, now, team) },
    { name: 'Exemplos de atendimento.md', body: renderCaseNotes(options.playbook, now, team) },
    { name: 'Negocio e tom.md', body: renderBusiness(options.playbook, now, team) },
    { name: 'Valores captados.md', body: renderValues(options.playbook, now, team) },
    { name: 'Oportunidades.md', body: renderOpportunities(options.playbook, now, team) },
    { name: 'Lacunas e tratamentos.md', body: renderGaps(options.playbook, now, team) },
    { name: 'Melhorias proximos 7 dias.md', body: renderImprovements(options.playbook, now, team) },
    { name: 'Regras da IA.md', body: renderRules(now, team) },
    { name: 'Heuristicas observadas.md', body: renderHeuristics(options.playbook, now, team) },
  ];

  const written: string[] = [];
  for (const file of generated) {
    writeFileSync(join(folder, file.name), file.body, 'utf8');
    written.push(file.name);
  }

  if (writeUnlessExists(join(folder, 'Notas humanas.md'), humanNotesStub(now, team))) {
    written.push('Notas humanas.md');
  }

  const metaName = `_meta-${todayStamp(now)}.md`;
  writeFileSync(
    join(folder, metaName),
    [
      frontmatter('Meta da geração', now, team),
      `# Meta ${todayStamp(now)}`,
      '',
      `Métodos: ${options.playbook.methods.length}. Valores captados: ${options.playbook.capturedValues.length}. Oportunidades: ${options.playbook.opportunities.length}. Lacunas: ${options.playbook.gaps.length}.`,
      '',
    ].join('\n'),
    'utf8',
  );
  written.push(metaName);

  return { folder, files: written };
}

/**
 * Writes the company index that splits comercial and logística.
 */
export function writeCompanyIndex(options: {
  vaultPath: string;
  companyFolder: string;
  now?: Date;
}) {
  const now = options.now ?? new Date();
  const folder = join(options.vaultPath, ...options.companyFolder.split(/[\\/]/u));
  mkdirSync(folder, { recursive: true });
  const path = join(folder, 'Indice.md');
  writeFileSync(
    path,
    [
      '---',
      'title: Acesso Equipamentos',
      'tipo: indice-empresa',
      `gerado: ${now.toISOString()}`,
      'fonte: chatpro-playbook',
      '---',
      '',
      '# Acesso Equipamentos',
      '',
      'O WhatsApp é o mesmo. As notas ficam **separadas por equipe**.',
      '',
      '- [[Comercial/Indice|Comercial]] — locação, orçamento, propostas.',
      '- [[Logistica/Indice|Logística]] — troca, devolução, programação de coleta.',
      '- [[Mecanica/Indice|Mecânica]] — chamado, plataformas, andaimes, ferramentas.',
      '',
      'Financeiro entra na pasta Comercial com rótulo e **não** treina o playbook de locação.',
      'A mecânica tem `Conhecimento/` e `Manuais/`: o bot **busca** nessas notas quando o assunto for defeito ou operação.',
      'Em `Modulos/` a IA **cria, edita e apaga** o que o treino (conversas reais) mostrar como fluxo vivo. `Notas humanas` e `Manuais/` ficam da equipe.',
      '',
    ].join('\n'),
    'utf8',
  );
  return path;
}

/**
 * Writes a team index when Haiku has not produced one yet.
 */
export function ensureTeamIndex(options: {
  vaultPath: string;
  folder: string;
  team: AttendanceTeam;
  now?: Date;
}) {
  const now = options.now ?? new Date();
  const folder = join(options.vaultPath, ...options.folder.split(/[\\/]/u));
  mkdirSync(folder, { recursive: true });
  const path = join(folder, 'Indice.md');
  if (existsSync(path)) {
    return path;
  }
  writeUnlessExists(join(folder, 'Notas humanas.md'), humanNotesStub(now, options.team));
  writeFileSync(
    path,
    [
      frontmatter(teamTitle(options.team), now, options.team),
      `# ${teamTitle(options.team)}`,
      '',
      options.team === 'logistica'
        ? 'Pasta da logística. O playbook entra quando houver conversas suficientes de troca e devolução.'
        : options.team === 'mecanica'
          ? 'Pasta da mecânica. Conhecimento das linhas e manuais em [[Conhecimento/Linhas de equipamento]] e [[Manuais/Como usar esta pasta]].'
          : 'Pasta do comercial. O playbook entra na próxima geração Haiku.',
      '',
      '- [[Inbox recente]]',
      '- [[Follow-up]]',
      '- [[Notas humanas]]',
      '',
    ].join('\n'),
    'utf8',
  );
  return path;
}

const HUMAN_NOTES_FILE = 'Notas humanas.md';
const HUMAN_NOTES_CHARS = 4_000;
const GENERATED_FILE_CHARS = 2_400;
const GENERATED_KNOWLEDGE_FILES = [
  'Aprendizado da triagem.md',
  'Como atendemos.md',
  'Negocio e tom.md',
  'Lacunas e tratamentos.md',
];

function readVaultMarkdown(folder: string, name: string) {
  const path = join(folder, name);
  if (!existsSync(path)) {
    return '';
  }
  return readFileSync(path, 'utf8').trim();
}

function formatCodeHardRules() {
  return [
    '## Regras da IA',
    'Estas regras são fixas no código e vencem o playbook gerado.',
    ...playbookHardRules().map((rule) => `- ${rule}`),
  ].join('\n');
}

function formatHumanNotes(body: string, maxChars: number) {
  if (!body) {
    return '';
  }
  return `## ${HUMAN_NOTES_FILE}\nA nota humana vence o playbook gerado.\n${body.slice(0, maxChars)}`;
}

/**
 * Reads playbook notes for the sandbox attendance chat. Human notes come first and always fit.
 */
export function readPlaybookVaultKnowledge(options: {
  vaultPath: string;
  folder: string;
  maxChars?: number;
}) {
  const folder = join(options.vaultPath, ...options.folder.split(/[\\/]/u));
  const maxChars = options.maxChars ?? 12_000;
  const chunks: string[] = [];
  let used = 0;

  const push = (chunk: string) => {
    if (!chunk) {
      return;
    }
    const remaining = maxChars - used;
    if (remaining < 80) {
      return;
    }
    const slice = chunk.length > remaining ? chunk.slice(0, remaining) : chunk;
    chunks.push(slice);
    used += slice.length;
  };

  const humanCap = Math.min(HUMAN_NOTES_CHARS, Math.max(800, Math.floor(maxChars * 0.4)));
  push(formatHumanNotes(readVaultMarkdown(folder, HUMAN_NOTES_FILE), humanCap));
  push(formatCodeHardRules());

  for (const name of GENERATED_KNOWLEDGE_FILES) {
    const remaining = maxChars - used;
    if (remaining < 80) {
      continue;
    }
    const body = stripUnofficialQuotes(readVaultMarkdown(folder, name));
    if (!body) {
      continue;
    }
    const chunk = `## ${name}\n${body.slice(0, Math.min(GENERATED_FILE_CHARS, remaining))}`;
    if (used + chunk.length > maxChars) {
      continue;
    }
    chunks.push(chunk);
    used += chunk.length;
  }

  return chunks.join('\n\n');
}

/**
 * Current methods, tone and modules so the next Haiku run updates instead of starting from zero.
 */
export function readPriorPlaybookContext(options: {
  vaultPath: string;
  folder: string;
  maxChars?: number;
}) {
  const maxChars = options.maxChars ?? 8_000;
  const knowledge = readPlaybookVaultKnowledge({
    vaultPath: options.vaultPath,
    folder: options.folder,
    maxChars: Math.floor(maxChars * 0.7),
  });
  const chunks = [
    'A nota humana vence o playbook gerado. Não reescreva contra ela.',
    knowledge,
  ];
  const modules = listOperationalModules({
    vaultPath: options.vaultPath,
    folder: options.folder,
  }).filter((module) => !module.protected);
  if (modules.length > 0) {
    const lines = modules.map((module) => {
      const excerpt = module.body.replace(/^---[\s\S]*?---\s*/u, '').replace(/\s+/gu, ' ').trim().slice(0, 220);
      return `- ${module.id} | ${module.title} | ${excerpt}`;
    });
    chunks.push(`## Modulos vivos\n${lines.join('\n')}`);
  }
  return chunks.filter(Boolean).join('\n\n').slice(0, maxChars);
}

/**
 * Unofficial rental faixa for the same type and period, if one was captured. Never includes freight.
 */
export function readCapturedEstimateBlock(options: {
  vaultPath: string;
  folder: string;
  userTurns: string[];
}) {
  if (!shouldRetrieveCapturedEstimate(options.userTurns)) {
    return '';
  }
  const folder = join(options.vaultPath, ...options.folder.split(/[\\/]/u));
  const markdown = readVaultMarkdown(folder, 'Valores captados.md');
  if (!markdown) {
    return '';
  }
  return formatCapturedEstimateBlock(
    matchCapturedEstimates({
      rows: parseCapturedValueNotes(markdown),
      userTurns: options.userTurns,
    }),
  );
}
