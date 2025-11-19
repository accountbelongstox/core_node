import { useScriptStore } from '../stores_app_pymatrix/scriptStore';
import { useRecordableDeviceControl } from './useRecordableDeviceControl';
import type { Script, ScriptStep } from '@/types/pymatrix';

const DEFAULT_BASE_URL = 'ws://localhost:8000';

interface PausedExecutionState {
  scriptId: string;
  stepIndex: number;
}

export function useScriptExecutor() {
  const scriptStore = useScriptStore();

  const executionTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const pausedExecutions = new Map<string, PausedExecutionState>();

  const createExecutionKey = (scriptId: string, deviceSerial: string) => `${scriptId}_${deviceSerial}`;

  const clearExecutionTimer = (key: string) => {
    const timer = executionTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      executionTimers.delete(key);
    }
  };

  const waitWithTimer = (key: string, duration: number) => {
    if (duration <= 0) {
      return Promise.resolve();
    }

    clearExecutionTimer(key);

    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        executionTimers.delete(key);
        resolve();
      }, duration);
      executionTimers.set(key, timer);
    });
  };

  async function executeStep(
    step: ScriptStep,
    deviceSerial: string,
    deviceControl: ReturnType<typeof useRecordableDeviceControl>,
    executionKey: string
  ): Promise<boolean> {
    if (!step.enabled) {
      console.log(`[Script Executor] Skipping disabled step: ${step.name}`);
      return true;
    }

    try {
      switch (step.type) {
        case 'touch': {
          if (step.data.action === 'tap' && step.data.x !== undefined && step.data.y !== undefined) {
            deviceControl.sendTap(step.data.x, step.data.y, 1080, 2340);
          } else if (
            step.data.action === 'long_press' &&
            step.data.x !== undefined &&
            step.data.y !== undefined
          ) {
            deviceControl.sendLongPress(
              step.data.x,
              step.data.y,
              1080,
              2340,
              step.data.duration || 1000
            );
          } else if (
            step.data.action &&
            step.data.x !== undefined &&
            step.data.y !== undefined
          ) {
            deviceControl.sendTouch(
              step.data.action as 'down' | 'up' | 'move',
              step.data.x,
              step.data.y,
              1080,
              2340
            );
          }
          break;
        }
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
          if (
            step.data.startX !== undefined &&
            step.data.startY !== undefined &&
            step.data.endX !== undefined &&
            step.data.endY !== undefined
          ) {
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
            await waitWithTimer(executionKey, step.data.waitDuration);
          }
          break;
        case 'screenshot':
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

  async function executeSteps(
    script: Script,
    deviceSerial: string,
    deviceControl: ReturnType<typeof useRecordableDeviceControl>,
    startIndex = 0
  ): Promise<void> {
    const executionKey = createExecutionKey(script.id, deviceSerial);

    for (let index = startIndex; index < script.steps.length; index += 1) {
      const executionState = scriptStore.getExecutionState(deviceSerial);

      if (!executionState) {
        console.warn('[Script Executor] Missing execution state, stopping run');
        return;
      }

      if (executionState.status === 'paused') {
        pausedExecutions.set(executionKey, {
          scriptId: script.id,
          stepIndex: index
        });
        return;
      }

      if (executionState.status !== 'running') {
        return;
      }

      scriptStore.updateExecutionProgress(deviceSerial, index);

      const step = script.steps[index];

      if (step.delay && step.delay > 0) {
        await waitWithTimer(executionKey, step.delay);
      }

      const success = await executeStep(step, deviceSerial, deviceControl, executionKey);

      if (!success) {
        scriptStore.completeExecution(deviceSerial, false);
        clearExecutionTimer(executionKey);
        return;
      }
    }

    const executionState = scriptStore.getExecutionState(deviceSerial);

    if (!executionState) {
      return;
    }

    if (executionState.status !== 'running') {
      return;
    }

    if (script.loopEnabled) {
      const currentLoop = executionState.loopIteration ?? 1;
      const hasMoreLoops = !script.loopCount || currentLoop < script.loopCount;

      if (hasMoreLoops) {
        executionState.loopIteration = currentLoop + 1;
        console.log(`[Script Executor] Loop iteration ${executionState.loopIteration} for ${script.name}`);
        await executeSteps(script, deviceSerial, deviceControl, 0);
        return;
      }
    }

    scriptStore.completeExecution(deviceSerial, true);
    clearExecutionTimer(executionKey);
    pausedExecutions.delete(executionKey);
  }

  async function executeScript(
    scriptId: string,
    deviceSerial: string,
    baseUrl: string = DEFAULT_BASE_URL
  ): Promise<void> {
    const script = scriptStore.getScriptById(scriptId);

    if (!script) {
      console.error('[Script Executor] Script not found:', scriptId);
      return;
    }

    const started = scriptStore.startExecution(scriptId, deviceSerial);
    if (!started) {
      return;
    }

    const executionKey = createExecutionKey(scriptId, deviceSerial);
    pausedExecutions.delete(executionKey);

    const deviceControl = useRecordableDeviceControl({
      deviceSerial,
      baseUrl,
      enableRecording: false
    });

    deviceControl.connect();

    await executeSteps(script, deviceSerial, deviceControl, 0);
  }

  async function executeScriptOnDevices(
    scriptId: string,
    deviceSerials: string[],
    baseUrl: string = DEFAULT_BASE_URL
  ): Promise<void> {
    if (deviceSerials.length === 0) {
      console.warn('[Script Executor] No devices selected for execution');
      return;
    }

    await Promise.all(
      deviceSerials.map(serial => executeScript(scriptId, serial, baseUrl))
    );
  }

  function pauseExecution(deviceSerial: string): boolean {
    const state = scriptStore.getExecutionState(deviceSerial);
    if (!state) {
      console.warn('[Script Executor] Cannot pause, no execution state');
      return false;
    }

    scriptStore.pauseExecution(deviceSerial);

    const executionKey = createExecutionKey(state.scriptId, deviceSerial);
    pausedExecutions.set(executionKey, {
      scriptId: state.scriptId,
      stepIndex: state.currentStepIndex
    });

    clearExecutionTimer(executionKey);

    return true;
  }

  async function resumeExecution(
    deviceSerial: string,
    baseUrl: string = DEFAULT_BASE_URL
  ): Promise<void> {
    const state = scriptStore.getExecutionState(deviceSerial);
    if (!state) {
      console.error('[Script Executor] Cannot resume, no execution state');
      return;
    }

    const executionKey = createExecutionKey(state.scriptId, deviceSerial);
    const pausedState = pausedExecutions.get(executionKey);

    if (!pausedState) {
      console.warn('[Script Executor] No paused state found for resume');
      return;
    }

    const script = scriptStore.getScriptById(pausedState.scriptId);
    if (!script) {
      console.error('[Script Executor] Script not found for resume:', pausedState.scriptId);
      return;
    }

    pausedExecutions.delete(executionKey);
    scriptStore.resumeExecution(deviceSerial);

    const deviceControl = useRecordableDeviceControl({
      deviceSerial,
      baseUrl,
      enableRecording: false
    });

    deviceControl.connect();

    await executeSteps(script, deviceSerial, deviceControl, pausedState.stepIndex);
  }

  function stopExecution(deviceSerial: string): void {
    const state = scriptStore.getExecutionState(deviceSerial);
    if (!state) {
      return;
    }

    const executionKey = createExecutionKey(state.scriptId, deviceSerial);
    clearExecutionTimer(executionKey);
    pausedExecutions.delete(executionKey);

    scriptStore.completeExecution(deviceSerial, false);
    scriptStore.clearExecutionState(deviceSerial);

    console.log('[Script Executor] Execution stopped for device:', deviceSerial);
  }

  return {
    executeScript,
    executeScriptOnDevices,
    pauseExecution,
    resumeExecution,
    stopExecution
  };
}
