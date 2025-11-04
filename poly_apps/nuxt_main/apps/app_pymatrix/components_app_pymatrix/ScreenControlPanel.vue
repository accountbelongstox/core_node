<template>
  <div class="pm-panel pm-panel--cyan" v-if="isOpen">
    <div class="panel-header">
      <h3 class="panel-title">📱 Screen Control</h3>
      <button
        class="close-btn"
        @click="handleClose"
        title="Close"
      >
        ×
      </button>
    </div>

    <div class="control-sections">
      <!-- Power Control -->
      <div class="control-section">
        <div class="section-header">
          <div class="section-icon">⚡</div>
          <h4 class="section-title">Power</h4>
        </div>

        <div class="button-grid">
          <button
            class="pm-button pm-button--electric-blue"
            @click="handlePowerControl('on')"
          >
            🔆 Screen On
          </button>
          <button
            class="pm-button pm-button--electric-blue"
            @click="handlePowerControl('off')"
          >
            🌙 Screen Off
          </button>
        </div>
      </div>

      <!-- Brightness Control -->
      <div class="control-section">
        <div class="section-header">
          <div class="section-icon">💡</div>
          <h4 class="section-title">Brightness</h4>
        </div>

        <BaseSlider
          v-model="brightness"
          :min="0"
          :max="255"
          :step="1"
          variant="warning"
          show-value
          :formatter="(v) => `${Math.round((v / 255) * 100)}%`"
          @change="handleBrightnessChange"
        />

        <div class="preset-buttons">
          <button
            v-for="preset in brightnessPresets"
            :key="preset.value"
            class="pm-button pm-button--electric-blue"
            :class="{ active: brightness === preset.value }"
            @click="setBrightness(preset.value)"
          >
            {{ preset.label }}
          </button>
        </div>
      </div>

      <!-- Rotation Control -->
      <div class="control-section">
        <div class="section-header">
          <div class="section-icon">🔄</div>
          <h4 class="section-title">Rotation</h4>
        </div>

        <div class="rotation-grid">
          <button
            v-for="rotation in rotations"
            :key="rotation.value"
            class="rotation-btn"
            :class="{ active: currentRotation === rotation.value }"
            @click="handleRotationChange(rotation.value)"
            :title="`Rotate to ${rotation.label}`"
          >
            <div class="rotation-icon" :style="{ transform: `rotate(${rotation.value}deg)` }">
              📱
            </div>
            <span class="rotation-label">{{ rotation.label }}</span>
          </button>
        </div>

        <div class="auto-rotation-toggle">
          <BaseToggle
            v-model="autoRotation"
            label="Auto Rotation"
            label-icon="🔄"
            description="Enable automatic screen rotation based on device orientation"
            size="md"
            variant="warning"
            @change="handleAutoRotationChange"
          />
        </div>
      </div>

      <!-- Power Options -->
      <div class="control-section">
        <div class="section-header">
          <div class="section-icon">⏰</div>
          <h4 class="section-title">Power Options</h4>
        </div>

        <div class="toggle-list">
          <BaseToggle
            v-model="keepAwake"
            label="Keep Awake"
            label-icon="☀️"
            description="Prevent screen from sleeping"
            size="md"
            variant="warning"
            @change="handleKeepAwakeChange"
          />

          <BaseToggle
            v-model="autoSleep"
            label="Auto Sleep"
            label-icon="🌙"
            description="Auto sleep when disconnected"
            size="md"
            variant="warning"
            @change="handleAutoSleepChange"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useToast } from '../composables_app_pymatrix/useToast';
import { pyMatrixDeviceAPI } from '~/services/api/pymatrix/pymatrix-device-api';

const toast = useToast();

interface BrightnessPreset {
  label: string;
  value: number;
}

interface RotationOption {
  label: string;
  value: 0 | 90 | 180 | 270;
}

interface Props {
  show?: boolean;
  deviceSerial: string;
}

interface Emits {
  (e: 'close'): void;
}

const props = withDefaults(defineProps<Props>(), {
  show: true
});

const emit = defineEmits<Emits>();

const isOpen = ref(props.show);
const brightness = ref(128);
const currentRotation = ref<0 | 90 | 180 | 270>(0);
const autoRotation = ref(false);
const keepAwake = ref(false);
const autoSleep = ref(false);
const processing = ref(false);

const brightnessPresets: BrightnessPreset[] = [
  { label: '0%', value: 0 },
  { label: '25%', value: 64 },
  { label: '50%', value: 128 },
  { label: '75%', value: 192 },
  { label: '100%', value: 255 }
];

