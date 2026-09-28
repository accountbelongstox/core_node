/* eslint-disable */

if (window.__WEB_FETCHER_HELPER_INITIALIZED__) {
  // Already initialized, skip
} else {
  window.__WEB_FETCHER_HELPER_INITIALIZED__ = true;

  const config = {
    // Elements that should be ignored when extracting content (used for iframe content and fallback extraction)
    ignoreElements: [
      'nav',
      'header:not(article header)',
      'footer:not(article footer)',
      'aside',
      'script',
      'style',
      'noscript',
      'iframe[src*="ads"]',
      '.cookie-notice',
      '.ad',
      '.ads',
      '.advertisement',
      '.banner',
      '.popup',
      '.modal',
      '.overlay',
      '.social-share',
      '.social-links',
      '.related-articles',
      '.comments',
    ],
    minTextLength: 20,
    maxTotalLength: 100000,
    minParagraphLength: 2,
  };

  // Listen for messages from the extension
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    const pingActions = ['search_tabs_content_ping', 'chrome_web_fetcher_ping'];
    // Respond to ping message
    if (pingActions.includes(request.action)) {
      sendResponse({ status: 'pong' });
      return false; // Synchronous response
    }

    // Get HTML content
    else if (request.action === 'getHtmlContent') {
      try {
        let rawHtml;

        // If selector is specified, only get content from the matching element
        if (request.selector) {
          const element = document.querySelector(request.selector);
          if (element) {
            rawHtml = element.outerHTML;
          } else {
            throw new Error(`No element found matching selector: ${request.selector}`);
          }
        } else {
          // Otherwise get the entire page content
          rawHtml = document.documentElement.outerHTML;
        }

        const cleanedHtml = cleanHtmlContent(rawHtml);

        sendResponse({
          success: true,
          htmlContent: cleanedHtml,
          selector: request.selector,
        });
      } catch (error) {
        sendResponse({
          success: false,
          error: `Failed to get HTML content: ${error.message}`,
        });
      }
      return false; // Synchronous response already sent
    }

    // Get text content
    else if (request.action === 'getTextContent') {
      try {
        // If selector is specified, only get content from the matching element
        if (request.selector) {
          const element = document.querySelector(request.selector);
          if (element) {
            // Directly get the text content of the element
            const textContent = element.innerText;

            sendResponse({
              success: true,
              textContent: textContent,
              selector: request.selector,
            });
          } else {
            throw new Error(`No element found matching selector: ${request.selector}`);
          }
        } else {
          // Otherwise use Readability to extract the main content
          const documentClone = document.cloneNode(true);

          const reader = new window.__MCP_WEB_FETCHER_READABILITY__(documentClone);
          const article = reader.parse();

          if (article && article.textContent) {
            // Get metadata
            const metadata = extractPageMetadata();

            // Get iframe content if available
            const iframeContent = extractIframeContent();

            // Combine content
            let fullContent = article.textContent;
            if (iframeContent && iframeContent.trim().length > config.minTextLength) {
              fullContent += '\n\n--- Embedded Content ---\n\n' + iframeContent;
            }

            // Clean content
            fullContent = cleanContent(fullContent);

            sendResponse({
              success: true,
              textContent: fullContent,
              article: {
                title: article.title,
                byline: article.byline,
                siteName: article.siteName,
                excerpt: article.excerpt,
                lang: article.lang,
                content: article.content, // HTML content
              },
              metadata: metadata,
            });
          } else {
            // Fallback to basic extraction
            const textContent = document.body.innerText;
            sendResponse({
              success: true,
              textContent: textContent,
              fallback: true,
            });
          }
        }
      } catch (error) {
        console.error('Error extracting text content:', error);
        sendResponse({
          success: false,
          error: `Failed to extract text content: ${error.message}`,
        });
      }

      return false; // Synchronous response already sent
    }

    // Interactive elements feature has been removed

    return false; // Not our message, or synchronous response already sent
  });

  /**
   * Extract metadata from the page
   * @returns {Object} - Page metadata
   */
  function extractPageMetadata() {
    const metadata = {
      title: document.title,
      description: '',
      author: '',
      keywords: '',
      published: '',
      siteName: '',
    };

    // Extract description
    const descriptionElement = document.querySelector(
      'meta[name="description"], meta[property="og:description"]',
    );
    if (descriptionElement) {
      metadata.description = descriptionElement.getAttribute('content') || '';
    }

    // Extract author
    const authorElement = document.querySelector(
      'meta[name="author"], meta[property="article:author"]',
    );
    if (authorElement) {
      metadata.author = authorElement.getAttribute('content') || '';
    }

    // Extract keywords
    const keywordsElement = document.querySelector('meta[name="keywords"]');
    if (keywordsElement) {
      metadata.keywords = keywordsElement.getAttribute('content') || '';
    }

    // Extract published date
    const publishedElement = document.querySelector(
      'meta[property="article:published_time"], time[datetime]',
    );
    if (publishedElement) {
      metadata.published =
        publishedElement.getAttribute('content') || publishedElement.getAttribute('datetime') || '';
    }

    // Extract site name
    const siteNameElement = document.querySelector('meta[property="og:site_name"]');
    if (siteNameElement) {
      metadata.siteName = siteNameElement.getAttribute('content') || '';
    }

    return metadata;
  }

  /**
   * Extract content from iframes
   * @returns {string} - Combined iframe content
   */
  function extractIframeContent() {
    let allIframeText = '';
    const iframes = document.querySelectorAll('iframe');

    for (const iframe of iframes) {
      try {
        if (isSameOrigin(iframe) && isElementVisible(iframe)) {
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          if (doc) {
            const iframeText = doc.body.innerText;
            if (iframeText && iframeText.trim().length >= config.minTextLength) {
              allIframeText += iframeText.trim() + '\n\n';
            }
          }
        }
      } catch (error) {
        console.warn(
          `Cannot access iframe content (possible cross-origin restriction): ${error.message}`,
        );
      }
    }

    return allIframeText.trim();
  }

  /**
   * Check if iframe is same origin
   * @param {HTMLIFrameElement} iframe - The iframe to check
   * @returns {boolean} - Whether the iframe is same origin
   */
  function isSameOrigin(iframe) {
    try {
      return Boolean(iframe.contentDocument || iframe.contentWindow?.document);
    } catch (e) {
      return false;
    }
  }

  /**
   * Whether an element is actually visible (not display:none / visibility:hidden /
   * zero-size / hidden). Used to skip invisible iframes during text extraction.
   * Was referenced in extractIframeContent but never defined — calling it threw
   * "isElementVisible is not defined", which the per-iframe catch swallowed (so
   * embedded iframe text was silently dropped and the console spammed warnings).
   * @param {Element} el
   * @returns {boolean}
   */
  function isElementVisible(el) {
    if (!el) return false;
    try {
      if (el.hidden) return false;
      const style = typeof window.getComputedStyle === 'function' ? window.getComputedStyle(el) : null;
      if (
        style &&
        (style.display === 'none' ||
          style.visibility === 'hidden' ||
          parseFloat(style.opacity || '1') === 0)
      ) {
        return false;
      }
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    } catch (e) {
      return false;
    }
  }

  /**
   * Clean content text
   * @param {string} text - The text to clean
   * @returns {string} - Cleaned text
   */
  function cleanContent(text) {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim()
      .substring(0, config.maxTotalLength);
  }

  /**
   * Clean HTML content by removing style tags and their content
   * @param {string} html - The HTML content to clean
   * @returns {string} - Cleaned HTML content
   */
  function cleanHtmlContent(html) {
    // Create a new document parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Remove all style tags
    const styleElements = doc.querySelectorAll('style');
    styleElements.forEach((element) => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });

    // Remove all inline style attributes
    const allElementsWithStyle = doc.querySelectorAll('*');
    allElementsWithStyle.forEach((element) => {
      element.removeAttribute('style');
    });

    // Remove all link tags
    const linkElements = doc.querySelectorAll('link');
    linkElements.forEach((element) => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });

    // Remove all script tags
    const scriptElements = doc.querySelectorAll('script');
    scriptElements.forEach((element) => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });

    // Replace all SVG elements with placeholders
    const svgElements = doc.querySelectorAll('svg');
    svgElements.forEach((element) => {
      if (element.parentNode) {
        // Create a placeholder element
        const placeholder = doc.createElement('span');
        placeholder.textContent = '[SVG Icon]';
        placeholder.setAttribute('data-placeholder', 'svg-icon');

        // Replace SVG element
        element.parentNode.replaceChild(placeholder, element);
      }
    });

    // Replace all SVG images and objects
    const svgImages = doc.querySelectorAll(
      'img[src$=".svg"], object[data$=".svg"], embed[src$=".svg"]',
    );
    svgImages.forEach((element) => {
      if (element.parentNode) {
        // Create a placeholder element
        const placeholder = doc.createElement('span');
        placeholder.textContent = '[SVG Image]';
        placeholder.setAttribute('data-placeholder', 'svg-image');
        if (element.alt) {
          placeholder.textContent = `[SVG Image: ${element.alt}]`;
        }

        // Replace SVG image element
        element.parentNode.replaceChild(placeholder, element);
      }
    });

    // Remove elements with only data-* attributes, no children, and no class or style
    const allElements = Array.from(doc.querySelectorAll('*'));
    allElements.forEach((element) => {
      // Check if element has only data-* attributes
      let hasOnlyDataAttributes = true;
      let hasDataAttribute = false;

      // Check all attributes
      for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes[i];
        if (attr.name.startsWith('data-')) {
          hasDataAttribute = true;
        } else if (attr.name !== 'id') {
          // Allow id attribute
          hasOnlyDataAttributes = false;
          break;
        }
      }

      // If element has only data-* attributes, no children, and no text content
      if (
        hasOnlyDataAttributes &&
        hasDataAttribute &&
        element.children.length === 0 &&
        element.textContent.trim() === ''
      ) {
        // Remove the element
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      }
    });

    // Remove all HTML comments
    const removeComments = (node) => {
      const childNodes = node.childNodes;
      for (let i = childNodes.length - 1; i >= 0; i--) {
        const child = childNodes[i];
        if (child.nodeType === 8) {
          // Comment node
          node.removeChild(child);
        } else if (child.nodeType === 1) {
          // Element node
          removeComments(child);
        }
      }
    };
    removeComments(doc);

    // Return cleaned HTML
    return new XMLSerializer().serializeToString(doc);
  }

  // Interactive elements feature has been removed

  // Selector generation feature has been removed
}
