<template>
  <!-- Top-right indicator: laravel_main's most-recently-modified source file.
       Polls GET /api/dashboard/code-last-modified every 10s. Purely informational;
       silently shows a muted dash when the backend is unreachable. -->
  <div class="lcf" :class="{ 'lcf--stale': !ok }" :title="tooltip">
    <span class="lcf-icon">📝</span>
    <span class="lcf-name">{{ ok ? baseName : '—' }}</span>
    <span v-if="ok && rel" class="lcf-time">{{ rel }}</span>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { currentApiClient } from '@/services/ApiManager';
import { TaskCenterApiClient, type CodeLastModified } from '@/services/TaskCenterApiClient';
import { getMessage } from '@/utils/i18n';

// Poll cadence (10s per the requirement).
const POLL_MS = 10000;

const data = ref<CodeLastModified | null>(null);
const ok = ref(false);
let timer: ReturnType<typeof setInterval> | null = null;

const baseName = computed<string>(() => {
  const path = data.value?.latest_file;
  if (!path) return getMessage('valueNotAvailable');
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
});

// Compact relative time from the file mtime (epoch seconds).
const rel = computed<string>(() => {
  const unix = data.value?.last_modified_unix;
  if (!unix) return '';
  const deltaSec = Math.max(0, Math.floor(Date.now() / 1000 - unix));
  if (deltaSec < 60) return `${deltaSec}s`;
  if (deltaSec < 3600) return `${Math.floor(deltaSec / 60)}m`;
  if (deltaSec < 86400) return `${Math.floor(deltaSec / 3600)}h`;
  return `${Math.floor(deltaSec / 86400)}d`;
});

const tooltip = computed<string>(() => {
  if (!ok.value) return getMessage('latestCodeFileUnreachable');
  const d = data.value;
  const lines = [
    getMessage('latestCodeFileLatest', [d?.latest_file || getMessage('valueNotAvailable')]),
    d?.last_modified_at ? getMessage('latestCodeFileModified', [d.last_modified_at]) : '',
    d?.method ? getMessage('latestCodeFileScan', [d.method, String(d.scan_ms ?? '?')]) : '',
  ];
  return lines.filter(Boolean).join('\n');
});

const poll = async (): Promise<void> => {
  try {
    const latest = await currentApiClient(TaskCenterApiClient).codeLastModified();
    if (latest) {
      data.value = latest;
      ok.value = true;
    } else {
      ok.value = false;
    }
  } catch {
    ok.value = false;
  }
};

onMounted(() => {
  void poll();
  timer = setInterval(() => void poll(), POLL_MS);
});

onUnmounted(() => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
});
</script>

<style scoped>
.lcf {
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: 160px;
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(15, 23, 42, 0.6);
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
  color: #94a3b8;
  cursor: default;
  user-select: none;
}
.lcf--stale {
  opacity: 0.55;
}
.lcf-icon {
  font-size: 9px;
  flex-shrink: 0;
}
.lcf-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #cbd5e1;
}
.lcf-time {
  flex-shrink: 0;
  color: #64748b;
  font-variant-numeric: tabular-nums;
}
</style>
