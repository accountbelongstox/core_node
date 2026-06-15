/**
 * Bing Dictionary Helper Content Script
 * Extracts translation and dictionary information from dict.bing.com
 */

(() => {
  console.log('[Bing Dictionary Helper] Content script loaded');

  /**
   * Extract translation data from Bing Dictionary page
   */
  function extractBingDictionaryData() {
    const result = {
      success: false,
      word: null,
      phonetics: [],
      translations: [],
      pluralForms: [],
      sampleImages: [],
      synonyms: [],
      advancedTranslations: [],
      voiceUrls: [],
      // True when the page yielded at least one usable signal (definition,
      // phonetic, or image). The worker marks a word invalid in the backend when
      // this is false, so a genuine "Bing has no entry" never re-queues.
      hasContent: false,
      error: null,
    };

    try {
      // Extract word
      const wordElement = document.querySelector('.hd_div strong');
      if (wordElement) {
        result.word = wordElement.textContent.trim();
      }

      // Check if no results found
      const noResultElement = document.querySelector('.no_results');
      if (noResultElement) {
        result.error = 'No results found for this word';
        return result;
      }

      // Extract phonetics and voice URLs
      const phoneticElements = document.querySelectorAll('.hd_area [lang]');
      phoneticElements.forEach((el, index) => {
        const phonetic = el.textContent.trim();
        const audioElement = el.querySelector('audio');
        const audioUrl = audioElement ? audioElement.src : null;

        result.phonetics.push({
          text: phonetic,
          audioUrl: audioUrl,
          lang: el.getAttribute('lang'),
        });

        if (audioUrl) {
          result.voiceUrls.push(audioUrl);
        }
      });

      // Extract main translations (word definitions)
      const translationElements = document.querySelectorAll('.qdef .hd_area');
      translationElements.forEach((el) => {
        const nextElement = el.nextElementSibling;
        if (nextElement) {
          const partOfSpeech = el.textContent.trim();
          const definition = nextElement.textContent.trim();
          result.translations.push({
            partOfSpeech: partOfSpeech,
            definition: definition,
          });
        }
      });

      // Extract plural forms and inflections
      const pluralElements = document.querySelectorAll('.qdef .hd_if');
      pluralElements.forEach((el) => {
        result.pluralForms.push(el.textContent.trim());
      });

      // Extract sample images
      const imageElements = document.querySelectorAll('.qdef .simg img');
      imageElements.forEach((img) => {
        result.sampleImages.push({
          url: img.src,
          alt: img.alt || '',
        });
      });

      // Extract synonyms from the word definition section
      const synonymDivs = document.querySelectorAll('.wd_div .tb_div');
      synonymDivs.forEach((div) => {
        const typeElement = div.querySelector('h2');
        const contentElement = div.nextElementSibling;

        if (typeElement && contentElement) {
          result.synonyms.push({
            type: typeElement.textContent.trim(),
            words: contentElement.textContent.trim(),
          });
        }
      });

      // Extract advanced translations/definitions
      const advancedDivs = document.querySelectorAll('.df_div .tb_div');
      advancedDivs.forEach((div) => {
        const typeElement = div.querySelector('h2');
        const contentElement = div.nextElementSibling;

        if (typeElement && contentElement) {
          result.advancedTranslations.push({
            type: typeElement.textContent.trim(),
            content: contentElement.textContent.trim(),
          });
        }
      });

      // Extract web translations if no standard translation found
      if (result.translations.length === 0) {
        const webTransElements = document.querySelectorAll('.lf_area');
        webTransElements.forEach((el) => {
          const text = el.textContent.trim();
          if (text) {
            result.translations.push({
              partOfSpeech: 'Web',
              definition: text,
            });
          }
        });
      }

      // A real dictionary hit yields at least a definition, a phonetic, or an
      // image. Pure noise (e.g. a redirect/landing page) leaves all three empty.
      result.hasContent =
        result.translations.length > 0 ||
        result.phonetics.length > 0 ||
        result.sampleImages.length > 0;

      if (!result.hasContent && !result.error) {
        result.error = 'No usable dictionary content for this word';
      }

      result.success = true;
    } catch (error) {
      console.error('[Bing Dictionary Helper] Error extracting data:', error);
      result.error = error.message;
      result.success = false;
    }

    return result;
  }

  /**
   * Message listener for translation requests
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'bingDictionaryFetchTranslation') {
      console.log('[Bing Dictionary Helper] Received translation request');

      try {
        const translationData = extractBingDictionaryData();
        console.log('[Bing Dictionary Helper] Extracted data:', translationData);
        sendResponse(translationData);
      } catch (error) {
        console.error('[Bing Dictionary Helper] Error processing request:', error);
        sendResponse({
          success: false,
          error: error.message,
        });
      }

      return true; // Keep message channel open for async response
    }
  });

  console.log('[Bing Dictionary Helper] Message listener registered');
})();
