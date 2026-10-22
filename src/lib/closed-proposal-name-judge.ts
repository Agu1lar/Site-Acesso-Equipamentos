import { Env } from '@/libs/Env';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const NAME_JUDGE_SYSTEM = [
  'A linha Conversa é o nome de exibição do WhatsApp, a linha Empresa é o nome da empresa e a linha Contatos lista os nomes dos contatos.',
  'Compare o nome de exibição do WhatsApp com o nome da empresa e os nomes dos contatos.',
  'O nome do WhatsApp muitas vezes é a empresa, um nome fantasia ou uma abreviação, e não o nome da pessoa.',
  'Responda com uma linha apenas: same_account quando for a mesma empresa ou a mesma pessoa.',
  'Responda insufficient quando for só um primeiro nome em comum, ou quando não der para saber.',
].join(' ');

type AnthropicTextResponse = {
  content?: Array<{ type?: string; text?: string }>;
};

/**
 * Classifies the first non-empty line of a name judgement.
 * @param text Assistant reply to classify.
 * @returns The token same_account when that line matches exactly, otherwise insufficient.
 */
export function parseNameJudgement(text: string): 'same_account' | 'insufficient' {
  const line = text
    .split(/\r?\n/u)
    .map((part) => part.trim())
    .find((part) => part.length > 0);

  if (line?.toLowerCase() === 'same_account') {
    return 'same_account';
  }

  return 'insufficient';
}

function blankNames(input: {
  companyName: string;
  contactNames: string[];
  attendanceName: string;
}) {
  const companyName = input.companyName.trim();
  const attendanceName = input.attendanceName.trim();
  const contactNames = input.contactNames
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  return {
    companyName,
    attendanceName,
    contactNames,
    skip: attendanceName.length === 0 || (companyName.length === 0 && contactNames.length === 0),
  };
}

function assistantText(payload: AnthropicTextResponse) {
  return payload.content?.find((block) => block.type === 'text')?.text ?? '';
}

/**
 * Judges whether the WhatsApp name matches the closed proposal account.
 * @param input Company name, contact names, and WhatsApp display name.
 * @returns The token same_account when the model confirms the match, otherwise insufficient.
 */
export async function judgeClosedProposalName(input: {
  companyName: string;
  contactNames: string[];
  attendanceName: string;
}): Promise<'same_account' | 'insufficient'> {
  const names = blankNames(input);
  if (names.skip) {
    return 'insufficient';
  }

  const apiKey = Env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return 'insufficient';
  }

  const userText = [
    `Conversa: ${names.attendanceName}`,
    `Empresa: ${names.companyName}`,
    `Contatos: ${names.contactNames.join('; ')}`,
  ].join('\n');

  try {
    const response = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: 'POST',
      headers: {
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: Env.ANTHROPIC_MODEL,
        max_tokens: 20,
        system: NAME_JUDGE_SYSTEM,
        messages: [{ role: 'user', content: userText }],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      return 'insufficient';
    }

    const payload = (await response.json()) as AnthropicTextResponse;
    return parseNameJudgement(assistantText(payload));
  } catch {
    return 'insufficient';
  }
}
