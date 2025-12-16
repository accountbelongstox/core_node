import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';
import { TOOL_MESSAGE_TYPES } from '@/common/message-types';

interface BingDictionaryParams {
  word: string;
  openInNewTab?: boolean;
}

interface BingDictionaryResult {
  success: boolean;
  word: string | null;
  phonetics: Array<{
    text: string;
    audioUrl: string | null;
    lang: string;
  }>;
  translations: Array<{
    partOfSpeech: string;
    definition: string;
  }>;
  pluralForms: string[];
  sampleImages: Array<{
    url: string;
    alt: string;
  }>;
  synonyms: Array<{
    type: string;
    words: string;
  }>;
  advancedTranslations: Array<{
    type: string;
    content: string;
  }>;
  voiceUrls: string[];
  error: string | null;
  url?: string;
  tabId?: number;
}

class BingDictionaryTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.BING_DICTIONARY;

  /**
   * Execute Bing Dictionary translation lookup
   */
  async execute(args: BingDictionaryParams): Promise<ToolResult> {
    const { word, openInNewTab = false } = args;

    if (!word || word.trim() === '') {
      return createErrorResponse('Word parameter is required and cannot be empty');
    }

    console.log(`[Bing Dictionary] Looking up word: "${word}"`);

    try {
      // Construct Bing Dictionary URL
      const searchWord = encodeURIComponent(word.trim());
      const bingDictUrl = `https://www.bing.com/dict/search?q=${searchWord}`;

      console.log(`[Bing Dictionary] Target URL: ${bingDictUrl}`);

      let tab: chrome.tabs.Tab | undefined;

      // Check if we should reuse an existing Bing Dictionary tab
      if (!openInNewTab) {
        const allTabs = await chrome.tabs.query({});

        // Find tabs with Bing Dictionary open
        const bingDictTabs = allTabs.filter((t) => {
          return t.url && t.url.includes('bing.com/dict');
        });

        if (bingDictTabs.length > 0) {
          // Reuse the first Bing Dictionary tab found
          tab = bingDictTabs[0];
          console.log(
            `[Bing Dictionary] Reusing existing tab ID: ${tab.id}, navigating to: ${bingDictUrl}`,
          );

          // Navigate to the new search URL
          if (tab.id) {
            await chrome.tabs.update(tab.id, {
              url: bingDictUrl,
              active: true,
            });
          }
        }
      }

      // If no existing tab or openInNewTab is true, create a new tab
      if (!tab) {
        console.log(`[Bing Dictionary] Creating new tab for: ${bingDictUrl}`);
        tab = await chrome.tabs.create({
          url: bingDictUrl,
          active: true,
        });
      }

      if (!tab.id) {
        return createErrorResponse('Failed to create or access tab');
      }

      // Wait for page to load
      console.log('[Bing Dictionary] Waiting for page to load...');
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Inject content script
      console.log('[Bing Dictionary] Injecting content script...');
      await this.injectContentScript(tab.id, ['inject-scripts/bing-dictionary-helper.js']);

      // Wait a bit for content script to initialize
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Send message to extract translation data
      console.log('[Bing Dictionary] Requesting translation data...');
      const translationData: BingDictionaryResult = await this.sendMessageToTab(tab.id, {
        action: TOOL_MESSAGE_TYPES.BING_DICTIONARY_FETCH_TRANSLATION,
        word: word,
      });

      if (!translationData) {
        return createErrorResponse('No response from content script');
      }

      if (!translationData.success) {
        console.warn('[Bing Dictionary] Translation extraction failed:', translationData.error);
      }

      // Add metadata
      translationData.url = bingDictUrl;
      translationData.tabId = tab.id;

      console.log('[Bing Dictionary] Translation data retrieved successfully');

      // Return formatted result
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(translationData, null, 2),
          },
        ],
        isError: false,
      };
    } catch (error) {
      console.error('[Bing Dictionary] Error:', error);
      return createErrorResponse(
        `Error looking up word in Bing Dictionary: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const bingDictionaryTool = new BingDictionaryTool();
