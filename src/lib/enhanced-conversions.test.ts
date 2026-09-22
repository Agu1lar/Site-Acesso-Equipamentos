import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ENHANCED_CONVERSION_USER_SESSION_KEY,
  buildHashedUserData,
  buildStoredEnhancedConversionUser,
  clearEnhancedConversionUser,
  emailFromGoogleCredentialJwt,
  mergeEnhancedConversionUsers,
  normalizeEnhancedConversionEmail,
  normalizeEnhancedConversionName,
  normalizeEnhancedConversionPhone,
  readEnhancedConversionUser,
  sha256Hex,
  storeEnhancedConversionUser,
} from '@/lib/enhanced-conversions';

function installSessionStorage() {
  const session = new Map<string, string>();
  vi.stubGlobal('window', {
    sessionStorage: {
      getItem: (key: string) => session.get(key) ?? null,
      setItem: (key: string, value: string) => {
        session.set(key, value);
      },
      removeItem: (key: string) => {
        session.delete(key);
      },
      clear: () => {
        session.clear();
      },
    },
  });
  return session;
}

describe('enhanced conversions', () => {
  beforeEach(() => {
    installSessionStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes email to trimmed lowercase', () => {
    expect(normalizeEnhancedConversionEmail('  User@Example.COM ')).toBe('user@example.com');
  });

  it('formats Brazilian phones as E.164', () => {
    expect(normalizeEnhancedConversionPhone('(11) 98888-7777')).toBe('+5511988887777');
    expect(normalizeEnhancedConversionPhone('5511988887777')).toBe('+5511988887777');
    expect(normalizeEnhancedConversionPhone('11988887777')).toBe('+5511988887777');
    expect(normalizeEnhancedConversionPhone('123')).toBeNull();
  });

  it('splits and normalizes names for address hashing', () => {
    expect(normalizeEnhancedConversionName('  João da Silva ')).toEqual({
      firstName: 'joao',
      lastName: 'da silva',
    });
    expect(normalizeEnhancedConversionName('Maria')).toEqual({
      firstName: 'maria',
      lastName: undefined,
    });
  });

  it('requires email or phone before storing', () => {
    expect(buildStoredEnhancedConversionUser({ name: 'Só Nome' })).toBeNull();
    expect(
      buildStoredEnhancedConversionUser({
        email: 'a@b.com',
        phone: '11988887777',
        name: 'Ana Souza',
      }),
    ).toEqual({
      email: 'a@b.com',
      phone: '+5511988887777',
      firstName: 'ana',
      lastName: 'souza',
    });
  });

  it('merges partial identifiers across captures', () => {
    expect(
      mergeEnhancedConversionUsers(
        { email: 'a@b.com', firstName: 'ana' },
        { phone: '+5511988887777', lastName: 'souza' },
      ),
    ).toEqual({
      email: 'a@b.com',
      phone: '+5511988887777',
      firstName: 'ana',
      lastName: 'souza',
    });
  });

  it('stores and reads the session Enhanced Conversion user', () => {
    storeEnhancedConversionUser({ email: 'Lead@Acesso.com' });
    storeEnhancedConversionUser({ phone: '11988887777' });

    expect(readEnhancedConversionUser()).toEqual({
      email: 'lead@acesso.com',
      phone: '+5511988887777',
    });
    expect(window.sessionStorage.getItem(ENHANCED_CONVERSION_USER_SESSION_KEY)).toContain(
      'lead@acesso.com',
    );

    clearEnhancedConversionUser();
    expect(readEnhancedConversionUser()).toBeNull();
  });

  it('hashes normalized values with SHA-256 hex', async () => {
    const hash = await sha256Hex('user@example.com');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(await sha256Hex('user@example.com'));

    const userData = await buildHashedUserData({
      email: 'user@example.com',
      phone: '+5511988887777',
      firstName: 'ana',
      lastName: 'souza',
    });

    expect(userData).toEqual({
      email: await sha256Hex('user@example.com'),
      phone_number: await sha256Hex('+5511988887777'),
      address: {
        first_name: await sha256Hex('ana'),
        last_name: await sha256Hex('souza'),
      },
    });
  });

  it('extracts email from a Google credential JWT payload', () => {
    const payload = Buffer.from(
      JSON.stringify({ email: 'OneTap@Example.com', sub: '123' }),
      'utf8',
    ).toString('base64url');
    const credential = `header.${payload}.sig`;

    expect(emailFromGoogleCredentialJwt(credential)).toBe('onetap@example.com');
    expect(emailFromGoogleCredentialJwt('not-a-jwt')).toBeNull();
  });
});
