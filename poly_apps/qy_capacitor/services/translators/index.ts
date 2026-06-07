/**
 * Translation Services
 * Provides multiple translation providers with consistent interface
 */

export interface ITranslator {
  translate(text: string, from: string, to: string): Promise<string>;
  translateBatch(texts: string[], from: string, to: string): Promise<string[]>;
}

/**
 * Bing Translator
 * Uses Bing Translator API (unofficial/scraping approach)
 */
export class BingTranslator implements ITranslator {
  private readonly baseUrl = 'https://www.bing.com/ttranslate';

  async translate(text: string, from: string, to: string): Promise<string> {
    try {
      // Bing language code mapping
      const fromLang = this.mapLanguageCode(from);
      const toLang = this.mapLanguageCode(to);

      // Method 1: Using Bing Translator widget API
      const url = `https://www.bing.com/ttranslate?&text=${encodeURIComponent(text)}&from=${fromLang}&to=${toLang}`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(`Bing API error: ${response.status}`);
      }

      const html = await response.text();

      // Parse HTML response for translation
      // Bing returns JSON in format: [{"translations":[{"text":"translation result"}]}]
      const jsonMatch = html.match(/\[{[^\]]+}\]/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        if (data[0]?.translations?.[0]?.text) {
          return data[0].translations[0].text;
        }
      }

      // Fallback: Try to extract from HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const resultElement = doc.querySelector('#t_sv') || doc.querySelector('.t_sv');

      if (resultElement) {
        return resultElement.textContent?.trim() || text;
      }

      console.warn('[BingTranslator] Could not parse response, returning original');
      return text;
    } catch (error) {
      console.error('[BingTranslator] Error:', error);
      return text; // Return original on error
    }
  }

  async translateBatch(texts: string[], from: string, to: string): Promise<string[]> {
    // Batch translate with rate limiting
    const results: string[] = [];

    for (let i = 0; i < texts.length; i++) {
      results.push(await this.translate(texts[i], from, to));

      // Rate limiting: 100ms delay between requests
      if (i < texts.length - 1) {
        await this.delay(100);
      }
    }

    return results;
  }

  private mapLanguageCode(code: string): string {
    const mapping: Record<string, string> = {
      'english': 'en',
      'chinese': 'zh-Hans',
      'japanese': 'ja',
      'korean': 'ko',
      'spanish': 'es',
      'french': 'fr',
      'german': 'de',
      'russian': 'ru',
      'arabic': 'ar',
      'portuguese': 'pt',
      'vietnamese': 'vi',
      'lao': 'lo',
      // Short codes
      'en': 'en',
      'zh': 'zh-Hans',
      'ja': 'ja',
      'ko': 'ko',
    };

    return mapping[code] || code;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Google Translator
 * Uses Google Translate API (unofficial)
 */
export class GoogleTranslator implements ITranslator {
  async translate(text: string, from: string, to: string): Promise<string> {
    try {
      const fromLang = this.mapLanguageCode(from);
      const toLang = this.mapLanguageCode(to);

      // Using Google Translate unofficial API
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${fromLang}&tl=${toLang}&dt=t&q=${encodeURIComponent(text)}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Google API error: ${response.status}`);
      }

      const data = await response.json();

      // Google returns: [[["translation result","original",null,null,3]],null,"en"]
      if (Array.isArray(data) && data[0]?.[0]?.[0]) {
        return data[0][0][0];
      }

      return text;
    } catch (error) {
      console.error('[GoogleTranslator] Error:', error);
      return text;
    }
  }

  async translateBatch(texts: string[], from: string, to: string): Promise<string[]> {
    const results: string[] = [];

    for (let i = 0; i < texts.length; i++) {
      results.push(await this.translate(texts[i], from, to));

      if (i < texts.length - 1) {
        await this.delay(50);
      }
    }

    return results;
  }

  private mapLanguageCode(code: string): string {
    const mapping: Record<string, string> = {
      'english': 'en',
      'chinese': 'zh-CN',
      'japanese': 'ja',
      'korean': 'ko',
      'spanish': 'es',
      'french': 'fr',
      'german': 'de',
      'russian': 'ru',
      'arabic': 'ar',
      'portuguese': 'pt',
      'vietnamese': 'vi',
      'lao': 'lo',
      'en': 'en',
      'zh': 'zh-CN',
    };

    return mapping[code] || code;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * DeepL Translator
 * Uses DeepL API (requires API key for production)
 */
export class DeepLTranslator implements ITranslator {
  private readonly apiKey = ''; // Add API key here

  async translate(text: string, from: string, to: string): Promise<string> {
    // For now, fallback to mock/placeholder
    // In production, implement actual DeepL API calls
    console.warn('[DeepLTranslator] DeepL requires API key - using placeholder');
    return `[DeepL] ${text}`;
  }

  async translateBatch(texts: string[], from: string, to: string): Promise<string[]> {
    return texts.map(t => `[DeepL] ${t}`);
  }
}

/**
 * Mock Translator for Testing
 */
export class MockTranslator implements ITranslator {
  async translate(text: string, from: string, to: string): Promise<string> {
    // Simple mock: reverse the text
    return `[${to}] ${text.split('').reverse().join('')}`;
  }

  async translateBatch(texts: string[], from: string, to: string): Promise<string[]> {
    return texts.map(t => this.translate(t, from, to)) as unknown as string[];
  }
}

export default {
  BingTranslator,
  GoogleTranslator,
  DeepLTranslator,
  MockTranslator,
};
