/**
 * Google News Search Processor
 * Searches Google News for a list of words and extracts content
 * Under 300 lines
 */

import type { ITaskProcessor, ProcessorConfig, ProcessorStatus, ProcessorStats } from '../ITaskProcessor';

/**
 * Google News Task Processor
 * Searches Google News for each word in the list and extracts article content
 */
class GoogleNewsProcessor implements ITaskProcessor {
  readonly processorType = 'google_news';
  readonly processorName = 'Google News Search';

  private isRunning = false;
  private config: ProcessorConfig | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private currentWordIndex = 0;
  private searchResults: any[] = [];

  // Built-in word list for testing (will be replaced by API later)
  private wordList: string[] = [
    'artificial intelligence',
    'climate change',
    'technology',
    'renewable energy',
    'space exploration',
    'quantum computing',
    'electric vehicles',
    'cryptocurrency',
  ];

  private stats: ProcessorStats = {
    pending: 0,
    translated: 0,
    failed: 0,
    lastRun: null,
    workerId: null,
    isOnline: false,
    queueTotal: 0,
    newTasks: 0,
    duplicateTasks: 0,
    totalSearches: 0,
    successfulSearches: 0,
    failedSearches: 0,
  };

  /**
   * Start the processor
   */
  async start(config: ProcessorConfig): Promise<void> {
    console.log('[GoogleNewsProcessor] 🚀 Starting Google News Search Processor');
    console.log('[GoogleNewsProcessor] Config:', config);

    this.config = config;
    this.isRunning = true;
    this.stats.isOnline = true;
    this.stats.queueTotal = this.wordList.length;
    this.stats.pending = this.wordList.length;
    this.currentWordIndex = 0;
    this.searchResults = [];

    console.log(`[GoogleNewsProcessor] 📝 Loaded ${this.wordList.length} words to search`);
    console.log('[GoogleNewsProcessor] Word list:', this.wordList);

    // Start the search loop
    await this.startSearchLoop();
  }

  /**
   * Start the search loop
   */
  private async startSearchLoop(): Promise<void> {
    const pollInterval = (this.config?.pollInterval || 10) * 1000; // Convert to milliseconds

    console.log(`[GoogleNewsProcessor] ⏱️  Starting search loop (interval: ${pollInterval}ms)`);

    // Process immediately
    await this.processNextWord();

    // Then continue with interval
    this.intervalId = setInterval(async () => {
      if (this.isRunning && this.currentWordIndex < this.wordList.length) {
        await this.processNextWord();
      } else if (this.currentWordIndex >= this.wordList.length) {
        console.log('[GoogleNewsProcessor] ✅ All words processed');
        this.stop();
      }
    }, pollInterval);
  }

  /**
   * Process the next word in the list
   */
  private async processNextWord(): Promise<void> {
    if (this.currentWordIndex >= this.wordList.length) {
      return;
    }

    const word = this.wordList[this.currentWordIndex];
    this.stats.lastRun = Date.now();

    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`[GoogleNewsProcessor] 🔍 Searching for word #${this.currentWordIndex + 1}/${this.wordList.length}: "${word}"`);
    console.log('═══════════════════════════════════════════════════════');

    try {
      // Search Google News
      const searchResult = await this.searchGoogleNews(word);

      if (searchResult.success) {
        this.stats.successfulSearches++;
        this.stats.translated++;
        console.log(`[GoogleNewsProcessor] ✅ Search successful for "${word}"`);
        console.log(`[GoogleNewsProcessor] 📰 Found ${searchResult.articleCount} articles`);
        console.log('[GoogleNewsProcessor] Search results:', JSON.stringify(searchResult, null, 2));

        this.searchResults.push({
          word,
          timestamp: Date.now(),
          success: true,
          ...searchResult,
        });
      } else {
        this.stats.failedSearches++;
        this.stats.failed++;
        console.error(`[GoogleNewsProcessor] ❌ Search failed for "${word}":`, searchResult.error);

        this.searchResults.push({
          word,
          timestamp: Date.now(),
          success: false,
          error: searchResult.error,
        });
      }
    } catch (error: any) {
      this.stats.failedSearches++;
      this.stats.failed++;
      console.error(`[GoogleNewsProcessor] ❌ Exception during search for "${word}":`, error);

      this.searchResults.push({
        word,
        timestamp: Date.now(),
        success: false,
        error: error.message,
      });
    }

