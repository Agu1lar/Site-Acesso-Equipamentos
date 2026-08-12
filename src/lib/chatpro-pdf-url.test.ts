import { describe, expect, it } from 'vitest';
import { isAllowedPdfFetchUrl, isPrivateOrLocalHost } from '@/lib/chatpro-pdf-url';

describe('isPrivateOrLocalHost', () => {
  it('blocks localhost and private IPv4 ranges', () => {
    expect(isPrivateOrLocalHost('localhost')).toBe(true);
    expect(isPrivateOrLocalHost('127.0.0.1')).toBe(true);
    expect(isPrivateOrLocalHost('10.0.0.5')).toBe(true);
    expect(isPrivateOrLocalHost('192.168.1.10')).toBe(true);
    expect(isPrivateOrLocalHost('169.254.169.254')).toBe(true);
  });

  it('allows public hostnames', () => {
    expect(isPrivateOrLocalHost('files.chatpro.com.br')).toBe(false);
  });
});

describe('isAllowedPdfFetchUrl', () => {
  it('allows HTTPS URLs on ChatPro hosts', () => {
    expect(isAllowedPdfFetchUrl('https://cdn.chatpro.com.br/media/contrato.pdf')).toBe(true);
  });

  it('blocks HTTP and private targets', () => {
    expect(isAllowedPdfFetchUrl('http://cdn.chatpro.com.br/a.pdf')).toBe(false);
    expect(isAllowedPdfFetchUrl('https://127.0.0.1/a.pdf')).toBe(false);
    expect(isAllowedPdfFetchUrl('https://169.254.169.254/latest/meta-data')).toBe(false);
  });

  it('honors extra host suffixes from env', () => {
    expect(isAllowedPdfFetchUrl('https://storage.example.com/doc.pdf')).toBe(false);
    expect(
      isAllowedPdfFetchUrl('https://storage.example.com/doc.pdf', ['storage.example.com']),
    ).toBe(true);
  });
});
