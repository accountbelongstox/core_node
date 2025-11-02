import { ref, computed } from 'vue';
import { useScriptStore } from '../stores_app_pymatrix/scriptStore';
import { useRecordableDeviceControl } from './useRecordableDeviceControl';
import type { Script, ScriptStep, ScriptStepType } from '../../../types/pymatrix';

/**
 * Script Executor Composable
 *
 * Executes scripts step-by-step on target devices with pause/resume/stop controls.
 */
export function useScriptExecutor() {
  const scriptStore = useScriptStore();

  // Execution state management
  const executionTimers = new Map<string, NodeJS.Timeout>();
  const pausedExecutions = new Map<string, { scriptId: string; stepIndex: number }>();

  /**
   * Execute a single script step on a device
   */
  async function executeStep(
    step: ScriptStep,
    deviceSerial: string,
    deviceControl: ReturnType<typeof useRecordableDeviceControl>
  ): Promise<boolean> {
    if (!step.enabled) {
      console.log(`[Script Executor] Skipping disabled step: ${step.name}`);
      return true;
    }

    console.log(`[Script Executor] Executing step: ${step.type} - ${step.name}`);

    try {
      switch (step.type) {
        case 'touch':
          if (step.data.action === 'tap' && step.data.x !== undefined && step.data.y !== undefined) {
            // Assuming screen size of 1080x2340 (can be made dynamic later)
            deviceControl.sendTap(step.data.x, step.data.y, 1080, 2340);
          } else if (step.data.action === 'long_press' && step.data.x !== undefined && step.data.y !== undefined) {
            deviceControl.sendLongPress(step.data.x, step.data.y, 1080, 2340, step.data.duration || 1000);
          } else if (step.data.action && step.data.x !== undefined && step.data.y !== undefined) {
            deviceControl.sendTouch(step.data.action as 'down' | 'up' | 'move', step.data.x, step.data.y, 1080, 2340);
          }
          break;

        case 'key':
          if (step.data.keyCode !== undefined) {
            deviceControl.sendKey('down', step.data.keyCode, step.data.keyName);
            setTimeout(() => {
              deviceControl.sendKey('up', step.data.keyCode!, step.data.keyName);
            }, 50);
          }
          break;

        case 'text':
          if (step.data.text) {
            deviceControl.sendText(step.data.text);
          }
          break;

        case 'swipe':
          if (step.data.startX !== undefined && step.data.startY !== undefined &&
              step.data.endX !== undefined && step.data.endY !== undefined) {
            deviceControl.sendSwipe(
              step.data.startX,
              step.data.startY,
              step.data.endX,
              step.data.endY,
              step.data.swipeDuration || 300
            );
          }
          break;

        case 'system':
          if (step.data.systemKey) {
            deviceControl.sendSystemKey(step.data.systemKey);
          }
          break;

        case 'wait':
          if (step.data.waitDuration) {
            await new Promise(resolve => setTimeout(resolve, step.data.waitDuration!));
          }
          break;

        case 'screenshot':
          // Record screenshot action (doesn't send to device directly)
          deviceControl.recordScreenshot(step.data.screenshotFormat || 'png');
          break;

        case 'clipboard':
          if (step.data.clipboardAction === 'set' && step.data.clipboardText) {
            deviceControl.sendClipboard(step.data.clipboardText);
          } else if (step.data.clipboardAction === 'get') {
            deviceControl.requestClipboard();
          }
          break;

        default:
          console.warn(`[Script Executor] Unknown step type: ${step.type}`);
          return false;
      }

      return true;
    } catch (error) {
      console.error(`[Script Executor] Error executing step ${step.name}:`, error);
      return false;
    }
  }

  /**
   * Execute a script on a device
   */
  async function executeScript(
    scriptId: string,
    deviceSerial: string,
    baseUrl: string = 'ws://localhost:8000'
  ): Promise<void> {
    const script = scriptStore.getScriptById(scriptId);
    if (!script) {
      console.error(`[Script Executor] Script not found: ${scriptId}`);
      return;
    }

    // Initialize device control (with recording disabled during playback)
    const deviceControl = useRecordableDeviceControl({
      deviceSerial,
      baseUrl,
      enableRecording: false
    });

    // Connect to device
    deviceControl.connect();

    // Start execution
    scriptStore.startExecution(scriptId, deviceSerial);

    // Execute steps
    await executeSteps(script, deviceSerial, deviceControl);
  }

  /**
   * Execute script steps sequentially
   */
  async function executeSteps(
    script: Script,
    deviceSerial: string,
    deviceControl: ReturnType<typeof useRecordableDeviceControl>,
    startFromIndex: number = 0
  ): Promise<void> {
    const executionKey = `${script.id}_${deviceSerial}`;

    for (let i = startFromIndex; i < script.steps.length; i++) {
      const step = script.steps[i];

      // Check if execution was stopped
      const executionState = scriptStore.executionStates[deviceSerial];
      if (!executionState || executionState.status !== 'running') {
        console.log(`[Script Executor] Execution stopped at step ${i}`);
        break;
      }

      // Check if execution was paused
      if (executionState.status === 'paused') {
        pausedExecutions.set(executionKey, { scriptId: script.id, stepIndex: i });
        console.log(`[Script Executor] Execution paused at step ${i}`);
        break;
      }

      // Update progress
      scriptStore.updateExecutionProgress(deviceSerial, i);

      // Execute step
      const success = await executeStep(step, deviceSerial, deviceControl);

      if (!success) {
        scriptStore.failExecution(deviceSerial, `Failed to execute step: ${step.name}`);
        return;
      }

      // Wait for step delay
      if (step.delay > 0 && i < script.steps.length - 1) {
        await new Promise(resolve => {
          const timer = setTimeout(resolve, step.delay);
          executionTimers.set(executionKey, timer);
        });
        executionTimers.delete(executionKey);
      }
    }

    // Check if we should loop
    const executionState = scriptStore.executionStates[deviceSerial];
    if (executionState && executionState.status === 'running') {
      if (script.loopEnabled) {
        const currentLoop = executionState.loopIteration || 1;
        if (!script.loopCount || currentLoop < script.loopCount) {
          console.log(`[Script Executor] Starting loop iteration ${currentLoop + 1}`);
          scriptStore.updateExecutionProgress(deviceSerial, 0, currentLoop + 1);
          // Restart from beginning
          await executeSteps(script, deviceSerial, deviceControl, 0);
          return;
        }
      }

      // Execution completed
      scriptStore.completeExecution(deviceSerial);
      console.log(`[Script Executor] Script execution completed: ${script.name}`);
    }
  }

  /**
   * Pause script execution
   */
  function pauseExecution(deviceSerial: string): boolean {
    return scriptStore.pauseExecution(deviceSerial);
  }

  /**
   * Resume script execution
   */
  async function resumeExecution(
    deviceSerial: string,
    baseUrl: string = 'ws://localhost:8000'
  ): Promise<void> {
    const executionState = scriptStore.executionStates[deviceSerial];
    if (!executionState) {
      console.error(`[Script Executor] No execution state found for device: ${deviceSerial}`);
      return;
    }

    scriptStore.resumeExecution(deviceSerial);

    const executionKey = `${executionState.scriptId}_${deviceSerial}`;
    const pausedState = pausedExecutions.get(executionKey);

    if (!pausedState) {
      console.error(`[Script Executor] No paused state found`);
      return;
    }

    pausedExecutions.delete(executionKey);

    const script = scriptStore.getScriptById(pausedState.scriptId);
    if (!script) {
      console.error(`[Script Executor] Script not found: ${pausedState.scriptId}`);
      return;
    }

    const deviceControl = useRecordableDeviceControl({
      deviceSerial,
      baseUrl,
      enableRecording: false
    });

    deviceControl.connect();

    // Resume from paused step
    await executeSteps(script, deviceSerial, deviceControl, pausedState.stepIndex);
  }

  /**
   * Stop script execution
   */
  function stopExecution(deviceSerial: string): void {
    const executionState = scriptStore.executionStates[deviceSerial];
    if (!executionState) return;

    const executionKey = `${executionState.scriptId}_${deviceSerial}`;

    // Clear any pending timers
    const timer = executionTimers.get(executionKey);
    if (timer) {
      clearTimeout(timer);
      executionTimers.delete(executionKey);
    }

    // Remove paused state
    pausedExecutions.delete(executionKey);

    // Mark as completed
    scriptStore.completeExecution(deviceSerial);

    console.log(`[Script Executor] Execution stopped for device: ${deviceSerial}`);
  }

  /**
   * Execute script on multiple devices
   */
  async function executeScriptOnDevices(
    scriptId: string,
    deviceSerials: string[],
    baseUrl: string = 'ws://localhost:8000'
  ): Promise<void> {
    const script = scriptStore.getScriptById(scriptId);
    if (!script) {
      console.error(`[Script Executor] Script not found: ${scriptId}`);
      return;
    }

    console.log(`[Script Executor] Executing script on ${deviceSerials.length} devices`);

    // Execute on all devices in parallel
    await Promise.all(
      deviceSerials.map(serial => executeScript(scriptId, serial, baseUrl))
    );
  }

  return {
    executeScript,
    executeScriptOnDevices,
    pauseExecution,
    resumeExecution,
    stopExecution
  };
}
