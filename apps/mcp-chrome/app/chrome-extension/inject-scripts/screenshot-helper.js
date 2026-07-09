/* eslint-disable */
/**
 * Screenshot helper content script
 * Handles page preparation, scrolling, element positioning, etc.
 */

if (window.__SCREENSHOT_HELPER_INITIALIZED__) {
  // Already initialized, skip
} else {
  window.__SCREENSHOT_HELPER_INITIALIZED__ = true;

  // Stack-based state so nested preparePageForCapture / resetPageAfterCapture
  // pairs do not overwrite each other (reentrancy guard).
  const overflowStack = [];
  const fixedElementStack = [];


  /**
   * Get fixed/sticky positioned elements
   * @returns Array of fixed/sticky elements
   */
  function getFixedElements() {
    const fixed = [];

    document.querySelectorAll('*').forEach((el) => {
      const htmlEl = el;
      const style = window.getComputedStyle(htmlEl);
      if (style.position === 'fixed' || style.position === 'sticky') {
        // Filter out tiny or invisible elements, and elements that are part of the extension UI
        if (
          htmlEl.offsetWidth > 1 &&
          htmlEl.offsetHeight > 1 &&
          !htmlEl.id.startsWith('chrome-mcp-')
        ) {
          fixed.push({
            element: htmlEl,
            originalDisplay: htmlEl.style.display,
            originalVisibility: htmlEl.style.visibility,
          });
        }
      }
    });
    return fixed;
  }

  /**
   * Hide fixed/sticky elements and return the snapshot so the caller can
   * push it onto the reentrancy stack.
   */
  function hideFixedElements() {
    const items = getFixedElements();
    items.forEach((item) => {
      item.element.style.display = 'none';
    });
    return items;
  }

  /**
   * Restore a previously-hidden set of fixed/sticky elements.
   * @param {Array} items - The snapshot returned by hideFixedElements.
   */
  function showFixedElements(items) {
    (items || []).forEach((item) => {
      item.element.style.display = item.originalDisplay || '';
    });
  }

  // Listen for messages from the extension
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    // Respond to ping message
    if (request.action === 'chrome_screenshot_ping') {
      sendResponse({ status: 'pong' });
      return false; // Synchronous response
    }

    // Prepare page for capture
    else if (request.action === 'preparePageForCapture') {
      // Push current state onto the reentrancy stack so nested calls do not
      // overwrite each other.
      overflowStack.push(document.documentElement.style.overflow);
      document.documentElement.style.overflow = 'hidden'; // Hide main scrollbar
      if (request.options?.fullPage) {
        // Only hide fixed elements for full page to avoid flicker
        fixedElementStack.push(hideFixedElements());
      } else {
        fixedElementStack.push(null);
      }
      // Give styles a moment to apply
      setTimeout(() => {
        sendResponse({ success: true });
      }, 50);
      return true; // Async response
    }

    // Get page details
    else if (request.action === 'getPageDetails') {
      const body = document.body;
      const html = document.documentElement;
      sendResponse({
        totalWidth: Math.max(
          body.scrollWidth,
          body.offsetWidth,
          html.clientWidth,
          html.scrollWidth,
          html.offsetWidth,
        ),
        totalHeight: Math.max(
          body.scrollHeight,
          body.offsetHeight,
          html.clientHeight,
          html.scrollHeight,
          html.offsetHeight,
        ),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1,
        currentScrollX: window.scrollX,
        currentScrollY: window.scrollY,
      });
    }

    // Get element details
    else if (request.action === 'getElementDetails') {
      const element = document.querySelector(request.selector);
      if (element) {
        element.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'nearest' });
        setTimeout(() => {
          // Wait for scroll
          const rect = element.getBoundingClientRect();
          sendResponse({
            rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
            devicePixelRatio: window.devicePixelRatio || 1,
          });
        }, 200); // Increased delay for scrollIntoView
        return true; // Async response
      } else {
        sendResponse({ error: `Element with selector "${request.selector}" not found.` });
        return false; // Synchronous response already sent
      }
    }

    // Scroll page
    else if (request.action === 'scrollPage') {
      window.scrollTo({ left: request.x, top: request.y, behavior: 'instant' });
      // Wait for scroll and potential reflows/lazy-loading
      setTimeout(() => {
        sendResponse({
          success: true,
          newScrollX: window.scrollX,
          newScrollY: window.scrollY,
        });
      }, request.scrollDelay || 300); // Configurable delay
      return true; // Async response
    }

    // Reset page
    else if (request.action === 'resetPageAfterCapture') {
      // Pop from the reentrancy stack; fall back to '' if the stack is empty
      // (e.g. the matching prepare ran before this script instance existed).
      const savedOverflow = overflowStack.length > 0 ? overflowStack.pop() : '';
      document.documentElement.style.overflow = savedOverflow || '';
      const savedFixed = fixedElementStack.length > 0 ? fixedElementStack.pop() : null;
      if (savedFixed) showFixedElements(savedFixed);
      if (typeof request.scrollX !== 'undefined' && typeof request.scrollY !== 'undefined') {
        window.scrollTo({ left: request.scrollX, top: request.scrollY, behavior: 'instant' });
      }
      sendResponse({ success: true });
    }

    return false; // Synchronous response
  });
}
