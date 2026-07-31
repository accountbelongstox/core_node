<template>
  <section class="capability-card" :class="{ 'capability-card--compact': compact }">
    <div class="capability-card__header">
      <div>
        <h4>{{ title }}</h4>
        <p>{{ description }}</p>
      </div>
      <span>{{ enabledCount }}/{{ capabilities.length }}</span>
    </div>

    <div class="capability-grid">
      <label
        v-for="capability in capabilities"
        :key="capability.key"
        class="capability-option"
        :class="{ 'capability-option--enabled': capabilityState[capability.key].value }"
        :title="getMessage(capability.hintKey)"
      >
        <input v-model="capabilityState[capability.key].value" type="checkbox" />
        <span>
          <strong>{{ getMessage(capability.labelKey) }}</strong>
          <small>{{ getMessage(capability.hintKey) }}</small>
        </span>
      </label>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { useTaskCapabilities } from '../composables/useTaskCapabilities';
import { getMessage } from '@/utils/i18n';

withDefaults(
  defineProps<{
    title?: string;
    description?: string;
    compact?: boolean;
  }>(),
  {
    title: getMessage('taskCenterExecutionTitle'),
    description: getMessage('taskCenterExecutionDescription'),
    compact: false,
  },
);

const {
  capabilities,
  capabilityState,
  enabledCount,
} = useTaskCapabilities();
</script>

<style scoped>
.capability-card {
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}
.capability-card--compact {
  background: var(--surface-2);
}
.capability-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.capability-card h4 {
  margin: 0;
  color: var(--text);
  font-size: 11px;
}
.capability-card p,
.capability-card__header > span {
  margin: 2px 0 0;
  color: var(--text-faint);
  font-size: 9px;
}
.capability-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}
.capability-option {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 7px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--surface-2);
  cursor: pointer;
}
.capability-card--compact .capability-option {
  background: var(--surface);
}
.capability-option--enabled {
  border-color: var(--success, #10b981);
  background: rgba(16, 185, 129, 0.08);
}
.capability-card--compact .capability-option--enabled {
  background: rgba(16, 185, 129, 0.08);
}
.capability-option input {
  margin-top: 2px;
  accent-color: var(--accent);
}
.capability-option span {
  min-width: 0;
}
.capability-option strong,
.capability-option small {
  display: block;
}
.capability-option strong {
  color: var(--text);
  font-size: 10px;
}
.capability-option small {
  margin-top: 2px;
  color: var(--text-faint);
  font-size: 8px;
}
</style>
