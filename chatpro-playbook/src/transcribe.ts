import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  downloadChatProAudioBuffer,
  resolveChatProAudioFilename,
} from '../../src/lib/chatpro-audio-transcription';

type TransformersPipeline = (
  input: Float32Array,
  options?: Record<string, unknown>,
) => Promise<{ text?: string; chunks?: Array<{ text?: string }> }>;

let pipelinePromise: Promise<TransformersPipeline> | null = null;

function normalizeText(result: { text?: string; chunks?: Array<{ text?: string }> }) {
  const direct = result.text?.trim();
  if (direct) {
    return direct;
  }
  const merged = result.chunks?.map((chunk) => chunk.text?.trim()).filter(Boolean).join(' ').trim();
  if (!merged) {
    throw new Error('local_whisper_empty');
  }
  return merged;
}

async function loadPipeline(model: string) {
  if (!pipelinePromise) {
    console.log('[chatpro-playbook] carregando Whisper local (primeira vez baixa o modelo)', { model });
    pipelinePromise = import('@huggingface/transformers').then(async ({ pipeline }) => {
      const loaded: unknown = await pipeline('automatic-speech-recognition', model);
      return loaded as TransformersPipeline;
    });
  }
  return pipelinePromise;
}

async function decodeToFloat32(audioPath: string) {
  const ffmpegPath = (await import('ffmpeg-static')).default;
  if (!ffmpegPath) {
    throw new Error('ffmpeg_static_missing');
  }

  return new Promise<Float32Array>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const child = spawn(
      ffmpegPath,
      ['-i', audioPath, '-ar', '16000', '-ac', '1', '-f', 'f32le', 'pipe:1'],
      { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
    );
    child.stdout.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    child.stderr.resume();
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg_decode_failed:${code ?? 'unknown'}`));
        return;
      }
      const merged = Buffer.concat(chunks);
      if (merged.byteLength === 0) {
        reject(new Error('ffmpeg_decode_empty'));
        return;
      }
      resolve(new Float32Array(merged.buffer, merged.byteOffset, merged.byteLength / 4));
    });
  });
}

/**
 * Transcribes a ChatPro audio URL with local Whisper. Does not send WhatsApp.
 */
export async function transcribePlaybookAudio(options: {
  mediaUrl: string;
  allowedHostSuffixes?: string[];
  model: string;
}) {
  const { buffer, mimetype } = await downloadChatProAudioBuffer(
    options.mediaUrl,
    options.allowedHostSuffixes ?? [],
  );
  const tempDir = await mkdtemp(join(tmpdir(), 'playbook-audio-'));
  const audioPath = join(tempDir, resolveChatProAudioFilename(mimetype, null));
  try {
    await writeFile(audioPath, buffer);
    const transcriber = await loadPipeline(options.model);
    const samples = await decodeToFloat32(audioPath);
    const result = await transcriber(samples, {
      language: 'portuguese',
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    return normalizeText(result);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
