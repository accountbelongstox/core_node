<template>
  <section class="settings-card">
    <div class="settings-card__header">
      <div>
        <h4>Task execution</h4>
        <p>Shared with the Task tab and applied live while it is running.</p>
      </div>
      <span>{{ enabledCount }}/{{ CAPABILITIES.length }}</span>
    </div>

    <div class="capability-grid">
      <label
        v-for="capability in CAPABILITIES"
        :key="capability.key"
        class="capability-option"
        :class="{ 'capability-option--enabled': capabilityState[capability.key].value }"
        :title="capability.hint"
      >
        <input v-model="capabilityState[capability.key].value" type="checkbox" />
        <span>
          <strong>{{ capability.zhLabel }}</strong>
          <small>{{ capability.hint }}</small>
        </span>
      </label>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { computed, type Ref } from 'vue';
import { usePersistedRef } from '@/composables/usePersistedRef';
import { CAPABILITIES, type CapabilityKey } from '@/utils/task-capabilities';

const capabilityState = CAPABILITIES.reduce(
  (state, capability) => {
    state[capability.key] = usePersistedRef(capability.storageKey, false);
    return state;
  },
  {} as Record<CapabilityKey, Ref<boolean>>,
);

const enabledCount = computed(() =>
  CAPABILITIES.filter((capability) => capabilityState[capability.key].value).length,
);
</script>

<style scoped>
.settings-card {
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}
.settings-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.settings-card h4 {
  margin: 0;
  color: var(--text);
  font-size: 11px;
}
.settings-card p,
.settings-card__header > span {
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
.capability-option--enabled {
  border-color: var(--success, #10b981);
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
