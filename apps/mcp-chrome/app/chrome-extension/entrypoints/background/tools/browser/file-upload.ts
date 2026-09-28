import { createErrorResponse, createJsonResponse, toErrorMessage, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';
import { prepareFirefoxUploadFile } from './file-upload-firefox';

const FILE_UPLOAD_HELPER_SCRIPT = 'inject-scripts/file-upload-helper.js';

interface FileUploadToolParams {
  selector: string; // CSS selector for the file input element
  filePath?: string; // Local file path
  fileUrl?: string; // URL to download file from
  base64Data?: string; // Base64 encoded file data
  fileName?: string; // Optional filename when using base64 or URL
  multiple?: boolean; // Whether to allow multiple files
}

/**
 * Tool for uploading files to web forms using Chrome DevTools Protocol
 * Similar to Playwright's setInputFiles implementation
 */
class FileUploadTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.FILE_UPLOAD;
  private activeDebuggers: Map<number, boolean> = new Map();

  constructor() {
    super();
    // Clean up debuggers on tab removal
    chrome.tabs.onRemoved.addListener((tabId) => {
      if (this.activeDebuggers.has(tabId)) {
        this.cleanupDebugger(tabId);
      }
    });
  }

  /**
   * Execute file upload operation using Chrome DevTools Protocol
   */
  async execute(args: FileUploadToolParams): Promise<ToolResult> {
    const { selector, filePath, fileUrl, base64Data, fileName, multiple = false } = args;

    console.log(`Starting file upload operation with options:`, args);

    // Validate input
    if (!selector) {
      return createErrorResponse('Selector is required for file upload');
    }

    if (!filePath && !fileUrl && !base64Data) {
      return createErrorResponse(
        'One of filePath, fileUrl, or base64Data must be provided',
      );
    }

    // Firefox has no chrome.debugger/CDP: materialize the file bytes in the
    // background and set input.files from a content script instead.
    if (import.meta.env.FIREFOX) {
      return this.executeFirefox(args);
    }

    let tabId: number | undefined;

    try {
      // Get current tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]?.id) {
        return createErrorResponse('No active tab found');
      }
      tabId = tabs[0].id;

      // Prepare file paths
      let files: string[] = [];

      if (filePath) {
        // Direct file path provided
        files = [filePath];
      } else if (fileUrl || base64Data) {
        // For URL or base64, we need to use the native messaging host
        // to download or save the file temporarily
        const tempFilePath = await this.prepareFileFromRemote({
          fileUrl,
          base64Data,
          fileName: fileName || 'uploaded-file',
        });
        if (!tempFilePath) {
          return createErrorResponse('Failed to prepare file for upload');
        }
        files = [tempFilePath];
      }

      // Attach debugger to the tab
      await this.attachDebugger(tabId);

      // Enable necessary CDP domains
      await chrome.debugger.sendCommand({ tabId }, 'DOM.enable', {});
      await chrome.debugger.sendCommand({ tabId }, 'Runtime.enable', {});

      // Get the document
      const { root } = await chrome.debugger.sendCommand(
        { tabId },
        'DOM.getDocument',
        { depth: -1, pierce: true },
      ) as { root: { nodeId: number } };

      // Find the file input element using the selector
      const { nodeId } = await chrome.debugger.sendCommand(
        { tabId },
        'DOM.querySelector',
        {
          nodeId: root.nodeId,
          selector: selector,
        },
      ) as { nodeId: number };

      if (!nodeId || nodeId === 0) {
        throw new Error(`Element with selector "${selector}" not found`);
      }

      // Verify it's actually a file input
      const { node } = await chrome.debugger.sendCommand(
        { tabId },
        'DOM.describeNode',
        { nodeId },
      ) as { node: { nodeName: string; attributes?: string[] } };

      if (node.nodeName !== 'INPUT') {
        throw new Error(`Element with selector "${selector}" is not an input element`);
      }

      // Check if it's a file input by looking for type="file" in attributes
      const attributes = node.attributes || [];
      let isFileInput = false;
      for (let i = 0; i < attributes.length; i += 2) {
        if (attributes[i] === 'type' && attributes[i + 1] === 'file') {
          isFileInput = true;
          break;
        }
      }

      if (!isFileInput) {
        throw new Error(`Element with selector "${selector}" is not a file input (type="file")`);
      }

      // Set the files on the input element
      // This is the key CDP command that Playwright and Puppeteer use
      await chrome.debugger.sendCommand(
        { tabId },
        'DOM.setFileInputFiles',
        {
          nodeId: nodeId,
          files: files,
        },
      );

      // Trigger change event to ensure the page reacts to the file upload.
      // Embed the selector via JSON.stringify so backslashes and other
      // JS-string-special characters in valid CSS selectors (e.g. escaped
      // attribute values) do not corrupt the string literal and silently make
      // querySelector return null.
      await chrome.debugger.sendCommand(
        { tabId },
        'Runtime.evaluate',
        {
          expression: `
            (function() {
              const element = document.querySelector(${JSON.stringify(selector)});
              if (element) {
                const event = new Event('change', { bubbles: true });
                element.dispatchEvent(event);
                return true;
              }
              return false;
            })()
          `,
        },
      );

      // Clean up debugger
      await this.detachDebugger(tabId);

      return createJsonResponse({
        success: true,
        message: 'File(s) uploaded successfully',
        files,
        selector,
        fileCount: files.length,
      });
    } catch (error) {
      console.error('Error in file upload operation:', error);
      
      // Clean up debugger if attached
      if (tabId !== undefined && this.activeDebuggers.has(tabId)) {
        await this.detachDebugger(tabId);
      }

      return createErrorResponse(
        `Error uploading file: ${toErrorMessage(error)}`,
      );
    }
  }

  /**
   * Attach debugger to a tab.
   *
   * TargetInfo.extensionId is only populated for background_page targets, so
   * for page (tab) targets it is always undefined and cannot be used to tell
   * whether THIS extension attached the debugger. Instead: reuse an attachment
   * we already own this service-worker lifetime (activeDebuggers); otherwise
   * attempt to attach. A pre-existing attachment (a stale one left by a prior
   * service-worker lifetime that was killed mid-upload, or an overlapping
   * call) surfaces as "Another debugger is already attached" / "Cannot attach
   * to the target with an attached client" - recover by detaching (which only
   * affects this extension's own attachment) and reattaching. A genuine
   * DevTools/third-party attachment survives the detach and rethrows.
   */
  private async attachDebugger(tabId: number): Promise<void> {
    // Reuse an attachment this extension already owns in the current lifetime.
    if (this.activeDebuggers.has(tabId)) {
      console.log(`Debugger already attached to tab ${tabId} by this extension`);
      return;
    }

    try {
      await chrome.debugger.attach({ tabId }, '1.3');
    } catch (error: any) {
      const msg = error?.message || String(error);
      const alreadyAttached =
        msg.includes('Another debugger') ||
        msg.includes('Cannot attach to the target with an attached client');
      if (!alreadyAttached) {
        throw error;
      }
      // A stale self-attachment (e.g. SW killed mid-upload) blocks reattach.
      // detach only tears down this extension's own connection, then retry.
      try {
        await chrome.debugger.detach({ tabId });
      } catch {
        // detach throws if this extension never attached (e.g. DevTools owns
        // it); fall through so the reattach error below surfaces.
      }
      try {
        await chrome.debugger.attach({ tabId }, '1.3');
      } catch (reattachError: any) {
        const rmsg = reattachError?.message || String(reattachError);
        if (
          rmsg.includes('Another debugger') ||
          rmsg.includes('Cannot attach to the target with an attached client')
        ) {
          throw new Error(
            'Debugger is already attached to this tab by another extension or DevTools',
          );
        }
        throw reattachError;
      }
    }
    this.activeDebuggers.set(tabId, true);
    console.log(`Debugger attached to tab ${tabId}`);
  }

  /**
   * Detach debugger from a tab
   */
  private async detachDebugger(tabId: number): Promise<void> {
    if (!this.activeDebuggers.has(tabId)) {
      return;
    }

    try {
      await chrome.debugger.detach({ tabId });
      console.log(`Debugger detached from tab ${tabId}`);
    } catch (error) {
      console.warn(`Error detaching debugger from tab ${tabId}:`, error);
    } finally {
      this.activeDebuggers.delete(tabId);
    }
  }

  /**
   * Clean up debugger connection
   */
  private cleanupDebugger(tabId: number): void {
    this.activeDebuggers.delete(tabId);
  }

  /**
   * Firefox implementation: no CDP available. The file bytes are obtained in
   * the background context (native host chunked read for local paths, fetch
   * for URLs, direct decode for base64) and handed to an ISOLATED-world
   * content script that builds File objects via DataTransfer and assigns them
   * to the target input element, then dispatches input/change events.
   */
  private async executeFirefox(args: FileUploadToolParams): Promise<ToolResult> {
    const { selector, filePath, fileUrl, base64Data, fileName } = args;

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]?.id) {
        return createErrorResponse('No active tab found');
      }
      const tabId = tabs[0].id;

      const file = await prepareFirefoxUploadFile({ filePath, fileUrl, base64Data, fileName });

      await this.injectContentScript(tabId, [FILE_UPLOAD_HELPER_SCRIPT]);

      const result = await this.sendMessageToTab(tabId, {
        action: 'setFileInputFiles',
        selector: selector,
        files: [
          {
            name: file.name,
            type: file.type,
            lastModified: Date.now(),
            bytes: file.bytes,
          },
        ],
      });

      return createJsonResponse({
        success: true,
        message: 'File(s) uploaded successfully',
        files: [file.name],
        selector,
        fileCount: result?.fileCount ?? 1,
        size: file.size,
      });
    } catch (error) {
      console.error('Error in Firefox file upload operation:', error);
      return createErrorResponse(
        `Error uploading file: ${toErrorMessage(error)}`,
      );
    }
  }

  /**
   * Prepare file from URL or base64 data using native messaging host
   */
  private async prepareFileFromRemote(options: {
    fileUrl?: string;
    base64Data?: string;
    fileName: string;
  }): Promise<string | null> {
    const { fileUrl, base64Data, fileName } = options;

    return new Promise((resolve) => {
      const requestId = `file-upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const timeout = setTimeout(() => {
        console.error('File preparation request timed out');
        chrome.runtime.onMessage.removeListener(handleMessage);
        resolve(null);
      }, 30000); // 30 second timeout

      // Create listener for the response
      const handleMessage = (message: any) => {
        if (message.type === 'file_operation_response' && 
            message.responseToRequestId === requestId) {
          clearTimeout(timeout);
          chrome.runtime.onMessage.removeListener(handleMessage);
          
          if (message.payload?.success && message.payload?.filePath) {
            resolve(message.payload.filePath);
          } else {
            console.error('Native host failed to prepare file:', message.error || message.payload?.error);
            resolve(null);
          }
        }
      };

      // Add listener
      chrome.runtime.onMessage.addListener(handleMessage);

      // Send message to background script to forward to native host
      chrome.runtime.sendMessage({
        type: 'forward_to_native',
        message: {
          type: 'file_operation',
          requestId: requestId,
          payload: {
            action: 'prepareFile',
            fileUrl,
            base64Data,
            fileName,
          },
        },
      }).catch((error) => {
        console.error('Error sending message to background:', error);
        clearTimeout(timeout);
        chrome.runtime.onMessage.removeListener(handleMessage);
        resolve(null);
      });
    });
  }
}

export const fileUploadTool = new FileUploadTool();
