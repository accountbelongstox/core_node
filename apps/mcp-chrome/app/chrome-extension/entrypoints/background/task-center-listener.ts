/**
 * Task Center Message Listener
 * Handles messages from popup to control the unified task center
 * Under 150 lines
 */

import { taskCenter, type TaskCenterConfig } from './services/task-center/TaskCenter';

/**
 * Initialize message listener for Task Center
 */
export function initTaskCenterListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'task_center') {
      handleTaskCenterMessage(message, sendResponse);
      return true; // Keep message channel open for async response
    }
  });

  console.log('[Task Center Listener] Initialized');
}

/**
 * Handle Task Center messages
 */
async function handleTaskCenterMessage(
  message: { type: string; action: string; config?: TaskCenterConfig; processorType?: string },
  sendResponse: (response: any) => void,
) {
  try {
    switch (message.action) {
      case 'start': {
        if (!message.config) {
          sendResponse({
            success: false,
            error: 'Config is required to start Task Center',
          });
          return;
        }

        await taskCenter.startAll(message.config);
        sendResponse({
          success: true,
          message: 'Task Center started',
        });
        break;
      }

      case 'stop': {
        taskCenter.stopAll();
        sendResponse({
          success: true,
          message: 'Task Center stopped',
        });
        break;
      }

      case 'get_status': {
        const status = taskCenter.getStatus();
        sendResponse({
          success: true,
          ...status,
        });
        break;
      }

      case 'enable_processor': {
        if (!message.processorType) {
          sendResponse({
            success: false,
            error: 'Processor type is required',
          });
          return;
        }

        taskCenter.enableProcessor(message.processorType);
        sendResponse({
          success: true,
          message: `Processor ${message.processorType} enabled`,
        });
        break;
      }

      case 'disable_processor': {
        if (!message.processorType) {
          sendResponse({
            success: false,
            error: 'Processor type is required',
          });
          return;
        }

        taskCenter.disableProcessor(message.processorType);
        sendResponse({
          success: true,
          message: `Processor ${message.processorType} disabled`,
        });
        break;
      }

      case 'start_processor': {
        if (!message.processorType) {
          sendResponse({
            success: false,
            error: 'Processor type is required',
          });
          return;
        }

        await taskCenter.startProcessor(message.processorType, message.config);
        sendResponse({
          success: true,
          message: `Processor ${message.processorType} started`,
        });
        break;
      }

      case 'stop_processor': {
        if (!message.processorType) {
          sendResponse({
            success: false,
            error: 'Processor type is required',
          });
          return;
        }

        taskCenter.stopProcessor(message.processorType);
        sendResponse({
          success: true,
          message: `Processor ${message.processorType} stopped`,
        });
        break;
      }

      default: {
        sendResponse({
          success: false,
          error: `Unknown action: ${message.action}`,
        });
      }
    }
  } catch (error: any) {
    console.error('[Task Center Listener] Error:', error);
    sendResponse({
      success: false,
      error: error.message || 'Unknown error',
    });
  }
}
