export interface DeepSeekPageObservation {
  assistantMessageCount: number;
  conversationUrl: string;
  errorText: string;
  hasError: boolean;
  isCompleted: boolean;
  isGenerating: boolean;
  lastResponseHtml: string;
  lastResponseKey: string;
  lastResponseText: string;
  responseCandidates: Array<{
    className: string;
    length: number;
    tag: string;
    text: string;
  }>;
}

export function inspectDeepSeekPage(): DeepSeekPageObservation {
  const assistantSelector = [
    '.ds-markdown.ds-assistant-message-main-content',
    '[data-role="assistant"] [class*="markdown"]',
    '[class*="assistant-message"] [class*="markdown"]',
    '[class*="assistant-message-main-content"]',
  ].join(',');
  const errorElement = document.querySelector('[class*="error"], [class*="failed"], [role="alert"]');
  const assistantElements = Array.from(document.querySelectorAll(assistantSelector));
  const lastResponse = assistantElements[assistantElements.length - 1] || null;
  const lastResponseText = String(lastResponse?.textContent || '').trim();
  const lastResponseHtml = String(lastResponse?.innerHTML || '');
  const lastResponseKey = lastResponseText.length > 0
    ? `${lastResponseText.length}:${lastResponseText.slice(0, 128)}:${lastResponseText.slice(-128)}`
    : '';
  let stopButton = document.querySelector('button[aria-label*="Stop"]');

  if (!stopButton) {
    stopButton = Array.from(document.querySelectorAll('button')).find(
      (button) => /Stop|停止/.test(button.textContent || ''),
    ) || null;
  }

  const stopRect = stopButton?.getBoundingClientRect();
  const isGenerating = stopButton !== null
    && !stopButton.hasAttribute('disabled')
    && !!stopRect
    && stopRect.width > 0
    && stopRect.height > 0;
  const responseCandidates = Array.from(document.querySelectorAll('div,pre,code,p'))
    .filter((element) => {
      const text = String(element.textContent || '').trim();
      const rect = element.getBoundingClientRect();

      return rect.width > 0
        && rect.height > 0
        && text.startsWith('{')
        && text.endsWith('}')
        && !text.includes('Words:');
    })
    .slice(-5)
    .map((element) => ({
      tag: element.tagName,
      className: String(element.className || ''),
      length: String(element.textContent || '').trim().length,
      text: String(element.textContent || '').trim(),
    }));

  return {
    assistantMessageCount: assistantElements.length,
    conversationUrl: window.location.href,
    errorText: String(errorElement?.textContent || ''),
    hasError: errorElement !== null,
    isCompleted: !isGenerating && lastResponseText.length > 0,
    isGenerating,
    lastResponseHtml,
    lastResponseKey,
    lastResponseText,
    responseCandidates,
  };
}
