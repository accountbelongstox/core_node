/**
 * Bing Dictionary Task Handler
 * Processes Bing Dictionary tasks using the unified task queue
 */

import type { ITaskHandler } from '../ITaskHandler';
import { TaskType, type Task, type BingDictionaryTaskDetails, TaskError, ErrorType } from '../types';
import { bingDictionaryTool } from '@/entrypoints/background/tools/browser/bing-dictionary';
import { queueLogger } from '../logger';

/**
 * Bing Dictionary translation result
 */
interface BingTranslationResult {
  word: string;
  md5?: string;
  success: boolean;
  explanation?: string;
  phonetic?: string;
  us_phonetic?: string;
  uk_phonetic?: string;
  translations?: Array<{
    partOfSpeech: string;
    definition: string;
  }>;
  synonyms?: Array<{
    type: string;
    words: string;
  }>;
  error?: string;
}

/**
 * Bing Dictionary Handler
 * Looks up words in Bing Dictionary and extracts translations
 */
export class BingDictionaryHandler implements ITaskHandler<BingDictionaryTaskDetails> {
  readonly type = TaskType.BING_DICTIONARY;
  readonly name = 'Bing Dictionary Handler';

  /**
   * Execute Bing Dictionary task
   */
  async execute(
    task: Task<BingDictionaryTaskDetails>,
    onProgress?: (progress: number) => void,
  ): Promise<void> {
    const { words, language = 'english', batchSize = 1, provider = 'bing' } = task.details;

    if (!words || words.length === 0) {
      queueLogger.error('BingDictionaryHandler', 'No words provided for translation', {
        taskId: task.id,
        words,
      });
      task.error = 'No words to translate';
      return;
    }

    queueLogger.info('BingDictionaryHandler', `Processing ${words.length} words`, {
      taskId: task.id,
      language,
      batchSize,
    });

    const results: BingTranslationResult[] = [];
    const totalWords = words.length;

    // Process words in batches
    for (let i = 0; i < totalWords; i += batchSize) {
      const batch = words.slice(i, Math.min(i + batchSize, totalWords));

      // Process each word in the batch
      for (const wordData of batch) {
        const { word, md5 } = wordData;

        try {
          console.log(`[BingDictionaryHandler] Looking up: ${word}`);

          // Use Bing Dictionary tool to fetch translation
          const toolResult = await bingDictionaryTool.execute({
            word,
            openInNewTab: false, // Reuse tab for efficiency
          });

          if (toolResult.isError) {
            // Translation failed
            results.push({
              word,
              md5,
              success: false,
              error: toolResult.content[0]?.text || 'Unknown error',
            });
            console.error(`[BingDictionaryHandler] Failed: ${word} - ${toolResult.content[0]?.text}`);
          } else {
            // Parse translation data
            const translationData = JSON.parse(toolResult.content[0]?.text || '{}');

            if (translationData.success) {
              // Extract translation information
              const explanation = this.formatExplanation(translationData);
              const phonetics = translationData.phonetics || [];

              results.push({
                word,
                md5,
                success: true,
                explanation,
                phonetic: phonetics[0]?.text || '',
                us_phonetic: phonetics.find((p: any) => p.lang === 'en-US')?.text || '',
                uk_phonetic: phonetics.find((p: any) => p.lang === 'en-GB')?.text || '',
                translations: translationData.translations || [],
                synonyms: translationData.synonyms || [],
              });

              console.log(`[BingDictionaryHandler] Success: ${word}`);
            } else {
              // Translation extraction failed
              results.push({
                word,
                md5,
                success: false,
                error: translationData.error || 'Translation extraction failed',
              });
              console.error(`[BingDictionaryHandler] Extraction failed: ${word}`);
            }
          }
        } catch (error: any) {
          results.push({
            word,
            md5,
            success: false,
            error: error.message || String(error),
          });
          console.error(`[BingDictionaryHandler] Error: ${word}`, error);
        }

        // Update progress
        const completedWords = i + batch.indexOf(wordData) + 1;
        const progress = Math.floor((completedWords / totalWords) * 100);
        onProgress?.(progress);

        // Small delay between words to avoid rate limiting
        if (completedWords < totalWords) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    // Store results in task
    task.result = {
      provider,
      language,
      totalWords,
      successCount: results.filter(r => r.success).length,
      failedCount: results.filter(r => !r.success).length,
      results,
    };

    const successCount = results.filter(r => r.success).length;
    queueLogger.info('BingDictionaryHandler', `Task completed: ${successCount}/${totalWords} succeeded`, {
      taskId: task.id,
      successCount,
      failedCount: totalWords - successCount,
    });
  }

  /**
   * Validate task details
   */
  validate(details: BingDictionaryTaskDetails): true | string {
    if (!details.words || !Array.isArray(details.words)) {
      return 'Invalid words array';
    }

    if (details.words.length === 0) {
      return 'Words array is empty';
    }

    for (const wordData of details.words) {
      if (!wordData.word || typeof wordData.word !== 'string') {
        return 'Invalid word data: word field is required and must be a string';
      }
    }

    if (details.batchSize !== undefined && details.batchSize < 1) {
      return 'Batch size must be at least 1';
    }

    return true;
  }

  /**
   * Check if handler is ready
   */
  async isReady(): Promise<boolean> {
    // Check if Chrome tabs API is available
    if (!chrome?.tabs) {
      console.error('[BingDictionaryHandler] Chrome tabs API not available');
      return false;
    }

    return true;
  }

  /**
   * Format explanation from translation data
   */
  private formatExplanation(translationData: any): string {
    const lines: string[] = [];

    // Add translations
    if (translationData.translations && translationData.translations.length > 0) {
      translationData.translations.forEach((trans: any) => {
        lines.push(`${trans.partOfSpeech}. ${trans.definition}`);
      });
    }

    // Add plural forms if available
    if (translationData.pluralForms && translationData.pluralForms.length > 0) {
      lines.push(`Plural: ${translationData.pluralForms.join(', ')}`);
    }

    // Add synonyms if available
    if (translationData.synonyms && translationData.synonyms.length > 0) {
      const synonymsText = translationData.synonyms
        .map((syn: any) => `${syn.type}: ${syn.words}`)
        .join('; ');
      lines.push(`Synonyms: ${synonymsText}`);
    }

    return lines.join('\n') || 'No translation available';
  }
}
