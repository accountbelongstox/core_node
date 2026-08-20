import { chatgptWebTool } from '../../tools/browser/chatgpt-web';
import { deepseekSendPromptTool } from '../../tools/browser/deepseek';
import { geminiWebTool } from '../../tools/browser/gemini-web';
import {
  getValidityProvider,
  type AiWebProvider,
} from '../../tools/browser/ai-web-common';
import {
  buildValidityPrompt,
  parseValidityClassification,
  type ClassifierWord,
} from './word-validity-classifier';
import { WORD_VALIDITY_CONFIG } from '@/utils/queue-center-contract';
let classificationQueue: Promise<void> = Promise.resolve();

export interface WordValidityRuntimeResult {
  provider: AiWebProvider;
  valid: ClassifierWord[];
  invalid: ClassifierWord[];
  answer: string;
}

export function runWordValidityClassification(
  words: ClassifierWord[],
  providerOverride?: AiWebProvider,
  targetLanguage?: string,
): Promise<WordValidityRuntimeResult> {
  const run = classificationQueue.then(() => executeClassification(
    words,
    providerOverride,
    targetLanguage,
  ));
  classificationQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function executeClassification(
  words: ClassifierWord[],
  providerOverride?: AiWebProvider,
  targetLanguage?: string,
): Promise<WordValidityRuntimeResult> {
  const provider = providerOverride || await getValidityProvider();
  const prompt = buildValidityPrompt(words.map((word) => word.word), targetLanguage);
  const answer = await sendPrompt(provider, prompt);
  const classification = parseValidityClassification(answer, words);

  return {
    provider,
    valid: classification.valid,
    invalid: classification.invalid,
    answer,
  };
}

async function sendPrompt(provider: AiWebProvider, prompt: string): Promise<string> {
  if (provider === 'deepseek') {
    const toolResult = await deepseekSendPromptTool.execute({
      prompt,
      waitForCompletion: true,
      timeout: WORD_VALIDITY_CONFIG.request_timeout_ms,
      autoRetry: false,
    });
    return extractDeepSeekText(toolResult);
  }

  const tool = provider === 'gemini' ? geminiWebTool : chatgptWebTool;
  const toolResult = await tool.execute({ prompt, language: 'en' });
  return extractAnswer(toolResult);
}

function extractAnswer(toolResult: any): string {
  const errorText = toolResult?.content?.[0]?.text;
  let payload: any = {};

  if (toolResult?.isError) {
    throw new Error(typeof errorText === 'string' ? errorText : 'web tool error');
  }
  try {
    payload = JSON.parse(errorText || '{}');
  } catch {
    payload = {};
  }
  if (typeof payload.answer !== 'string' || !payload.answer) {
    throw new Error('web tool returned no answer');
  }
  return payload.answer;
}

function extractDeepSeekText(toolResult: any): string {
  const text = toolResult?.content?.[0]?.text;
  let payload: any;

  if (toolResult?.isError) {
    throw new Error(typeof text === 'string' ? text : 'web-ai tool error');
  }
  if (typeof text !== 'string' || !text) {
    throw new Error('web-ai tool returned no content');
  }
  try {
    payload = JSON.parse(text);
  } catch {
    return text;
  }
  if (typeof payload?.result?.content === 'string') return payload.result.content;
  if (typeof payload?.result === 'string') return payload.result;
  throw new Error('web-ai tool result carried no assistant content');
}
