<template>
  <div class="video-control-panel" v-if="show">
    <!-- Quality Selector -->
    <div class="control-section">
      <div class="section-label">Quality</div>
      <div class="quality-buttons">
        <button
          v-for="q in qualities"
          :key="q.value"
          :class="['quality-btn', { active: quality === q.value }]"
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
          class="control-btn"
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
          class="control-btn"
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
          <span class="metric-value" :class="{ warning: metrics.droppedFrames > 10 }">
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

<style scoped>
.video-control-panel {
  position: absolute;
  bottom: 12px;
  left: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 5;
  min-width: 200px;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.video-control-panel:hover,
.video-control-panel:focus-within {
  opacity: 1;
}

/* Always show on mobile/touch devices */
@media (hover: none) {
  .video-control-panel {
    opacity: 0.9;
  }
}

.control-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.section-label {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.quality-buttons,
.playback-buttons {
  display: flex;
  gap: 6px;
}

.quality-btn {
  flex: 1;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.quality-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.9);
}

.quality-btn.active {
  background: rgba(59, 130, 246, 0.8);
  border-color: rgba(59, 130, 246, 1);
  color: white;
}

.control-btn {
  flex: 1;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.control-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.control-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.metrics-section {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 8px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.metric-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.metric-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.metric-value {
  font-size: 14px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  font-variant-numeric: tabular-nums;
}

.metric-value.warning {
  color: #ef4444;
  animation: pulse-warning 2s ease-in-out infinite;
}

@keyframes pulse-warning {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}
</style>
