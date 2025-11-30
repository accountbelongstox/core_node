<template>
  <div class="pm-panel pm-panel--blue" v-if="show && deviceInfo" style="position: absolute; top: 12px; right: 12px; width: 320px; max-height: calc(100% - 24px); z-index: 10;">
    <div class="pm-panel__header">
      <h3 class="pm-panel__title">Device Info</h3>
      <button class="pm-button pm-button--ghost pm-button--sm" @click="emit('close')" title="Close">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
        </svg>
      </button>
    </div>

    <div class="pm-panel__body" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 16px;">
      <!-- Basic Info -->
      <div class="pm-form-group">
        <label class="pm-form-label">Basic</label>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div class="pm-flex pm-justify-between pm-items-center pm-gap-4" style="padding: 8px 12px; background: rgba(255, 255, 255, 0.05); border-radius: 6px;">
            <span style="font-size: 13px; font-weight: 500; color: rgba(255, 255, 255, 0.7);">Serial</span>
            <span style="font-size: 12px; font-weight: 600; color: white; font-family: 'Courier New', monospace;">{{ deviceInfo.serial }}</span>
          </div>
          <div class="pm-flex pm-justify-between pm-items-center pm-gap-4" style="padding: 8px 12px; background: rgba(255, 255, 255, 0.05); border-radius: 6px;">
            <span style="font-size: 13px; font-weight: 500; color: rgba(255, 255, 255, 0.7);">Model</span>
            <span style="font-size: 13px; font-weight: 600; color: white;">{{ deviceInfo.model || 'Unknown' }}</span>
          </div>
          <div class="pm-flex pm-justify-between pm-items-center pm-gap-4" style="padding: 8px 12px; background: rgba(255, 255, 255, 0.05); border-radius: 6px;">
            <span style="font-size: 13px; font-weight: 500; color: rgba(255, 255, 255, 0.7);">State</span>
            <span
              class="pm-badge"
              :class="{
                'pm-badge--success': deviceInfo.state === 'connected',
                'pm-badge--danger': deviceInfo.state === 'disconnected',
                'pm-badge--warning': deviceInfo.state === 'connecting'
              }"
            >
              {{ deviceInfo.state }}
            </span>
          </div>
        </div>
      </div>

      <!-- Display Info -->
      <div class="pm-form-group" v-if="deviceInfo.resolution">
        <label class="pm-form-label">Display</label>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div class="pm-flex pm-justify-between pm-items-center pm-gap-4" style="padding: 8px 12px; background: rgba(255, 255, 255, 0.05); border-radius: 6px;">
            <span style="font-size: 13px; font-weight: 500; color: rgba(255, 255, 255, 0.7);">Resolution</span>
            <span style="font-size: 12px; font-weight: 600; color: white; font-family: 'Courier New', monospace;">
              {{ deviceInfo.resolution.width }} × {{ deviceInfo.resolution.height }}
            </span>
          </div>
          <div class="pm-flex pm-justify-between pm-items-center pm-gap-4" style="padding: 8px 12px; background: rgba(255, 255, 255, 0.05); border-radius: 6px;" v-if="deviceInfo.dpi">
            <span style="font-size: 13px; font-weight: 500; color: rgba(255, 255, 255, 0.7);">DPI</span>
            <span style="font-size: 13px; font-weight: 600; color: white;">{{ deviceInfo.dpi }}</span>
          </div>
        </div>
      </div>

      <!-- System Info -->
      <div class="pm-form-group" v-if="deviceInfo.androidVersion || deviceInfo.sdkVersion">
        <label class="pm-form-label">System</label>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div class="pm-flex pm-justify-between pm-items-center pm-gap-4" style="padding: 8px 12px; background: rgba(255, 255, 255, 0.05); border-radius: 6px;" v-if="deviceInfo.androidVersion">
            <span style="font-size: 13px; font-weight: 500; color: rgba(255, 255, 255, 0.7);">Android</span>
            <span style="font-size: 13px; font-weight: 600; color: white;">{{ deviceInfo.androidVersion }}</span>
          </div>
          <div class="pm-flex pm-justify-between pm-items-center pm-gap-4" style="padding: 8px 12px; background: rgba(255, 255, 255, 0.05); border-radius: 6px;" v-if="deviceInfo.sdkVersion">
            <span style="font-size: 13px; font-weight: 500; color: rgba(255, 255, 255, 0.7);">SDK</span>
            <span style="font-size: 13px; font-weight: 600; color: white;">{{ deviceInfo.sdkVersion }}</span>
          </div>
        </div>
      </div>

      <!-- Streaming Info -->
      <div class="pm-form-group" v-if="deviceInfo.streaming !== undefined">
        <label class="pm-form-label">Status</label>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div class="pm-flex pm-justify-between pm-items-center pm-gap-4" style="padding: 8px 12px; background: rgba(255, 255, 255, 0.05); border-radius: 6px;">
            <span style="font-size: 13px; font-weight: 500; color: rgba(255, 255, 255, 0.7);">Streaming</span>
            <span class="pm-badge" :class="deviceInfo.streaming ? 'pm-badge--success' : 'pm-badge--danger'">
              {{ deviceInfo.streaming ? 'Active' : 'Inactive' }}
            </span>
          </div>
          <div class="pm-flex pm-justify-between pm-items-center pm-gap-4" style="padding: 8px 12px; background: rgba(255, 255, 255, 0.05); border-radius: 6px;">
            <span style="font-size: 13px; font-weight: 500; color: rgba(255, 255, 255, 0.7);">Controllable</span>
            <span class="pm-badge" :class="deviceInfo.controllable ? 'pm-badge--success' : 'pm-badge--danger'">
              {{ deviceInfo.controllable ? 'Yes' : 'No' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Group Info -->
      <div class="pm-form-group" v-if="deviceInfo.isHost">
        <label class="pm-form-label">Group Control</label>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div class="pm-flex pm-justify-between pm-items-center pm-gap-4" style="padding: 8px 12px; background: rgba(255, 255, 255, 0.05); border-radius: 6px;">
            <span style="font-size: 13px; font-weight: 500; color: rgba(255, 255, 255, 0.7);">Role</span>
            <span class="pm-badge pm-badge--primary" style="display: inline-flex; align-items: center; gap: 4px;">
              <span>★</span>
              Host Device
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="pm-panel__footer">
      <button class="pm-button pm-button--primary" @click="emit('refresh')" title="Refresh device info" style="width: 100%;">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/>
          <path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"/>
        </svg>
        Refresh
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Device } from '@/types/pymatrix';

interface Props {
  show?: boolean;
  deviceInfo: Device | null;
}

interface Emits {
  (e: 'close'): void;
  (e: 'refresh'): void;
}

const props = withDefaults(defineProps<Props>(), {
  show: true
});

const emit = defineEmits<Emits>();
</script>
