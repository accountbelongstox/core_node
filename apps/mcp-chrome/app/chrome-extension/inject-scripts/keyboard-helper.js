/* eslint-disable */
// keyboard-helper.js
// This script is injected into the page to handle keyboard event simulation

if (window.__KEYBOARD_HELPER_INITIALIZED__) {
  // Already initialized, skip
} else {
  window.__KEYBOARD_HELPER_INITIALIZED__ = true;

  // A map for special keys to their KeyboardEvent properties
  // Key names should be lowercase for matching
  const SPECIAL_KEY_MAP = {
    enter: { key: 'Enter', code: 'Enter', keyCode: 13 },
    tab: { key: 'Tab', code: 'Tab', keyCode: 9 },
    esc: { key: 'Escape', code: 'Escape', keyCode: 27 },
    escape: { key: 'Escape', code: 'Escape', keyCode: 27 },
    space: { key: ' ', code: 'Space', keyCode: 32 },
    backspace: { key: 'Backspace', code: 'Backspace', keyCode: 8 },
    delete: { key: 'Delete', code: 'Delete', keyCode: 46 },
    del: { key: 'Delete', code: 'Delete', keyCode: 46 },
    up: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
    arrowup: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
    down: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
    arrowdown: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
    left: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
    arrowleft: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
    right: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
    arrowright: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
    home: { key: 'Home', code: 'Home', keyCode: 36 },
    end: { key: 'End', code: 'End', keyCode: 35 },
    pageup: { key: 'PageUp', code: 'PageUp', keyCode: 33 },
    pagedown: { key: 'PageDown', code: 'PageDown', keyCode: 34 },
    insert: { key: 'Insert', code: 'Insert', keyCode: 45 },
    // Function keys
    ...Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [
        `f${i + 1}`,
        { key: `F${i + 1}`, code: `F${i + 1}`, keyCode: 112 + i },
      ]),
    ),
  };

  const MODIFIER_KEYS = {
    ctrl: 'ctrlKey',
    control: 'ctrlKey',
    alt: 'altKey',
    shift: 'shiftKey',
    meta: 'metaKey',
    command: 'metaKey',
    cmd: 'metaKey',
  };

  /**
   * Parses a key string (e.g., "Ctrl+Shift+A", "Enter") into a main key and modifiers.
   * @param {string} keyString - String representation of a single key press (can include modifiers).
   * @returns { {key: string, code: string, keyCode: number, charCode?: number, modifiers: {ctrlKey:boolean, altKey:boolean, shiftKey:boolean, metaKey:boolean}} | null }
   *          Returns null if the keyString is invalid or represents only modifiers.
   */
  function parseSingleKeyCombination(keyString) {
    const parts = keyString.split('+').map((part) => part.trim().toLowerCase());
    const modifiers = {
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
    };
    let mainKeyPart = null;

    for (const part of parts) {
      if (MODIFIER_KEYS[part]) {
        modifiers[MODIFIER_KEYS[part]] = true;
      } else if (mainKeyPart === null) {
        // First non-modifier is the main key
        mainKeyPart = part;
      } else {
        // Invalid format: multiple main keys in a single combination (e.g., "Ctrl+A+B")
        console.error(`Invalid key combination string: ${keyString}. Multiple main keys found.`);
        return null;
      }
    }

    if (!mainKeyPart) {
      // This case could happen if the keyString is something like "Ctrl+" or just "Ctrl"
      // If the intent was to press JUST 'Control', the input should be 'Control' not 'Control+'
      // Let's check if mainKeyPart is actually a modifier name used as a main key
      if (Object.keys(MODIFIER_KEYS).includes(parts[parts.length - 1]) && parts.length === 1) {
        mainKeyPart = parts[parts.length - 1]; // e.g. user wants to press "Control" key itself
        // For "Control" key itself, key: "Control", code: "ControlLeft" (or Right)
        if (mainKeyPart === 'ctrl' || mainKeyPart === 'control')
          return { key: 'Control', code: 'ControlLeft', keyCode: 17, modifiers };
        if (mainKeyPart === 'alt') return { key: 'Alt', code: 'AltLeft', keyCode: 18, modifiers };
        if (mainKeyPart === 'shift')
          return { key: 'Shift', code: 'ShiftLeft', keyCode: 16, modifiers };
        if (mainKeyPart === 'meta' || mainKeyPart === 'command' || mainKeyPart === 'cmd')
          return { key: 'Meta', code: 'MetaLeft', keyCode: 91, modifiers };
      } else {
        console.error(`Invalid key combination string: ${keyString}. No main key specified.`);
        return null;
      }
    }

    const specialKey = SPECIAL_KEY_MAP[mainKeyPart];
    if (specialKey) {
      return { ...specialKey, modifiers };
    }

    // For single characters or other unmapped keys
    if (mainKeyPart.length === 1) {
      // If Shift is active and it's a letter, use the uppercase version for 'key'
      // This mimics more closely how keyboards behave.
      let keyChar = mainKeyPart;
      if (modifiers.shiftKey && mainKeyPart.match(/^[a-z]$/i)) {
        keyChar = mainKeyPart.toUpperCase();
      }
      // Derive keyCode/charCode from the shift-aware character so legacy
      // keyCode-based handlers see the right code (e.g. 65 for Shift+A, not 97).
      const charCode = keyChar.charCodeAt(0);

      return {
        key: keyChar,
        code: `Key${mainKeyPart.toUpperCase()}`, // 'a' -> KeyA, 'A' -> KeyA
        keyCode: charCode,
        charCode: charCode, // charCode is legacy, but some old systems might use it
        modifiers,
      };
    }

    console.error(`Unknown key: ${mainKeyPart} in string "${keyString}"`);
    return null; // Or handle as an error
  }

  /**
   * Perform the default edit of Backspace/Delete/Enter, which synthetic key
   * events never trigger, unless the page cancelled the keydown.
   */
  function applyEditingKey(key, element, modifiers) {
    if (modifiers && (modifiers.ctrlKey || modifiers.metaKey || modifiers.altKey)) return;
    const isTextControl =
      element instanceof HTMLTextAreaElement ||
      (element instanceof HTMLInputElement && typeof element.selectionStart === 'number');
    if (key === 'Enter') {
      if (element instanceof HTMLTextAreaElement) insertTextAtCaret(element, '\n');
      else if (element.isContentEditable) document.execCommand('insertParagraph');
      return;
    }
    if (key !== 'Backspace' && key !== 'Delete') return;
    if (element.isContentEditable && !isTextControl) {
      document.execCommand(key === 'Backspace' ? 'delete' : 'forwardDelete');
      return;
    }
    if (!isTextControl) return;
    let start = element.selectionStart ?? element.value.length;
    let end = element.selectionEnd ?? element.value.length;
    if (start === end) {
      if (key === 'Backspace') start = Math.max(0, start - 1);
      else end = Math.min(element.value.length, end + 1);
    }
    if (start === end) return;
    const inputType = key === 'Backspace' ? 'deleteContentBackward' : 'deleteContentForward';
    element.setRangeText('', start, end, 'end');
    element.dispatchEvent(new InputEvent('input', { inputType, bubbles: true }));
  }

  /**
   * Simulates a single key press (keydown, (keypress), keyup) for a parsed key.
   * @param { {key: string, code: string, keyCode: number, charCode?: number, modifiers: object} } parsedKeyInfo
   * @param {Element} element - Target element.
   * @returns {{success: boolean, error?: string}}
   */
  function dispatchKeyEvents(parsedKeyInfo, element) {
    if (!parsedKeyInfo) return { success: false, error: 'Invalid key info provided for dispatch.' };

    const { key, code, keyCode, charCode, modifiers } = parsedKeyInfo;

    const eventOptions = {
      key: key,
      code: code,
      bubbles: true,
      cancelable: true,
      composed: true, // Important for shadow DOM
      view: window,
      ...modifiers, // ctrlKey, altKey, shiftKey, metaKey
      // keyCode/which are deprecated but often set for compatibility
      keyCode: keyCode || (key.length === 1 ? key.charCodeAt(0) : 0),
      which: keyCode || (key.length === 1 ? key.charCodeAt(0) : 0),
    };

    try {
      const kdRes = element.dispatchEvent(new KeyboardEvent('keydown', eventOptions));

      // keypress is deprecated, but simulate if it's a character key or Enter
      // Only dispatch if keydown was not cancelled and it's a character producing key
      if (kdRes && (key.length === 1 || key === 'Enter' || key === ' ')) {
        const keypressOptions = { ...eventOptions };
        if (charCode) keypressOptions.charCode = charCode;
        element.dispatchEvent(new KeyboardEvent('keypress', keypressOptions));
      }

      if (kdRes) applyEditingKey(key, element, modifiers);
      element.dispatchEvent(new KeyboardEvent('keyup', eventOptions));
      return { success: true };
    } catch (error) {
      console.error(`Error dispatching key events for "${key}":`, error);
      return {
        success: false,
        error: `Error dispatching key events for "${key}": ${error.message}`,
      };
    }
  }

  /**
   * Simulate keyboard events on an element or document
   * @param {string} keysSequenceString - String representation of key(s) (e.g., "Enter", "Ctrl+C, A, B")
   * @param {Element} targetElement - Element to dispatch events on (optional)
   * @param {number} delay - Delay between key sequences in milliseconds (optional)
   * @returns {Promise<Object>} - Result of the keyboard operation
   */
  /**
   * Insert literal text at the caret of an editable element, firing the same
   * beforeinput/input events a real keystroke produces.
   */
  function insertTextAtCaret(element, text) {
    const isTextControl =
      element instanceof HTMLTextAreaElement ||
      (element instanceof HTMLInputElement && typeof element.selectionStart === 'number');
    if (isTextControl) {
      const start = element.selectionStart ?? element.value.length;
      const end = element.selectionEnd ?? element.value.length;
      element.dispatchEvent(
        new InputEvent('beforeinput', { inputType: 'insertText', data: text, bubbles: true, cancelable: true }),
      );
      element.setRangeText(text, start, end, 'end');
      element.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: text, bubbles: true }));
      return true;
    }
    if (element.isContentEditable) {
      return document.execCommand('insertText', false, text);
    }
    return false;
  }

  /**
   * Type literal text character by character: key events for each character
   * plus the text insertion that synthetic key events alone never perform.
   */
  async function typeText(text, element, delay) {
    const results = [];
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const keyInfo =
        ch === ' '
          ? { ...SPECIAL_KEY_MAP.space, modifiers: {} }
          : ch === '\n'
            ? { ...SPECIAL_KEY_MAP.enter, modifiers: {} }
            : {
                key: ch,
                code: /[a-z]/i.test(ch) ? `Key${ch.toUpperCase()}` : '',
                keyCode: ch.toUpperCase().charCodeAt(0),
                charCode: ch.charCodeAt(0),
                modifiers: { shiftKey: ch !== ch.toLowerCase() },
              };
      const dispatchResult = dispatchKeyEvents(keyInfo, element);
      if (dispatchResult.success && ch !== '\n') insertTextAtCaret(element, ch);
      results.push({ keyCombination: ch, ...dispatchResult });
      if (delay > 0 && i < text.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    return results;
  }

  function resolveTarget(selector, selectorType) {
    if (selectorType === 'xpath') {
      return document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
        .singleNodeValue;
    }
    return document.querySelector(selector);
  }

  async function simulateKeyboard(keysSequenceString, targetElement = null, delay = 0, literalText = false) {
    try {
      const element = targetElement || document.activeElement || document.body;

      if (element !== document.activeElement && typeof element.focus === 'function') {
        element.focus();
        await new Promise((resolve) => setTimeout(resolve, 50)); // Small delay for focus
      }

      if (literalText) {
        const typedResults = await typeText(keysSequenceString, element, delay);
        const typedOk = typedResults.every((r) => r.success);
        return {
          success: typedOk,
          message: typedOk
            ? `Text typed successfully: ${keysSequenceString}`
            : `Some keyboard events failed for: ${keysSequenceString}`,
          results: typedResults,
          targetElement: { tagName: element.tagName, id: element.id, className: element.className, type: element.type },
        };
      }

      const keyCombinations = keysSequenceString
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k.length > 0);
      const operationResults = [];

      for (let i = 0; i < keyCombinations.length; i++) {
        const comboString = keyCombinations[i];
        const parsedKeyInfo = parseSingleKeyCombination(comboString);

        if (!parsedKeyInfo && !comboString.includes('+')) {
          // Not a key name: type the segment as literal text (e.g. "Hello World").
          operationResults.push(...(await typeText(comboString, element, delay)));
          continue;
        }

        if (!parsedKeyInfo) {
          operationResults.push({
            keyCombination: comboString,
            success: false,
            error: `Invalid key string or combination: ${comboString}`,
          });
          continue; // Skip to next combination in sequence
        }

        const dispatchResult = dispatchKeyEvents(parsedKeyInfo, element);
        operationResults.push({
          keyCombination: comboString,
          ...dispatchResult,
        });

        if (dispatchResult.error) {
          // Optionally, decide if sequence should stop on first error
          // For now, we continue but log the error in results
          console.warn(
            `Failed to simulate key combination "${comboString}": ${dispatchResult.error}`,
          );
        }

        if (delay > 0 && i < keyCombinations.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      // Check if all individual operations were successful
      const overallSuccess = operationResults.every((r) => r.success);

      return {
        success: overallSuccess,
        message: overallSuccess
          ? `Keyboard events simulated successfully: ${keysSequenceString}`
          : `Some keyboard events failed for: ${keysSequenceString}`,
        results: operationResults, // Detailed results for each key combination
        targetElement: {
          tagName: element.tagName,
          id: element.id,
          className: element.className,
          type: element.type, // if applicable e.g. for input
        },
      };
    } catch (error) {
      console.error('Error in simulateKeyboard:', error);
      return {
        success: false,
        error: `Error simulating keyboard events: ${error.message}`,
        results: [],
      };
    }
  }

  // Listener for messages from the extension
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === 'simulateKeyboard') {
      let targetEl = null;
      if (request.selector) {
        try {
          targetEl = resolveTarget(request.selector, request.selectorType);
        } catch (queryError) {
          sendResponse({
            success: false,
            error: `Invalid selector "${request.selector}": ${queryError.message}`,
            results: [],
          });
          return false; // Synchronous response already sent
        }
        if (!targetEl) {
          sendResponse({
            success: false,
            error: `Element with selector "${request.selector}" not found`,
            results: [],
          });
          return false; // Synchronous response already sent
        }
      }

      simulateKeyboard(request.keys, targetEl, request.delay, request.literalText === true)
        .then(sendResponse)
        .catch((error) => {
          // This catch is for unexpected errors in simulateKeyboard promise chain itself
          console.error('Unexpected error in simulateKeyboard promise chain:', error);
          sendResponse({
            success: false,
            error: `Unexpected error during keyboard simulation: ${error.message}`,
            results: [],
          });
        });
      return true; // Indicates async response is expected
    } else if (request.action === 'chrome_keyboard_ping') {
      sendResponse({ status: 'pong', initialized: true }); // Respond that it's initialized
      return false; // Synchronous response
    }
    // Not our message, or no async response needed
    return false;
  });
}
