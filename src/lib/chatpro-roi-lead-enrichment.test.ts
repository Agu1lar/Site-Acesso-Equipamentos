import { describe, expect, it } from 'vitest';
import {
  isMissingOrSyntheticLeadEmail,
  isWhatsAppCampaignPlaceholderName,
  resolveLeadContactEnrichment,
  WHATSAPP_CAMPAIGN_PLACEHOLDER_NAME,
} from '@/lib/chatpro-roi-lead-enrichment';

describe('chatpro-roi-lead-enrichment', () => {
  it('detects placeholder name and synthetic inbound email', () => {
    expect(isWhatsAppCampaignPlaceholderName(WHATSAPP_CAMPAIGN_PLACEHOLDER_NAME)).toBe(true);
    expect(isWhatsAppCampaignPlaceholderName('João Silva')).toBe(false);
    expect(isMissingOrSyntheticLeadEmail(null)).toBe(true);
    expect(isMissingOrSyntheticLeadEmail('wa+9089973b@inbound.acessoequipamentos.com.br')).toBe(true);
    expect(isMissingOrSyntheticLeadEmail('cliente@empresa.com')).toBe(false);
  });

  it('fills name and email only when current values are empty or placeholder', () => {
    const result = resolveLeadContactEnrichment({
      currentName: WHATSAPP_CAMPAIGN_PLACEHOLDER_NAME,
      currentEmail: null,
      detectedContactName: 'Ricardo Reis',
      detectedEmail: 'ricardo@empresa.com',
    });

    expect(result).toEqual({
      name: 'Ricardo Reis',
      email: 'ricardo@empresa.com',
      shouldUpdate: true,
    });
  });

  it('does not overwrite a real name or email', () => {
    const result = resolveLeadContactEnrichment({
      currentName: 'Maria Souza',
      currentEmail: 'maria@empresa.com',
      detectedContactName: 'Outro Nome',
      detectedEmail: 'outro@empresa.com',
    });

    expect(result).toEqual({
      name: null,
      email: null,
      shouldUpdate: false,
    });
  });

  it('replaces synthetic inbound email when Claude finds a real one', () => {
    const result = resolveLeadContactEnrichment({
      currentName: 'Maria Souza',
      currentEmail: 'wa+abc@inbound.acessoequipamentos.com.br',
      detectedContactName: null,
      detectedEmail: 'maria@empresa.com',
    });

    expect(result.email).toBe('maria@empresa.com');
    expect(result.name).toBeNull();
    expect(result.shouldUpdate).toBe(true);
  });

  it('rejects invalid detected emails', () => {
    const result = resolveLeadContactEnrichment({
      currentName: WHATSAPP_CAMPAIGN_PLACEHOLDER_NAME,
      currentEmail: null,
      detectedContactName: 'Ana',
      detectedEmail: 'nao-e-email',
    });

    expect(result.name).toBe('Ana');
    expect(result.email).toBeNull();
    expect(result.shouldUpdate).toBe(true);
  });
});