const rotations: RotationOption[] = [
  { label: '0°', value: 0 },
  { label: '90°', value: 90 },
  { label: '180°', value: 180 },
  { label: '270°', value: 270 }
];

function handleClose() {
  isOpen.value = false;
  emit('close');
}

async function handlePowerControl(action: 'on' | 'off') {
  if (!props.deviceSerial || processing.value) return;

  processing.value = true;

  try {
    console.log('[ScreenControlPanel] Controlling screen power:', action);
    const result = await pyMatrixDeviceAPI.controlScreenPower(props.deviceSerial, action);

    if (result.success) {
      console.log('[ScreenControlPanel] Screen power control successful:', result.state);
      toast.success(`Screen ${action === 'on' ? 'turned on' : 'turned off'} successfully`, 'Screen Power');
    } else {
      console.error('[ScreenControlPanel] Failed to control screen power:', result.error);
      toast.error(`Failed to control screen power: ${result.error}`, 'Screen Power Error');
    }
  } catch (error) {
    console.error('[ScreenControlPanel] Error controlling screen power:', error);
    toast.error('Failed to control screen power', 'Screen Power Error');
  } finally {
    processing.value = false;
  }
}

async function handleBrightnessChange(value: number) {
  if (!props.deviceSerial || processing.value) return;

  processing.value = true;

  try {
    console.log('[ScreenControlPanel] Setting brightness:', value);
    const result = await pyMatrixDeviceAPI.setScreenBrightness(props.deviceSerial, value);

    if (result.success) {
      console.log('[ScreenControlPanel] Brightness set successfully:', result.level);
    } else {
      console.error('[ScreenControlPanel] Failed to set brightness:', result.error);
    }
  } catch (error) {
    console.error('[ScreenControlPanel] Error setting brightness:', error);
  } finally {
    processing.value = false;
  }
}

function setBrightness(value: number) {
  brightness.value = value;
  handleBrightnessChange(value);
}

async function handleRotationChange(rotation: 0 | 90 | 180 | 270) {
  if (!props.deviceSerial || processing.value) return;

  processing.value = true;
  currentRotation.value = rotation;

  try {
    console.log('[ScreenControlPanel] Setting rotation:', rotation);
    const result = await pyMatrixDeviceAPI.setScreenRotation(props.deviceSerial, rotation);

    if (result.success) {
      console.log('[ScreenControlPanel] Rotation set successfully:', result.rotation);
      toast.success(`Screen rotation set to ${rotation}°`, 'Screen Rotation');
    } else {
      console.error('[ScreenControlPanel] Failed to set rotation:', result.error);
      toast.error(`Failed to set rotation: ${result.error}`, 'Screen Rotation Error');
    }
  } catch (error) {
    console.error('[ScreenControlPanel] Error setting rotation:', error);
    toast.error('Failed to set rotation', 'Screen Rotation Error');
  } finally {
    processing.value = false;
  }
}

async function handleAutoRotationChange(value: boolean) {
  if (!props.deviceSerial || processing.value) return;

  processing.value = true;

  try {
    console.log('[ScreenControlPanel] Auto rotation changed:', value);

    const result = value
      ? await pyMatrixDeviceAPI.enableAutoRotation(props.deviceSerial)
      : await pyMatrixDeviceAPI.disableAutoRotation(props.deviceSerial);

    if (result.success) {
      console.log('[ScreenControlPanel] Auto rotation changed successfully');
      toast.success(
        `Auto rotation ${value ? 'enabled' : 'disabled'}`,
        'Auto Rotation'
      );
    } else {
      console.error('[ScreenControlPanel] Failed to change auto rotation:', result.error);
      toast.error(`Failed to ${value ? 'enable' : 'disable'} auto rotation: ${result.error}`, 'Auto Rotation Error');
      // Revert the toggle on failure
      autoRotation.value = !value;
    }
  } catch (error) {
    console.error('[ScreenControlPanel] Error changing auto rotation:', error);
    toast.error(`Failed to ${value ? 'enable' : 'disable'} auto rotation`, 'Auto Rotation Error');
    // Revert the toggle on failure
    autoRotation.value = !value;
  } finally {
    processing.value = false;
  }
}

function handleKeepAwakeChange(value: boolean) {
  console.log('[ScreenControlPanel] Keep awake changed:', value);
  // TODO: Implement keep awake API call when backend supports it
}

function handleAutoSleepChange(value: boolean) {
  console.log('[ScreenControlPanel] Auto sleep changed:', value);
  // TODO: Implement auto sleep API call when backend supports it
}
</script>
