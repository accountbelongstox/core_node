import { WfNewApiPaths } from '../WfNewApiPaths';
import { authedPostJSON, unwrapEnvelope } from '../WfNewApiTransport';

function translationOf(raw: any): string {
  return raw?.success !== false && typeof raw?.translation === 'string' ? raw.translation.trim() : '';
}

export const translationMethods = {
  async translateTexts(texts: string[], targetLanguage: string): Promise<string[]> {
    if (texts.length === 0) return [];
    const res = unwrapEnvelope(await authedPostJSON<any>(WfNewApiPaths.translationBatch, { texts, target_language: targetLanguage }));
    const results: unknown[] = Array.isArray(res?.results) ? res.results : [];
    return texts.map((_, index) => translationOf(results[index]));
  },
};

export const mockTranslationMethods = {
  async translateTexts(texts: string[], _targetLanguage: string): Promise<string[]> {
    return texts.map(() => '');
  },
};
