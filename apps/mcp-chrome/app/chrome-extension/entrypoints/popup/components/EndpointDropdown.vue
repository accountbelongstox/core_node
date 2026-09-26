<template>
  <div ref="rootRef" class="relative">
    <!-- Trigger pill -->
    <button
      class="ep-trigger flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-medium transition-colors"
      :title="currentEndpointUrl"
      @click="open = !open"
    >
      <span :class="['w-1.5 h-1.5 rounded-full shrink-0 transition-colors', headerDotClass]" />
      <span class="truncate max-w-[110px]" style="color: var(--text)">{{ triggerLabel }}</span>
      <span v-if="autoMode" class="px-1 rounded text-[7px] font-bold bg-indigo-500/15 text-indigo-400 shrink-0">A</span>
      <span class="text-[9px] shrink-0 transition-transform" :class="{ 'rotate-180': open }" style="color: var(--text-faint)">▾</span>
    </button>

    <!-- Dropdown panel — positioned below the trigger, right-aligned -->
    <div
      v-if="open"
      class="ep-panel absolute right-0 top-full mt-1 w-72 rounded-lg border shadow-2xl overflow-hidden"
      style="background: var(--surface-solid, var(--surface)); border-color: var(--border); z-index: 200"
    >
      <!-- Panel header -->
      <div class="flex items-center justify-between px-2.5 py-1.5 border-b" style="border-color: var(--border)">
        <span class="text-[9px] font-bold uppercase tracking-tight" style="color: var(--text-muted)">{{ getMessage('apiConfigurationLabel') }}</span>
        <div class="flex items-center gap-1.5">
          <span v-if="isAutoDetecting" class="text-[8px] text-amber-400 flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            {{ getMessage('apiAutoDetecting') }}
          </span>
          <button
            class="ep-btn px-1.5 py-0.5 rounded text-[8px] font-bold disabled:opacity-50"
            :disabled="isRefreshing"
            @click="refreshEndpoints"
          >
            {{ getMessage(isRefreshing ? 'apiTesting' : 'apiTestAll') }}
          </button>
        </div>
      </div>

      <!-- Auto mode row -->
      <button
        class="ep-option w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left"
        :class="{ 'ep-option--active': autoMode }"
        @click="selectAuto"
      >
        <span class="w-2 h-2 rounded-full shrink-0 bg-indigo-500" />
        <span class="text-[10px] font-medium flex-1" style="color: var(--text)">{{ getMessage('apiAutoMode') }}</span>
        <span v-if="autoMode" class="text-[9px] text-indigo-400 shrink-0">✓</span>
      </button>

      <div class="border-t" style="border-color: var(--border)" />

      <!-- Endpoint list -->
      <div class="max-h-52 overflow-y-auto">
        <div
          v-for="ep in sortedEndpoints"
          :key="ep.id"
          class="ep-option px-2.5 py-1.5 cursor-pointer"
          :class="{ 'ep-option--active': !autoMode && isCurrentEndpoint(ep.id) }"
          @click="selectEndpoint(ep.id)"
        >
          <div class="flex items-center justify-between gap-1.5">
            <div class="flex items-center gap-1.5 min-w-0">
              <span :class="['w-2 h-2 rounded-full shrink-0', dotClass(ep.id)]" />
              <span class="text-[10px] font-medium truncate" style="color: var(--text)">{{ ep.description }}</span>
              <span v-if="!autoMode && isCurrentEndpoint(ep.id)" class="text-[9px] shrink-0 text-indigo-400">✓</span>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <span v-if="getStatus(ep.id)" class="text-[8px] font-mono" style="color: var(--text-faint)">
                {{ formatResponseTime(getStatus(ep.id)!.responseTime) }}
              </span>
              <button
                class="ep-btn-test px-1.5 py-0.5 rounded text-[8px] font-bold disabled:opacity-50"
                :disabled="testingId === ep.id"
                @click.stop="testEndpoint(ep)"
              >
                {{ testingId === ep.id ? '…' : getMessage('apiTest') }}
              </button>
            </div>
          </div>
          <div class="flex items-center gap-1 mt-0.5 pl-3.5">
            <span class="text-[8px] font-mono truncate" style="color: var(--text-faint)">
              {{ ep.protocol }}://{{ ep.url }}{{ ep.port ? ':' + ep.port : '' }}
            </span>
            <span
              :class="['ml-auto px-1 rounded text-[7px] font-bold shrink-0', ep.isLocal ? 'bg-emerald-500/15 text-emerald-400' : 'bg-sky-500/15 text-sky-400']"
            >{{ getMessage(ep.isLocal ? 'apiLocalTag' : 'apiRemoteTag') }}</span>
          </div>
        </div>
      </div>

      <!-- Add custom -->
      <div class="border-t" style="border-color: var(--border)" />
      <div class="px-2.5 py-1.5">
        <button
          class="w-full flex items-center justify-between text-[9px] font-bold uppercase tracking-tight"
          style="color: var(--text-muted)"
          @click="showCustomForm = !showCustomForm"
        >
          <span>{{ getMessage('apiAddCustomLabel') }}</span>
          <span style="color: var(--text-faint)">{{ showCustomForm ? '−' : '+' }}</span>
        </button>
        <div v-if="showCustomForm" class="flex flex-col gap-1 mt-1.5">
          <input
            v-model="customUrl"
            type="text"
            :placeholder="getMessage('apiCustomUrlPlaceholder')"
            class="ep-input w-full px-2 py-1 border rounded text-[10px]"
          />
          <div class="flex gap-1">
            <select v-model="customProtocol" class="ep-input px-2 py-1 border rounded text-[10px]">
              <option value="http">HTTP</option>
              <option value="https">HTTPS</option>
            </select>
            <input
              v-model.number="customPort"
              type="number"
              :placeholder="getMessage('apiPortPlaceholder')"
              class="ep-input flex-1 min-w-0 px-2 py-1 border rounded text-[10px]"
            />
          </div>
          <button
            class="w-full px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[9px] font-bold disabled:opacity-40 transition-colors"
            :disabled="!customUrl"
            @click="addCustomEndpoint"
          >
            {{ getMessage('apiAddEndpoint') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { endpointAddress, useEndpointSelection } from '@/composables/useEndpointSelection';
import { getMessage } from '@/utils/i18n';

const {
  open,
  rootRef,
  currentEndpoint,
  isRefreshing,
  isAutoDetecting,
  testingId,
  showCustomForm,
  autoMode,
  customUrl,
  customProtocol,
  customPort,
  sortedEndpoints,
  currentEndpointUrl,
  headerDotClass,
  isCurrentEndpoint,
  getStatus,
  dotClass,
  formatResponseTime,
  refreshEndpoints,
  testEndpoint,
  selectEndpoint,
  selectAuto,
  addCustomEndpoint,
} = useEndpointSelection();

const triggerLabel = computed(() =>
  currentEndpoint.value ? endpointAddress(currentEndpoint.value, false) : getMessage('apiNone'),
);
</script>

<style scoped>
.ep-trigger {
  background: var(--surface-2);
  border-color: var(--border);
}
.ep-trigger:hover {
  border-color: var(--border-strong);
  background: var(--surface);
}
.ep-btn {
  background: var(--surface-2);
  color: var(--text);
  transition: background 0.12s;
}
.ep-btn:hover:not(:disabled) {
  background: var(--surface-solid);
}
.ep-btn-test {
  background: var(--surface-2);
  color: var(--text);
  transition: background 0.12s;
}
.ep-btn-test:hover:not(:disabled) {
  background: var(--accent);
  color: var(--accent-fg);
}
.ep-option {
  transition: background 0.1s;
}
.ep-option:hover {
  background: var(--surface-2);
}
.ep-option--active {
  background: var(--accent-soft);
}
.ep-input {
  background: var(--surface-2);
  border-color: var(--border);
  color: var(--text);
}
</style>
