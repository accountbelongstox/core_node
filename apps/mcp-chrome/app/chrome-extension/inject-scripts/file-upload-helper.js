/* eslint-disable */
// file-upload-helper.js
// Firefox path of the chrome_upload_file tool: receives file bytes from the
// background (structured clone, ArrayBuffer), builds File objects through
// DataTransfer and assigns them to the target <input type="file">.

if (window.__FILE_UPLOAD_HELPER_INITIALIZED__) {
  // Already initialized, skip
} else {
  window.__FILE_UPLOAD_HELPER_INITIALIZED__ = true;

  /**
   * Assign the provided files to a file input element and fire input/change.
   * @param {string} selector - CSS selector for the file input element
   * @param {Array<{name: string, type: string, lastModified: number, bytes: ArrayBuffer}>} fileEntries
   * @returns {Object} - Result of the operation
   */
  function setFileInputFiles(selector, fileEntries) {
    const element = document.querySelector(selector);
    if (!element) {
      return { error: `Element with selector "${selector}" not found` };
    }

    if (element.tagName !== 'INPUT') {
      return { error: `Element with selector "${selector}" is not an input element` };
    }

    if ((element.getAttribute('type') || '').toLowerCase() !== 'file') {
      return { error: `Element with selector "${selector}" is not a file input (type="file")` };
    }

    if (!Array.isArray(fileEntries) || fileEntries.length === 0) {
      return { error: 'No file data received' };
    }

    const dataTransfer = new DataTransfer();
    for (const entry of fileEntries) {
      const file = new File([entry.bytes], entry.name || 'uploaded-file', {
        type: entry.type || 'application/octet-stream',
        lastModified: entry.lastModified || Date.now(),
      });
      dataTransfer.items.add(file);
    }

    element.files = dataTransfer.files;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));

    return {
      success: true,
      fileCount: element.files.length,
      files: Array.from(element.files).map((f) => ({ name: f.name, size: f.size, type: f.type })),
    };
  }

  // Listen for messages from the extension
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === 'setFileInputFiles') {
      try {
        sendResponse(setFileInputFiles(request.selector, request.files));
      } catch (error) {
        sendResponse({ error: `Error setting file input files: ${error.message}` });
      }
      return false;
    } else if (request.action === 'chrome_upload_file_ping') {
      sendResponse({ status: 'pong' });
      return false;
    }
  });
}
