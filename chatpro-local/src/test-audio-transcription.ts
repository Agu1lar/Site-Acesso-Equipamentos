import { isChatProAudioMedia } from '../../src/lib/chatpro-audio-transcription.ts';
import { enrichMessagesWithAudioTranscriptions } from '../../src/lib/chatpro-roi-ai-core.ts';
import { ChatProRemoteApi } from './api-client.js';
import { loadLocalConfig } from './config.js';
import { createLocalAudioTranscriber } from './whisper-local.js';
import { logWorkerError } from './diagnostics.js';

/**
 * Transcribes audio messages for one lead using local Whisper (dry-run for Claude).
 */
async function main() {
  const leadId = Number(process.argv[2] ?? 91);
  const config = loadLocalConfig();
  if (config.localWhisperMode === 'off') {
    throw new Error('Set CHATPRO_LOCAL_WHISPER=transformers (or cli) in chatpro-local/.env');
  }

  const api = new ChatProRemoteApi(config.apiBaseUrl, config.internalApiSecret);
  const context = await api.fetchLeadContext(leadId);
  const audioMessages = context.messages.filter(
    (message) => message.mediaUrl && isChatProAudioMedia(message) && !message.messageText?.trim(),
  );

  console.info('[chatpro-local] audio transcription test', {
    leadId,
    leadName: context.lead.name,
    totalMessages: context.messages.length,
    audioWithoutText: audioMessages.length,
    whisperMode: config.localWhisperMode,
    whisperModel: config.localWhisperModel,
  });

  if (audioMessages.length === 0) {
    console.info('[chatpro-local] no audio messages without text for this lead');
    return;
  }

  const transcriber = createLocalAudioTranscriber(config);
  if (!transcriber) {
    throw new Error('local_whisper_not_configured');
  }

  const sample = audioMessages.find((message) => !message.fromMe) ?? audioMessages[0]!;
  console.info('[chatpro-local] transcribing sample message', {
    messageId: sample.id,
    fromMe: sample.fromMe,
    mediaType: sample.mediaType,
    mediaUrl: sample.mediaUrl,
  });

  const startedAt = Date.now();
  const transcription = await transcriber({
    mediaUrl: sample.mediaUrl!,
    mediaMimetype: sample.mediaMimetype,
    mediaFilename: sample.mediaFilename,
  });
  console.info('[chatpro-local] transcription result', {
    messageId: sample.id,
    elapsedMs: Date.now() - startedAt,
    chars: transcription.length,
    text: transcription,
  });

  const enriched = await enrichMessagesWithAudioTranscriptions(context.messages, {
    apiKey: config.anthropicApiKey ?? 'dry-run',
    model: config.anthropicModel,
    pdfAllowedHostSuffixes: config.pdfAllowedHostSuffixes,
    transcribeAudio: transcriber,
  });

  const enrichedAudioCount = enriched.filter(
    (message) => message.mediaUrl && isChatProAudioMedia(message) && message.messageText?.trim(),
  ).length;

  console.info('[chatpro-local] enriched thread preview', {
    audioWithTextAfterEnrich: enrichedAudioCount,
    sampleLines: enriched
      .filter((message) => isChatProAudioMedia(message))
      .slice(0, 3)
      .map((message) => ({
        id: message.id,
        fromMe: message.fromMe,
        text: message.messageText?.slice(0, 120) ?? '(sem texto)',
      })),
  });
}

try {
  await main();
} catch (error) {
  logWorkerError('teste de transcrição local', error);
  process.exit(1);
}
