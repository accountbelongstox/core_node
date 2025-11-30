<template>
  <div class="pm-panel pm-panel--blue" v-if="show">
    <!-- Quality Selector -->
    <div class="control-section">
      <div class="section-label">Quality</div>
      <div class="quality-buttons">
        <button
          v-for="q in qualities"
          :key="q.value"
          :class="['pm-button', 'pm-button--electric-blue', { active: quality === q.value }]"
          @click="handleQualityChange(q.value)"
          :title="q.label"
        >
          {{ q.label }}
        </button>
      </div>
    </div>

    <!-- Playback Controls -->
    <div class="control-section">
      <div class="section-label">Playback</div>
      <div class="playback-buttons">
        <button
          class="pm-button pm-button--fire"
          @click="handlePause"
          :disabled="isPaused"
          title="Pause video stream"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="4" y="3" width="3" height="10" rx="1"/>
            <rect x="9" y="3" width="3" height="10" rx="1"/>
          </svg>
        </button>
        <button
          class="pm-button pm-button--golden"
          @click="handleResume"
          :disabled="!isPaused"
          title="Resume video stream"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5 3l8 5-8 5V3z"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Performance Metrics -->
    <div class="control-section metrics-section">
      <div class="section-label">Performance</div>
      <div class="metrics-grid">
        <div class="metric-item">
          <span class="metric-label">FPS</span>
          <span class="metric-value">{{ metrics.fps }}</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">Latency</span>
          <span class="metric-value">{{ metrics.latency }}ms</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">Dropped</span>
          <span class="metric-value pm-status-dot" :class="{ warning: metrics.droppedFrames > 10 }">
            {{ metrics.droppedFrames }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { VideoMetadata } from '@/types/pymatrix';

interface Props {
  show?: boolean;
  metrics: VideoMetadata;
  currentQuality?: 'high' | 'medium' | 'low';
}

interface Emits {
  (e: 'changeQuality', quality: 'high' | 'medium' | 'low'): void;
  (e: 'pause'): void;
  (e: 'resume'): void;
}

const props = withDefaults(defineProps<Props>(), {
  show: true,
  currentQuality: 'high'
});

const emit = defineEmits<Emits>();

const isPaused = ref(false);
const quality = ref<'high' | 'medium' | 'low'>(props.currentQuality);

const qualities = [
  { value: 'high' as const, label: 'High' },
  { value: 'medium' as const, label: 'Med' },
  { value: 'low' as const, label: 'Low' }
];

function handleQualityChange(newQuality: 'high' | 'medium' | 'low') {
  quality.value = newQuality;
  emit('changeQuality', newQuality);
}

function handlePause() {
  isPaused.value = true;
  emit('pause');
}

function handleResume() {
  isPaused.value = false;
  emit('resume');
}
</script>
