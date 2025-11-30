<template>
  <section class="statistics-section">
    <div class="stats-container">
      <div
        v-for="stat in statistics"
        :key="stat.id"
        class="stat-item"
      >
        <div class="stat-number">{{ stat.value }}</div>
        <div class="stat-label">{{ stat.label }}</div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const statistics = ref([
  {
    id: 1,
    value: '352,380,935',
    label: 'Total Transactions'
  },
  {
    id: 2,
    value: '12,601',
    label: 'Active Projects'
  },
  {
    id: 3,
    value: '182,086',
    label: 'Happy Clients'
  }
]);
</script>

<style scoped>
.statistics-section {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  padding: 4rem 2rem;
  border-top: 1px solid #e2e8f0;
}

.stats-container {
  max-width: 1400px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4rem;
}

.stat-item {
  text-align: center;
  padding: 2rem;
  background: white;
  border-radius: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transition: all 0.3s;
  position: relative;
  overflow: hidden;
}

.stat-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  transform: scaleX(0);
  transition: transform 0.3s;
}

.stat-item:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
}

.stat-item:hover::before {
  transform: scaleX(1);
}

.stat-number {
  font-size: 3rem;
  font-weight: 800;
  background: linear-gradient(135deg, #1e293b 0%, #475569 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 0.75rem;
  line-height: 1.2;
}

.stat-label {
  font-size: 1rem;
  color: #64748b;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

@media (max-width: 1024px) {
  .stats-container {
    gap: 2rem;
  }

  .stat-number {
    font-size: 2.5rem;
  }

  .stat-label {
    font-size: 0.9375rem;
  }
}

@media (max-width: 768px) {
  .statistics-section {
    padding: 3rem 1rem;
  }

  .stats-container {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .stat-item {
    padding: 1.5rem;
  }

  .stat-number {
    font-size: 2rem;
  }

  .stat-label {
    font-size: 0.875rem;
  }
}
</style>
