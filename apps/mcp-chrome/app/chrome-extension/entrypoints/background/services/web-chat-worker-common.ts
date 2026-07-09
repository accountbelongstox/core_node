/**
 * Shared helpers for the web-chat worker services (ChatGPT / Gemini / NotebookLM).
 *
 * Every text-based web-chat worker follows the same execute-parse-submit flow:
 *   1. Call the provider's tool.execute() with {prompt/question, withAudio, language}
 *   2. If isError → submit 'failed'
 *   3. Parse JSON from content[0].text
 *   4. If !success || !answer → submit 'failed'
 *   5. Submit 'completed' with {answer, audio?, provider}
 *
 * This module factors that boilerplate into one reusable function so each worker
 * service only needs to declare prompt extraction and tool selection.
 */
export interface WebChatWorkerResult {
  success: boolean;
  answer?: string;
  audio?: any;
  provider?: string;
  error?: string;
  /** The full parsed JSON object from the tool result, for provider-specific extra fields. */
  raw?: any;
}

/**
 * Parse a web-chat tool's ToolResult into a normalized worker result.
 * Handles isError, JSON parsing, and success/answer validation.
 */
export function parseWebChatToolResult(toolResult: any, providerLabel: string): WebChatWorkerResult {
  if (toolResult?.isError) {
    const errText = toolResult?.content?.[0]?.text;
    return {
      success: false,
      error: typeof errText === 'string' ? errText : `${providerLabel} tool error`,
    };
  }

  let parsed: any = {};
  try {
    parsed = JSON.parse(toolResult?.content?.[0]?.text || '{}');
  } catch {
    parsed = {};
  }

  if (!parsed.success || !parsed.answer) {
    return {
      success: false,
      error: parsed?.error || `${providerLabel} produced no answer`,
    };
  }

  return {
    success: true,
    answer: parsed.answer,
    audio: parsed.audio || null,
    provider: parsed.provider || providerLabel,
    raw: parsed,
  };
}

/**
 * Extract the common withAudio/language fields from a task payload.
 */
export function extractAudioParams(payload: any): { withAudio: boolean; language: string } {
  return {
    withAudio: payload.with_audio === true || payload.withAudio === true,
    language: typeof payload.language === 'string' ? payload.language : 'en',
  };
}
