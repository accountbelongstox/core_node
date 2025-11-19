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
  <div class="stat-card" :class="`theme-${theme}`">
    <div class="stat-icon" :class="`bg-${theme}`">
      <component :is="iconComponent" class="icon" />
    </div>
    <div class="stat-content">
      <p class="stat-label">{{ label }}</p>
      <h3 class="stat-value">{{ formattedValue }}</h3>
      <div v-if="trend" class="stat-trend" :class="trend > 0 ? 'positive' : 'negative'">
        <svg class="trend-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path v-if="trend > 0" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
          <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"/>
        </svg>
        <span>{{ Math.abs(trend) }}%</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  label: string;
  value: number | string;
  icon?: string;
  theme?: 'primary' | 'success' | 'warning' | 'danger' | 'purple';
  trend?: number;
  format?: 'number' | 'currency' | 'percent';
}>();

const iconComponent = computed(() => {
  const icons: Record<string, string> = {
    folder: 'IconFolder',
    users: 'IconUsers',
    download: 'IconDownload',
    'dollar-sign': 'IconDollarSign',
    'trending-up': 'IconTrendingUp',
    code: 'IconCode',
    'check-circle': 'IconCheckCircle',
    star: 'IconStar'
  };
  return icons[props.icon || 'folder'] || 'IconFolder';
});

const formattedValue = computed(() => {
  if (typeof props.value === 'string') return props.value;

  switch (props.format) {
    case 'currency':
      return `$${props.value.toLocaleString()}`;
    case 'percent':
      return `${props.value}%`;
    default:
      return props.value.toLocaleString();
  }
});
</script>

<style scoped>
.stat-card {
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.stat-icon {
  width: 3rem;
  height: 3rem;
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon .icon {
  width: 1.5rem;
  height: 1.5rem;
  color: white;
}

.bg-primary {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
}

.bg-success {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

.bg-warning {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
}

.bg-danger {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
}

.bg-purple {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
}

.stat-content {
  flex: 1;
  min-width: 0;
}

.stat-label {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0 0 0.25rem 0;
  font-weight: 500;
}

.stat-value {
  font-size: 1.875rem;
  color: #1e293b;
  margin: 0 0 0.5rem 0;
  font-weight: 700;
}

.stat-trend {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8125rem;
  font-weight: 600;
}

.stat-trend.positive {
  color: #10b981;
}

.stat-trend.negative {
  color: #ef4444;
}

.trend-icon {
  width: 1rem;
  height: 1rem;
}

@media (max-width: 640px) {
  .stat-value {
    font-size: 1.5rem;
  }
}
</style>
