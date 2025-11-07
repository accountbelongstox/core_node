import { computed } from 'vue';
import { useScriptStore } from '../stores_app_pymatrix/scriptStore';
import type { ScriptStep, ScriptStepType, ScriptStepData } from '@/types/pymatrix';

/**
 * Script Recorder Composable
 *
 * Provides functionality to record device interactions and convert them to script steps.
 * This composable wraps device control actions and captures them when recording is active.
 */
export function useScriptRecorder() {
  const scriptStore = useScriptStore();

  const isRecording = computed(() => scriptStore.recordingState.isRecording);
  const recordingDeviceSerial = computed(() => scriptStore.recordingState.deviceSerial);

  /**
   * Generate a unique step ID
   */
  function generateStepId(): string {
    return `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a script step from recorded data
   */
  function createScriptStep(
    type: ScriptStepType,
    name: string,
    data: ScriptStepData,
    description?: string,
    delay: number = 500
  ): ScriptStep {
    return {
      id: generateStepId(),
      type,
      name,
      description,
      data,
      delay,
      enabled: true
    };
  }

  /**
   * Record a touch action
   */
  function recordTouch(
    action: 'down' | 'up' | 'move' | 'tap' | 'long_press',
    x: number,
    y: number,
    duration?: number
  ) {
    if (!isRecording.value) return;

    const step = createScriptStep(
      'touch',
      `Touch ${action} at (${x}, ${y})`,
      {
        action,
        x,
        y,
        duration
      },
      `Perform ${action} touch action at coordinates (${x}, ${y})`
    );

    scriptStore.addRecordedStep(step);
  }

  /**
   * Record a key press
   */
  function recordKey(
    action: 'down' | 'up',
    keyCode: number,
    keyName: string
  ) {
    if (!isRecording.value) return;

    const step = createScriptStep(
      'key',
      `Key ${action}: ${keyName}`,
      {
        action,
        keyCode,
        keyName
      },
      `Press ${keyName} key (code: ${keyCode})`
    );

    scriptStore.addRecordedStep(step);
  }

  /**
   * Record text input
   */
  function recordText(text: string) {
    if (!isRecording.value) return;

    const step = createScriptStep(
      'text',
      `Input text: "${text.substring(0, 20)}${text.length > 20 ? '...' : ''}"`,
      {
        text
      },
      `Input text: ${text}`,
      300 // Shorter delay for text input
    );

    scriptStore.addRecordedStep(step);
  }

  /**
   * Record a swipe gesture
   */
  function recordSwipe(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    swipeDuration: number = 300
  ) {
    if (!isRecording.value) return;

    const step = createScriptStep(
      'swipe',
      `Swipe from (${startX}, ${startY}) to (${endX}, ${endY})`,
      {
        startX,
        startY,
        endX,
        endY,
        swipeDuration
      },
      `Swipe gesture over ${swipeDuration}ms`
    );

    scriptStore.addRecordedStep(step);
  }

  /**
   * Record a system key action
   */
  function recordSystemKey(
    systemKey: 'home' | 'back' | 'recent' | 'power' | 'volume_up' | 'volume_down'
  ) {
    if (!isRecording.value) return;

    const step = createScriptStep(
      'system',
      `System key: ${systemKey}`,
      {
        systemKey
      },
      `Press ${systemKey} system key`
    );

    scriptStore.addRecordedStep(step);
  }

  /**
   * Record a wait/delay action
   */
  function recordWait(waitDuration: number) {
    if (!isRecording.value) return;

    const step = createScriptStep(
      'wait',
      `Wait ${waitDuration}ms`,
      {
        waitDuration
      },
      `Pause execution for ${waitDuration}ms`,
      0 // No additional delay after wait step
    );

    scriptStore.addRecordedStep(step);
  }

  /**
   * Record a screenshot action
   */
  function recordScreenshot(format: 'png' | 'jpg' = 'png') {
    if (!isRecording.value) return;

    const step = createScriptStep(
      'screenshot',
      `Take screenshot (${format})`,
      {
        screenshotFormat: format
      },
      `Capture screen as ${format}`
    );

    scriptStore.addRecordedStep(step);
  }

  /**
   * Record a clipboard action
   */
  function recordClipboard(
    clipboardAction: 'set' | 'get',
    clipboardText?: string
  ) {
    if (!isRecording.value) return;

    const step = createScriptStep(
      'clipboard',
      clipboardAction === 'set'
        ? `Set clipboard: "${clipboardText?.substring(0, 20)}${(clipboardText?.length || 0) > 20 ? '...' : ''}"`
        : 'Get clipboard',
      {
        clipboardAction,
        clipboardText
      },
      clipboardAction === 'set'
        ? `Set clipboard to: ${clipboardText}`
        : 'Read clipboard content'
    );

    scriptStore.addRecordedStep(step);
  }

  /**
   * Start recording on a device
   */
  function startRecording(deviceSerial: string) {
    scriptStore.startRecording(deviceSerial);
    console.log(`[Script Recorder] Started recording on device: ${deviceSerial}`);
  }

  /**
   * Stop recording and create a script from recorded steps
   */
  function stopRecording(scriptName?: string, scriptDescription?: string) {
    const recordedSteps = scriptStore.recordingState.recordedSteps;
    const deviceSerial = scriptStore.recordingState.deviceSerial;

    if (recordedSteps.length === 0) {
      console.warn('[Script Recorder] No steps recorded');
      scriptStore.stopRecording();
      return null;
    }

    // Create a script from recorded steps
    const script = scriptStore.createScript({
      name: scriptName || `Recorded Script ${new Date().toLocaleString()}`,
      description: scriptDescription || `Recorded on device ${deviceSerial} with ${recordedSteps.length} steps`,
      category: 'automation',
      tags: ['recorded', deviceSerial || ''],
      steps: recordedSteps,
      targetDevices: deviceSerial ? [deviceSerial] : [],
      loopEnabled: false,
      scheduleEnabled: false
    });

    scriptStore.stopRecording();
    scriptStore.setCurrentScript(script.id);

    console.log(`[Script Recorder] Created script "${script.name}" with ${recordedSteps.length} steps`);
    return script;
  }

  /**
   * Cancel recording without creating a script
   */
  function cancelRecording() {
    scriptStore.stopRecording();
    console.log('[Script Recorder] Recording cancelled');
  }

  /**
   * Get recording statistics
   */
  const recordingStats = computed(() => {
    if (!isRecording.value) {
      return null;
    }

    const steps = scriptStore.recordingState.recordedSteps;
    const startTime = scriptStore.recordingState.startTime;
    const duration = startTime ? Date.now() - startTime : 0;

    const stepsByType = steps.reduce((acc, step) => {
      acc[step.type] = (acc[step.type] || 0) + 1;
      return acc;
    }, {} as Record<ScriptStepType, number>);

    return {
      totalSteps: steps.length,
      duration,
      stepsByType,
      deviceSerial: recordingDeviceSerial.value
    };
  });

  return {
    // State
    isRecording,
    recordingDeviceSerial,
    recordingStats,

    // Recording control
    startRecording,
    stopRecording,
    cancelRecording,

    // Step recording functions
    recordTouch,
    recordKey,
    recordText,
    recordSwipe,
    recordSystemKey,
    recordWait,
    recordScreenshot,
    recordClipboard
  };
}
