import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isChatProAudioMedia,
  transcribeChatProAudioUrl,
} from '@/lib/chatpro-audio-transcription';

describe('isChatProAudioMedia', () => {
  it('detects ptt and audio mimetypes', () => {
    expect(isChatProAudioMedia({ mediaType: 'ptt', mediaMimetype: null, mediaFilename: null, mediaUrl: null })).toBe(true);
    expect(isChatProAudioMedia({ mediaType: 'audio', mediaMimetype: 'audio/ogg', mediaFilename: null, mediaUrl: null })).toBe(true);
    expect(isChatProAudioMedia({ mediaType: null, mediaMimetype: 'audio/mpeg', mediaFilename: 'voice.mp3', mediaUrl: null })).toBe(true);
    expect(isChatProAudioMedia({ mediaType: 'document', mediaMimetype: 'application/pdf', mediaFilename: 'x.pdf', mediaUrl: null })).toBe(false);
  });
});

describe('transcribeChatProAudioUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns Whisper text for allowed ChatPro audio URL', async () => {
    const audioBytes = new Uint8Array([1, 2, 3]);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('https://cdn.chatpro.com.br/')) {
        return new Response(audioBytes, {
          status: 200,
          headers: { 'content-type': 'audio/ogg', 'content-length': String(audioBytes.byteLength) },
        });
      }
      if (url === 'https://api.openai.com/v1/audio/transcriptions') {
        expect(init?.method).toBe('POST');
        return Response.json({ text: 'Preciso de plataforma tesoura 12m' });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const text = await transcribeChatProAudioUrl(
      'https://cdn.chatpro.com.br/media/voice.ogg',
      'sk-test-openai',
    );

    expect(text).toBe('Preciso de plataforma tesoura 12m');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects disallowed audio hosts', async () => {
    await expect(
      transcribeChatProAudioUrl('https://evil.example/voice.ogg', 'sk-test-openai'),
    ).rejects.toThrow('chatpro_audio_url_not_allowed');
  });
});
