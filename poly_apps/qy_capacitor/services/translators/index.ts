/**
 * Translation Services
 *
 * Vocabulary translation now runs through the backend ENQUEUE + POLL pipeline
 * (`VocabularyTranslationCenter` + `ApiCenter.translation.queueBatchAdd/
 * queueBatchStatus`): the FE enqueues untranslated words and polls for their
 * fills — it never translates itself. The former on-demand `BackendTranslator`
 * (which called `translation.translate` / `simpleTranslateWithGoogle` per word)
 * was removed once its only caller (LibraryDetail) migrated to the queue.
 *
 * `MockTranslator` is kept for development / offline use.
 */

export interface ITranslator {
  translate(text: string, from: string, to: string): Promise<string>;
  translateBatch(texts: string[], from: string, to: string): Promise<string[]>;
}

/**
 * Mock Translator for development / offline use.
 */
export class MockTranslator implements ITranslator {
  async translate(text: string, _from: string, to: string): Promise<string> {
    return `[${to}] ${text.split('').reverse().join('')}`;
  }

  async translateBatch(texts: string[], from: string, to: string): Promise<string[]> {
    return Promise.all(texts.map((t) => this.translate(t, from, to)));
  }
}

export default {
  MockTranslator,
};
