<template>
  <div class="module-placeholder">
    <div class="placeholder-content">
      <i class="fas fa-clock icon"></i>
      <h2>{{ t('octaneTasks.title') }}</h2>
      <p>{{ t('modules.octaneTasks.description') }}</p>
      <div class="coming-soon">Coming Soon</div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
</script>

<style scoped>
.module-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 2rem;
}

.placeholder-content {
  text-align: center;
  max-width: 500px;
}

.icon {
  font-size: 4rem;
  color: #6366f1;
  margin-bottom: 1rem;
}

h2 {
  font-size: 2rem;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
}

p {
  color: #6b7280;
  margin: 0 0 1.5rem 0;
}

.coming-soon {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  border-radius: 8px;
  font-weight: 600;
  display: inline-block;
}
</style>
