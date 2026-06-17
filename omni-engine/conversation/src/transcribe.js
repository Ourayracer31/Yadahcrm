/**
 * Audio -> text. Claude can't transcribe audio, so speech-to-text uses a
 * transcription API (OpenAI Whisper by default); the transcript is then handed
 * to Claude for summarization. Needs OPENAI_API_KEY. Uses native fetch/FormData
 * (Node 20+), no extra dependency.
 */

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

export async function transcribeAudio(filePath, { model = 'whisper-1', apiKey = process.env.OPENAI_API_KEY, endpoint } = {}) {
  if (!apiKey) {
    throw new Error('Audio transcription needs OPENAI_API_KEY (Whisper). Tip: pass --text or --file instead, or set the key.');
  }
  const url = endpoint || 'https://api.openai.com/v1/audio/transcriptions';
  const data = await readFile(filePath);
  const form = new FormData();
  form.append('file', new Blob([data]), basename(filePath));
  form.append('model', model);

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Transcription HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const json = await res.json();
  return json.text || '';
}
