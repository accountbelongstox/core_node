/**
 * DeepSeek Chat Task Handler
 * Processes DeepSeek chat tasks using the unified task queue
 */

import type { ITaskHandler } from '../ITaskHandler';
import { TaskType, type Task, type DeepSeekTaskDetails } from '../types';
import { deepseekSendPromptTool } from '@/entrypoints/background/tools/browser/deepseek';

/**
 * DeepSeek chat result
 */
interface DeepSeekChatResult {
  conversationUrl?: string;
  response: string;
  taskId?: string;
  error?: string;
}

/**
 * DeepSeek Handler
 * Sends prompts to DeepSeek chat and retrieves responses
 */
export class DeepSeekHandler implements ITaskHandler<DeepSeekTaskDetails> {
  readonly type = TaskType.DEEPSEEK_CHAT;
  readonly name = 'DeepSeek Chat Handler';

  /**
   * Execute DeepSeek chat task
   */
  async execute(
    task: Task<DeepSeekTaskDetails>,
    onProgress?: (progress: number) => void,
  ): Promise<void> {
    const { prompt, conversationId, model, attachments, options } = task.details;

    if (!prompt || prompt.trim() === '') {
      throw new Error('Prompt is required');
    }

    console.log(`[DeepSeekHandler] Sending prompt: ${prompt.substring(0, 100)}...`);

    try {
      // Update progress: starting
      onProgress?.(10);

      // Prepare attachment file paths if provided
      const attachmentPaths =
        attachments && attachments.length > 0 ? attachments.map(a => a.url) : undefined;

      // Send prompt to DeepSeek and wait for completion
      const toolResult = await deepseekSendPromptTool.execute({
        prompt,
        attachments: attachmentPaths,
        waitForCompletion: true, // Always wait for completion
        timeout: options?.timeout || 300000, // Default 5 minutes
        autoRetry: true,
      });

      // Update progress: sent, waiting for response
      onProgress?.(50);

      if (toolResult.isError) {
        // Tool execution failed
        const errorText = toolResult.content[0]?.text || 'Unknown error';
        throw new Error(errorText);
      }

      // Parse result
      const resultData = JSON.parse(toolResult.content[0]?.text || '{}');

      // Update progress: received response
      onProgress?.(90);

      if (resultData.status === 'completed') {
        // Task completed successfully
        const result: DeepSeekChatResult = {
          conversationUrl: resultData.conversationUrl,
          response: resultData.result?.response || resultData.result || '',
          taskId: resultData.taskId,
        };

        // Store result in task
        task.result = result;

        console.log(
          `[DeepSeekHandler] Completed successfully. Response length: ${result.response.length}`,
        );
      } else if (resultData.status === 'failed') {
        // Task failed
        throw new Error(resultData.result?.error || 'DeepSeek task failed');
      } else {
        // Unknown status
        throw new Error(`Unexpected task status: ${resultData.status}`);
      }

      // Update progress: done
      onProgress?.(100);
    } catch (error: any) {
      console.error('[DeepSeekHandler] Error:', error);
      throw new Error(
        `Failed to process DeepSeek chat: ${error.message || String(error)}`,
      );
    }
  }

  /**
   * Validate task details
   */
  validate(details: DeepSeekTaskDetails): true | string {
    if (!details.prompt || typeof details.prompt !== 'string') {
      return 'Invalid prompt: must be a non-empty string';
    }

    if (details.prompt.trim() === '') {
      return 'Prompt cannot be empty';
    }

    if (details.attachments && !Array.isArray(details.attachments)) {
      return 'Invalid attachments: must be an array';
    }

    if (details.attachments) {
      for (const attachment of details.attachments) {
        if (!attachment.name || !attachment.url || !attachment.type) {
          return 'Invalid attachment: name, url, and type are required';
        }
      }
    }

    if (details.options) {
      if (
        details.options.temperature !== undefined &&
        (details.options.temperature < 0 || details.options.temperature > 2)
      ) {
        return 'Invalid temperature: must be between 0 and 2';
      }

      if (
        details.options.maxTokens !== undefined &&
        details.options.maxTokens < 1
      ) {
        return 'Invalid maxTokens: must be at least 1';
      }
    }

    return true;
  }

  /**
   * Check if handler is ready
   */
  async isReady(): Promise<boolean> {
    // Check if Chrome tabs and scripting APIs are available
    if (!chrome?.tabs || !chrome?.scripting) {
      console.error('[DeepSeekHandler] Chrome tabs/scripting API not available');
      return false;
    }

    return true;
  }

  /**
   * Cancel a running task (optional)
   */
  async cancel(taskId: string): Promise<void> {
    console.log(`[DeepSeekHandler] Cancelling task: ${taskId}`);
    // Note: The old DeepSeek task queue uses a different task ID system
    // We cannot directly cancel the underlying DeepSeek task from here
    // The cancellation will be handled by the LocalTaskQueue
  }
}
