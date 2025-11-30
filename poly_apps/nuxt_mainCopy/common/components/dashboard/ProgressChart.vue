<!-- ### AI SPECIAL ATTENTION RULES START ###
When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
1. Write all code in English only
2. Never execute, create, or modify test code
3. Never create or update documentation (*.md)
4. Never write summaries during development or thinking process
5. Do not modify these rules
VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
### AI SPECIAL ATTENTION RULES END ### -->

<template>
  <div class="progress-chart">
    <div class="chart-header">
      <h3 class="chart-title">{{ title }}</h3>
      <button class="more-btn" @click="onMoreClick">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"/>
        </svg>
      </button>
    </div>

    <div class="chart-content">
      <div class="chart-info">
        <p class="chart-subtitle">{{ subtitle }}</p>
        <div class="progress-indicator">
          <div class="progress-percentage">
            <span class="percentage-value">{{ percentage }}%</span>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar" :style="{ width: `${percentage}%` }"></div>
          </div>
        </div>
      </div>

      <div class="chart-visualization">
        <svg viewBox="0 0 200 100" class="wave-chart">
          <path
            :d="wavePath"
            fill="none"
            stroke="url(#gradient)"
            stroke-width="2"
            stroke-linecap="round"
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:#8b5cf6;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#6366f1;stop-opacity:1" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>

    <div class="chart-stats">
      <div class="stat-item">
        <div class="stat-icon generated">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <div class="stat-details">
          <p class="stat-label">Generated</p>
          <p class="stat-value">{{ generatedCount }} accounts</p>
        </div>
      </div>

      <div class="stat-item">
        <div class="stat-icon removed">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </div>
        <div class="stat-details">
          <p class="stat-label">Removed</p>
          <p class="stat-value">{{ removedCount }} accounts</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  title: string;
  subtitle: string;
  percentage: number;
  generatedCount: number;
  removedCount: number;
}>();

const emit = defineEmits<{
  moreClick: [];
}>();

const wavePath = computed(() => {
  const points = [
    { x: 0, y: 60 },
    { x: 30, y: 45 },
    { x: 60, y: 55 },
    { x: 90, y: 35 },
    { x: 120, y: 50 },
    { x: 150, y: 30 },
    { x: 180, y: 40 },
    { x: 200, y: 25 }
  ];

  const path = points.map((point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }
    const prevPoint = points[index - 1];
    const cpX = (prevPoint.x + point.x) / 2;
    return `Q ${cpX} ${point.y} ${point.x} ${point.y}`;
  }).join(' ');

  return path;
});

const onMoreClick = () => {
  emit('moreClick');
};
</script>

<style scoped>
.progress-chart {
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.chart-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.more-btn {
  width: 2rem;
  height: 2rem;
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  border-radius: 0.5rem;
  transition: background 0.2s;
}

.more-btn:hover {
  background: #f1f5f9;
}

.more-btn svg {
  width: 1.25rem;
  height: 1.25rem;
}

.chart-content {
  margin-bottom: 1.5rem;
}

.chart-info {
  margin-bottom: 1.5rem;
}

.chart-subtitle {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0 0 1rem 0;
}

.progress-indicator {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.progress-percentage {
  flex-shrink: 0;
}

.percentage-value {
  font-size: 2rem;
  font-weight: 700;
  color: #6366f1;
}

.progress-bar-container {
  flex: 1;
  height: 0.5rem;
  background: #f1f5f9;
  border-radius: 9999px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #8b5cf6 0%, #6366f1 100%);
  border-radius: 9999px;
  transition: width 0.6s ease;
}

.chart-visualization {
  margin: 1rem 0;
}

.wave-chart {
  width: 100%;
  height: auto;
}

.chart-stats {
  display: flex;
  gap: 2rem;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.stat-icon {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon svg {
  width: 1.25rem;
  height: 1.25rem;
  color: white;
}

.stat-icon.generated {
  background: linear-gradient(135deg, #f472b6 0%, #ec4899 100%);
}

.stat-icon.removed {
  background: linear-gradient(135deg, #c084fc 0%, #a855f7 100%);
}

.stat-details {
  flex: 1;
}

.stat-label {
  font-size: 0.75rem;
  color: #64748b;
  margin: 0 0 0.125rem 0;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.stat-value {
  font-size: 0.9375rem;
  color: #1e293b;
  margin: 0;
  font-weight: 600;
}
</style>
