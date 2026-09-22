const PHONE_PATTERN = /\+?\d[\d\s().-]{8,}\d/gu;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu;
const CNPJ_PATTERN = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/gu;

/**
 * Masks phones, emails and CNPJ so Obsidian notes do not store raw customer contacts.
 */
export function redactCustomerPii(text: string) {
  return text
    .replace(PHONE_PATTERN, (match) => {
      const digits = match.replace(/\D/gu, '');
      if (digits.length < 10) {
        return match;
      }
      return `•••${digits.slice(-4)}`;
    })
    .replace(EMAIL_PATTERN, '[e-mail omitido]')
    .replace(CNPJ_PATTERN, '[CNPJ omitido]');
}
