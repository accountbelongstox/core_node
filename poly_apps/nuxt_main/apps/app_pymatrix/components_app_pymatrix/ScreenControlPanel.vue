<template>
  <BasePanel
    v-model="isOpen"
    title="Screen Control"
    header-icon="📱"
    size="md"
    variant="warning"
    @close="handleClose"
  >
    <div class="control-sections">
      <!-- Power Control -->
      <div class="control-section">
        <div class="section-header">
          <div class="section-icon">⚡</div>
          <h4 class="section-title">Power</h4>
        </div>

        <div class="button-grid">
          <BaseButton
            variant="default"
            size="md"
            icon="🔆"
            @click="handlePowerControl('on')"
          >
            Screen On
          </BaseButton>
          <BaseButton
            variant="default"
            size="md"
            icon="🌙"
            @click="handlePowerControl('off')"
          >
            Screen Off
          </BaseButton>
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
          <BaseButton
            v-for="preset in brightnessPresets"
            :key="preset.value"
            variant="ghost"
            size="sm"
            :class="{ active: brightness === preset.value }"
            @click="setBrightness(preset.value)"
          >
            {{ preset.label }}
          </BaseButton>
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
  </BasePanel>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useToast } from '../composables_app_pymatrix/useToast';
import BasePanel from '~/common/components/ui/BasePanel.vue';
import BaseButton from '~/common/components/ui/BaseButton.vue';
import BaseSlider from '~/common/components/ui/BaseSlider.vue';
import BaseToggle from '~/common/components/ui/BaseToggle.vue';
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

<style scoped>
.control-sections {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.control-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 20px;
  border-bottom: 1px solid #e5e7eb;
}

.control-section:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-icon {
  font-size: 20px;
}

.section-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.button-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.preset-buttons {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.preset-buttons .base-button.active {
  background: #f59e0b;
  color: white;
}

.rotation-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.rotation-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 8px;
  background: #f9fafb;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.rotation-btn:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.rotation-btn.active {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  border-color: #f59e0b;
  color: white;
}

.rotation-icon {
  font-size: 24px;
  transition: transform 0.3s ease;
}

.rotation-label {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
}

.rotation-btn.active .rotation-label {
  color: white;
}

.toggle-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.auto-rotation-toggle {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
}
</style>
