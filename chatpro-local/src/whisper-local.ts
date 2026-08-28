import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  downloadChatProAudioBuffer,
  resolveChatProAudioFilename,
  type ChatProAudioTranscriptionInput,
} from '../../src/lib/chatpro-audio-transcription.ts';
import type { ChatProAudioTranscriber } from '../../src/lib/chatpro-roi-ai-core.ts';
import type { LocalConfig } from './config.js';

type TransformersPipeline = (
  input: string,
  options?: Record<string, unknown>,
) => Promise<{ text?: string; chunks?: Array<{ text?: string }> }>;

let transformersPipelinePromise: Promise<TransformersPipeline> | null = null;

function normalizeTranscriptionText(result: { text?: string; chunks?: Array<{ text?: string }> }) {
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

async function writeTempAudioFile(
  buffer: Buffer,
  mimetype: string | null,
  mediaFilename: string | null,
) {
  const tempDir = await mkdtemp(join(tmpdir(), 'chatpro-audio-'));
  const filename = resolveChatProAudioFilename(mimetype, mediaFilename);
  const audioPath = join(tempDir, filename);
  await writeFile(audioPath, buffer);
  return { tempDir, audioPath };
}

async function loadTransformersPipeline(model: string) {
  if (!transformersPipelinePromise) {
    console.info('[chatpro-local] loading local Whisper model (first run may download files)', { model });
    transformersPipelinePromise = import('@huggingface/transformers').then(({ pipeline }) =>
      pipeline('automatic-speech-recognition', model),
    );
  }
  return transformersPipelinePromise;
}

async function decodeAudioToFloat32(audioPath: string, samplingRate = 16_000) {
  const ffmpegPath = (await import('ffmpeg-static')).default;
  if (!ffmpegPath) {
    throw new Error('ffmpeg_static_missing');
  }

  return new Promise<Float32Array>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const child = spawn(
      ffmpegPath,
      ['-i', audioPath, '-ar', String(samplingRate), '-ac', '1', '-f', 'f32le', 'pipe:1'],
      { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
    );

    child.stdout.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    child.stderr.on('data', () => {
      // ffmpeg progress logs go to stderr
    });
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

async function transcribeWithTransformers(
  buffer: Buffer,
  mimetype: string | null,
  mediaFilename: string | null,
  model: string,
) {
  const { tempDir, audioPath } = await writeTempAudioFile(buffer, mimetype, mediaFilename);
  try {
    const transcriber = await loadTransformersPipeline(model);
    const samples = await decodeAudioToFloat32(audioPath);
    const result = await transcriber(samples, {
      language: 'portuguese',
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    return normalizeTranscriptionText(result);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function runWhisperCli(cliPath: string, modelPath: string, audioPath: string) {
  return new Promise<string>((resolve, reject) => {
    const args = ['-m', modelPath, '-f', audioPath, '-l', 'pt', '-nt'];
    const child = spawn(cliPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code) => {
      const text = stdout.trim();
      if (code === 0 && text) {
        resolve(text);
        return;
      }
      reject(new Error(`local_whisper_cli_failed:${code ?? 'unknown'}:${stderr.trim() || stdout.trim()}`));
    });
  });
}

async function transcribeWithCli(
  buffer: Buffer,
  mimetype: string | null,
  mediaFilename: string | null,
  cliPath: string,
  modelPath: string,
) {
  const { tempDir, audioPath } = await writeTempAudioFile(buffer, mimetype, mediaFilename);
  try {
    const txtPath = `${audioPath}.txt`;
    try {
      return await runWhisperCli(cliPath, modelPath, audioPath);
    } catch (error) {
      try {
        const txt = (await readFile(txtPath, 'utf8')).trim();
        if (txt) {
          return txt;
        }
      } catch {
        // whisper-cli may not emit a sidecar file
      }
      throw error;
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

/**
 * Builds a local Whisper transcriber for the chatpro-local worker.
 */
export function createLocalAudioTranscriber(config: LocalConfig): ChatProAudioTranscriber | null {
  if (config.localWhisperMode === 'off') {
    return null;
  }

  if (config.localWhisperMode === 'cli') {
    if (!config.whisperCliPath || !config.whisperModelPath) {
      throw new Error('local_whisper_cli_not_configured');
    }
  }

  return async (input: ChatProAudioTranscriptionInput) => {
    const { buffer, mimetype } = await downloadChatProAudioBuffer(
      input.mediaUrl,
      config.pdfAllowedHostSuffixes,
    );

    if (config.localWhisperMode === 'cli') {
      return transcribeWithCli(
        buffer,
        mimetype,
        input.mediaFilename,
        config.whisperCliPath!,
        config.whisperModelPath!,
      );
    }

    return transcribeWithTransformers(
      buffer,
      mimetype,
      input.mediaFilename,
      config.localWhisperModel,
    );
  };
}