    // Update stats
    this.currentWordIndex++;
    this.stats.pending = this.wordList.length - this.currentWordIndex;
    this.stats.totalSearches = this.currentWordIndex;

    console.log('[GoogleNewsProcessor] 📊 Progress:', {
      processed: this.currentWordIndex,
      total: this.wordList.length,
      pending: this.stats.pending,
      successful: this.stats.successfulSearches,
      failed: this.stats.failedSearches,
    });
    console.log('');
  }

  /**
   * Search Google News for a word
   */
  private async searchGoogleNews(word: string): Promise<any> {
    try {
      // Create Google News search URL
      const searchUrl = `https://news.google.com/search?q=${encodeURIComponent(word)}&hl=en-US&gl=US&ceid=US:en`;

      console.log(`[GoogleNewsProcessor] 🌐 Opening URL: ${searchUrl}`);

      // Open a new tab with the search URL
      const tab = await chrome.tabs.create({
        url: searchUrl,
        active: false, // Don't switch to the tab
      });

      console.log(`[GoogleNewsProcessor] 📑 Created tab ${tab.id} for "${word}"`);

      // Wait for the tab to load
      await this.waitForTabLoad(tab.id!);

      // Extract content from the page
      const content = await this.extractPageContent(tab.id!);

      // Close the tab
      await chrome.tabs.remove(tab.id!);
      console.log(`[GoogleNewsProcessor] 🗑️  Closed tab ${tab.id}`);

      return {
        success: true,
        word,
        url: searchUrl,
        articleCount: content.articleCount,
        headlines: content.headlines,
        extractedText: content.text,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      console.error(`[GoogleNewsProcessor] Error searching for "${word}":`, error);
      return {
        success: false,
        word,
        error: error.message,
      };
    }
  }

  /**
   * Wait for tab to finish loading
   */
  private waitForTabLoad(tabId: number): Promise<void> {
    return new Promise((resolve) => {
      const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          // Wait an additional 2 seconds for dynamic content to load
          setTimeout(resolve, 2000);
        }
      };

      chrome.tabs.onUpdated.addListener(listener);

      // Timeout after 30 seconds
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }, 30000);
    });
  }

  /**
   * Extract content from the page
   */
  private async extractPageContent(tabId: number): Promise<any> {
    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const headlines: string[] = [];

          // Extract article headlines (Google News specific selectors)
          const articleElements = document.querySelectorAll('article a');
          articleElements.forEach((article, index) => {
            if (index < 10) { // Get first 10 headlines
              const text = article.textContent?.trim();
              if (text && text.length > 10) {
                headlines.push(text);
              }
            }
          });

          // Extract all text content
          const bodyText = document.body.innerText.substring(0, 5000); // First 5000 chars

          return {
            articleCount: headlines.length,
            headlines,
            text: bodyText,
          };
        },
      });

      return result[0].result;
    } catch (error: any) {
      console.error(`[GoogleNewsProcessor] Error extracting content from tab ${tabId}:`, error);
      return {
        articleCount: 0,
        headlines: [],
        text: '',
      };
    }
  }

  /**
   * Stop the processor
   */
  stop(): void {
    console.log('[GoogleNewsProcessor] 🛑 Stopping Google News Search Processor');

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    this.stats.isOnline = false;

    console.log('[GoogleNewsProcessor] 📊 Final Statistics:');
    console.log(`  Total searches: ${this.stats.totalSearches}`);
    console.log(`  Successful: ${this.stats.successfulSearches}`);
    console.log(`  Failed: ${this.stats.failedSearches}`);
    console.log(`  Search results collected: ${this.searchResults.length}`);
    console.log('[GoogleNewsProcessor] ✅ Processor stopped');
  }

  /**
   * Get processor status
   */
  getStatus(): ProcessorStatus {
    return {
      isRunning: this.isRunning,
      stats: { ...this.stats },
    };
  }

  /**
   * Check if this processor can handle a specific task type
   */
  canHandle(taskType: string): boolean {
    return taskType === 'google_news' || taskType === 'news_search';
  }

  /**
   * Get current search results (for debugging)
   */
  getSearchResults(): any[] {
    return this.searchResults;
  }
}

// Singleton instance
export const googleNewsProcessor = new GoogleNewsProcessor();
