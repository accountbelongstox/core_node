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
  <div class="welcome-card">
    <div class="welcome-content">
      <div class="welcome-text">
        <h2 class="welcome-title">{{ greeting }}</h2>
        <h1 class="welcome-name">{{ userName }}</h1>
        <p class="welcome-subtitle">{{ subtitle }}</p>
      </div>
      <div class="welcome-illustration">
        <div class="illustration-circle">
          <svg class="illustration-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
          </svg>
        </div>
      </div>
    </div>
    <button class="view-analysis-btn" @click="onViewAnalysis">
      {{ buttonText }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  userName: string;
  subtitle?: string;
  buttonText?: string;
}>();

const emit = defineEmits<{
  viewAnalysis: [];
}>();

const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning,';
  if (hour < 18) return 'Good Afternoon,';
  return 'Good Evening,';
});

const onViewAnalysis = () => {
  emit('viewAnalysis');
};
</script>

<style scoped>
.welcome-card {
  background: linear-gradient(135deg, #e0f2fe 0%, #bfdbfe 100%);
  border-radius: 1.5rem;
  padding: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s, box-shadow 0.2s;
}

.welcome-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 12px rgba(0, 0, 0, 0.1);
}

.welcome-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.welcome-text {
  flex: 1;
}

.welcome-title {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0 0 0.25rem 0;
  font-weight: 500;
}

.welcome-name {
  font-size: 1.875rem;
  color: #1e293b;
  margin: 0 0 0.5rem 0;
  font-weight: 700;
}

.welcome-subtitle {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0;
}

.welcome-illustration {
  flex-shrink: 0;
  margin-left: 1.5rem;
}

.illustration-circle {
  width: 5rem;
  height: 5rem;
  background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 16px rgba(139, 92, 246, 0.3);
}

.illustration-icon {
  width: 3rem;
  height: 3rem;
  color: white;
}

.view-analysis-btn {
  width: 100%;
  padding: 0.875rem 1.5rem;
  background: white;
  color: #6366f1;
  border: none;
  border-radius: 0.75rem;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.view-analysis-btn:hover {
  background: #f8fafc;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

@media (max-width: 640px) {
  .welcome-content {
    flex-direction: column;
    align-items: flex-start;
  }

  .welcome-illustration {
    margin-left: 0;
    margin-top: 1rem;
  }

  .illustration-circle {
    width: 4rem;
    height: 4rem;
  }

  .illustration-icon {
    width: 2.5rem;
    height: 2.5rem;
  }
}
</style>
