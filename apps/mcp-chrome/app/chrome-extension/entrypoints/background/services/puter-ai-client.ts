/**
 * Puter AI Client — Direct REST API wrapper (no SDK, CSP-compliant)
 *
 * Calls Puter's OpenAI-compatible chat endpoint for translation.
 * Auth: anonymous session token from /auth/get-user-app-token (no login needed).
 * Translate: POST to /puterai/openai/v1/chat/completions with GPT-5.4-nano.
 */

import { logger } from '@/utils/logger';

const LOG = 'Puter AI';

interface TranslationPair {
  word: string;
  translation: string;
}

// Cached anonymous session token (lives for the service worker lifetime).
let cachedToken: string | null = null;

const PUTER_AUTH_URL = 'https://api.puter.com/auth/get-user-app-token';
const PUTER_CHAT_URL = 'https://api.puter.com/puterai/openai/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-5.4-nano';

/**
 * Acquire an anonymous Puter session token. Creates a fresh one if none is
 * cached or if the caller passes `forceRefresh`.
 */
async function acquireToken(forceRefresh = false): Promise<string> {
  if (cachedToken && !forceRefresh) return cachedToken;

  const resp = await fetch(PUTER_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Puter auth failed (${resp.status}): ${body}`);
  }

  const data = await resp.json();
  // The token may live at data.token or data.access_token depending on the
  // endpoint version; try both.
  const token = data?.token || data?.access_token;
  if (!token || typeof token !== 'string') {
    throw new Error('Puter auth response missing token');
  }

  cachedToken = token;
  logger.info(LOG, 'Anonymous session token acquired');
  return token;
}

/**
 * Build a strict-JSON translation prompt the model can answer mechanically.
 * Mirrors WebAiTranslateWorkerService.buildPrompt.
 */
function buildTranslationPrompt(words: string[], targetLanguage: string): string {
  const list = words.map((w) => `- ${w}`).join('\n');
  return [
    `Translate each of the following words/phrases into ${targetLanguage}.`,
    'Respond with ONLY a JSON array, no prose, no code fence, of the form:',
    '[{"word":"<original>","translation":"<translated>"}]',
    'Use the exact original text for each "word". Words:',
    list,
  ].join('\n');
}

/**
 * Extract a JSON array from a model response that may include a surrounding
 * code fence or leading/trailing prose.
 */
function sliceJsonArray(text: string): string | null {
  // Strip code fences
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const cleaned = fenceMatch ? fenceMatch[1] : text;

  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;
  return cleaned.slice(start, end + 1);
}

/**
 * Parse [{word, translation}] pairs from the model answer, keeping only
 * entries whose word matches a requested word (case-insensitive).
 */
function parsePairs(answer: string, requested: string[]): TranslationPair[] {
  const json = sliceJsonArray(answer);
  if (!json) return [];

  let parsed: any;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const wanted = new Set(requested.map((w) => w.toLowerCase()));
  const results: TranslationPair[] = [];

  for (const entry of parsed) {
    if (!entry?.word || !entry?.translation) continue;
    if (typeof entry.word !== 'string' || typeof entry.translation !== 'string') continue;
    if (!wanted.has(entry.word.toLowerCase())) continue;
    results.push({ word: entry.word, translation: entry.translation });
  }

  return results;
}

/**
 * Translate a batch of words via Puter AI.
 *
 * @param words       Source words to translate
 * @param targetLang  Target language code (e.g. 'zh', 'en')
 * @returns           Array of {word, translation} pairs
 */
export async function puterAiTranslate(
  words: string[],
  targetLang: string,
): Promise<TranslationPair[]> {
  if (words.length === 0) return [];

  const prompt = buildTranslationPrompt(words, targetLang);

  // Acquire token (retry once on expiry)
  let token: string;
  try {
    token = await acquireToken();
  } catch (err: any) {
    logger.warn(LOG, `Token acquisition failed: ${err?.message}`);
    throw err;
  }

  const body = {
    model: DEFAULT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
  };

  let resp: Response;
  try {
    resp = await fetch(PUTER_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err: any) {
    throw new Error(`Puter fetch failed: ${err?.message}`);
  }

  // If 401, token may be expired — refresh and retry once
  if (resp.status === 401 || resp.status === 403) {
    logger.info(LOG, 'Token expired, refreshing...');
    cachedToken = null;
    token = await acquireToken(true);
    resp = await fetch(PUTER_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  }

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`Puter chat failed (${resp.status}): ${errText}`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content) {
    throw new Error('Puter chat response missing content');
  }

  const pairs = parsePairs(content, words);
  logger.info(LOG, `Translated ${pairs.length}/${words.length} words`);
  return pairs;
}
