<template>
  <div class="tdm-backdrop" @click.self="close">
    <div class="tdm-modal" role="dialog" aria-modal="true">
      <!-- Header: task-type icon/label (procIcon prefers task_type, falls back to
           processorType) + FAST / AI-Translate badges + close. -->
      <header class="tdm-header">
        <div class="tdm-title">
          <span class="tdm-icon">{{ procIcon }}</span>
          <div class="tdm-titletext">
            <div class="tdm-typelabel">{{ typeLabel }}</div>
            <div class="tdm-taskid" :title="taskId">{{ taskId }}</div>
          </div>
        </div>
        <div class="tdm-headbadges">
          <span v-if="isFast" class="tdm-badge tdm-badge-fast">⚡ FAST</span>
          <span v-if="aiTranslate" class="tdm-badge tdm-badge-ai">✨ AI Translate</span>
          <!-- Jump-to-task-top: only for the privileged categories
               (translate/audio/image) and only while the task is still live. -->
          <button
            v-if="canBump"
            class="tdm-badge tdm-badge-bump"
            :disabled="bumping"
            @click="bumpToTop"
            title="Bump this task to the front of the fast lane (priority 100)"
          >
            {{ bumpLabel }}
          </button>
          <button class="tdm-close" @click="close" aria-label="Close">✕</button>
        </div>
      </header>

      <div class="tdm-body">
        <div v-if="!bundle && !loadError" class="tdm-loading">Connecting to live stream…</div>
        <div v-if="loadError" class="tdm-error">{{ loadError }}</div>

        <template v-if="bundle">
          <!-- Status / phase chips -->
          <div class="tdm-chips">
            <span class="tdm-chip" :style="{ '--dot': dotColor() }">
              <span class="tdm-dot" /> {{ task.status }}
            </span>
            <span class="tdm-chip">Phase: {{ phase.phase || '—' }}</span>
            <span class="tdm-chip">Priority: {{ task.priority }}</span>
            <span class="tdm-chip">Lane: {{ task.execution_type }}</span>
          </div>

          <!-- Core fields -->
          <dl class="tdm-fields">
            <div class="tdm-field"><dt>Capability</dt><dd>
              {{ capLabel }}<span v-if="aiTranslate"> ✨</span>
            </dd></div>
            <div class="tdm-field"><dt>App</dt><dd>{{ task.app_name }}</dd></div>
            <div class="tdm-field"><dt>Worker</dt><dd>{{ task.assigned_to || phase.worker_id || '—' }}</dd></div>
            <div class="tdm-field"><dt>Attempts</dt><dd>{{ meta.total_attempts }} / {{ meta.max_retries }}</dd></div>
            <div class="tdm-field"><dt>Elapsed</dt><dd>{{ fmtSeconds(phase.elapsed_seconds) }}</dd></div>
            <div class="tdm-field"><dt>Timeout in</dt><dd>{{ fmtSeconds(meta.estimated_timeout_in_seconds) }}</dd></div>
            <div v-if="providerValue" class="tdm-field"><dt>Provider</dt><dd>{{ providerValue }}</dd></div>
          </dl>

          <!-- Resolved media preview (early-out guard prevents re-resolution). -->
          <div v-if="mediaUrl" class="tdm-media">
            <img v-if="mediaIsImage" :src="mediaUrl" alt="task media" />
            <audio v-else-if="mediaIsAudio" :src="mediaUrl" controls />
          </div>

          <!-- Payload -->
          <details class="tdm-section" open>
            <summary>Payload</summary>
            <pre class="tdm-pre">{{ pretty(task.payload) }}</pre>
          </details>

          <!-- Result / error -->
          <details v-if="task.result" class="tdm-section">
            <summary>Result</summary>
            <pre class="tdm-pre">{{ pretty(task.result) }}</pre>
          </details>
          <div v-if="task.error" class="tdm-errbox">{{ task.error }}</div>

          <!-- Incremental, de-duped event timeline -->
          <div class="tdm-timeline">
            <div class="tdm-timeline-head">Timeline</div>
            <ul>
              <li v-for="ev in timeline" :key="ev.id" class="tdm-event">
                <span class="tdm-edot" :style="{ background: eventColor(ev.event) }" />
                <div class="tdm-eventbody">
                  <div class="tdm-eventrow">
                    <span class="tdm-eventname">{{ ev.event }}</span>
                    <span class="tdm-eventtime">{{ fmtTime(ev.created_at) }}</span>
                  </div>
                  <div class="tdm-eventmeta">
                    <span v-if="ev.worker_id">{{ ev.worker_id }}</span>
                    <span v-if="ev.attempt != null">attempt {{ ev.attempt }}</span>
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  subscribeToTaskStream,
  type TaskStreamBundle,
  type TaskStreamEvent,
  type TaskStreamHandle,
} from '../../composables/useTaskCenter';
import { getApiBase } from '@/services/ApiManager';
import { taskPath } from '@/utils/api-paths';
import { WorkerApiClient, PRIORITY_FAST } from '@/entrypoints/background/api/WorkerApiClient';
import {
  taskIcon,
  taskTypeLabel,
  capabilityLabel,
  isAiTranslate as metaIsAiTranslate,
  isFastTier,
} from './task-center-meta';

const props = defineProps<{
  taskId: string;
  /** Optional processorType fallback for the header icon when task_type is unknown. */
  processorType?: string | null;
}>();

const emit = defineEmits<{ (e: 'close'): void }>();

const bundle = ref<TaskStreamBundle | null>(null);
const loadError = ref('');
const mediaUrl = ref<string | null>(null);

// Event timeline keyed by id for de-dup (server may re-emit on reconnect).
const eventIndex = new Map<string, TaskStreamEvent>();
const timeline = ref<TaskStreamEvent[]>([]);

let handle: TaskStreamHandle | null = null;
let userClosed = false;

const task = computed(() => bundle.value?.task ?? ({} as TaskStreamBundle['task']));
const phase = computed(() => bundle.value?.current_phase ?? { phase: null, worker_id: null, elapsed_seconds: null });
const meta = computed(() =>
  bundle.value?.metadata ?? { total_attempts: 0, max_retries: 0, will_retry: false, estimated_timeout_in_seconds: null },
);

const procIcon = computed(() => taskIcon(task.value.task_type, props.processorType));
const typeLabel = computed(() => taskTypeLabel(task.value.task_type, props.processorType));
const capLabel = computed(() => capabilityLabel(task.value.capability));
const aiTranslate = computed(() => metaIsAiTranslate(task.value.capability));
const isFast = computed(() =>
  isFastTier({
    is_fast_tier: task.value.is_fast_tier,
    priority: task.value.priority,
    execution_type: task.value.execution_type,
  }),
);

// ---- Jump-to-task-top (bump) ----------------------------------------------
// Privileged categories that have a matching worker on the shared fast lane.
// Dedicated Gemini-image, NotebookLM and text lanes must retain their lane even
// when their numeric priority is raised.
const PRIVILEGED_CAPS = new Set(['translate', 'ai_translate', 'audio', 'sentence_audio']);
const PRIVILEGED_TASK_TYPES = new Set([
  'word_translation',
  'word_audio',
  'sentence_audio',
  'word_media',
]);
const LIVE_STATUSES = new Set(['pending', 'assigned', 'processing']);

const bumping = ref(false);
const bumped = ref(false);

const isPrivileged = computed(() => {
  const cap = (task.value.capability || '').toString();
  if (cap && PRIVILEGED_CAPS.has(cap)) return true;
  const tt = (task.value.task_type || '').toString();
  return PRIVILEGED_TASK_TYPES.has(tt);
});

// Only offer the bump while the task is still live and not already at the fast tier.
const canBump = computed(
  () =>
    isPrivileged.value &&
    LIVE_STATUSES.has((task.value.status || '').toLowerCase()) &&
    !isFast.value,
);

const bumpLabel = computed(() => (bumped.value ? '✓ Bumped' : bumping.value ? 'Bumping…' : '⏫ Task-top'));

const bumpToTop = async (): Promise<void> => {
  if (bumping.value || bumped.value) return;
  bumping.value = true;
  try {
    const client = new WorkerApiClient(apiBase());
    const resp = await client.bumpTask(props.taskId, PRIORITY_FAST);
    if (resp.success) {
      bumped.value = true;
      // Pull the fresh snapshot so priority / fast badge reflect the bump.
      refetch();
    } else {
      loadError.value = resp.message || 'Bump failed';
    }
  } catch (e: any) {
    loadError.value = e?.message || 'Bump failed';
  } finally {
    bumping.value = false;
  }
};

// Provider surfaced from the result (provider or engine key).
const providerValue = computed(() => {
  const r = task.value.result;
  if (r && typeof r === 'object') return r.provider || r.engine || null;
  return null;
});

const mediaIsImage = computed(() => !!mediaUrl.value && /^data:image\/|\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(mediaUrl.value));
const mediaIsAudio = computed(() => !!mediaUrl.value && /^data:audio\/|\.(mp3|wav|ogg|m4a)(\?|$)/i.test(mediaUrl.value));

const pretty = (v: any): string => {
  if (v === null || v === undefined) return '—';
  try {
    return typeof v === 'string' ? v : JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
};

const fmtSeconds = (s: number | null | undefined): string => {
  if (s === null || s === undefined) return '—';
  const v = Math.max(0, Math.trunc(s));
  if (v < 60) return `${v}s`;
  const m = Math.floor(v / 60);
  return `${m}m ${v % 60}s`;
};

const fmtTime = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleTimeString();
};

/** dotColor(): warn (timeout / reclaimed) BEFORE the default accent. */
const dotColor = (): string => {
  const s = (task.value.status || '').toLowerCase();
  if (s === 'timeout' || s === 'reclaimed') return 'var(--warning)';
  return 'var(--accent)';
};

const eventColor = (event: string): string => {
  const e = (event || '').toLowerCase();
  if (e === 'completed') return 'var(--success)';
  if (e === 'failed' || e === 'cancelled') return 'var(--danger, #e5484d)';
  if (e === 'timeout' || e === 'reclaimed') return 'var(--warning)';
  return 'var(--accent)';
};

/**
 * resolveMedia(): pull a single displayable media URL out of the task
 * result/payload. EARLY-OUT once resolved so it never re-derives per stream
 * tick (the contract's get_media spam guard).
 */
const resolveMedia = (): void => {
  if (mediaUrl.value) return;
  const r = task.value.result;
  if (!r || typeof r !== 'object') return;

  const directUrl = r.image_url || r.poster_url || r.media_url || r.url || r.saved_path;
  if (typeof directUrl === 'string' && directUrl) {
    mediaUrl.value = directUrl;
    return;
  }
  const b64 = r.image_base64 || r.poster_base64 || r.audio_base64;
  if (typeof b64 === 'string' && b64) {
    const mime = r.mime || (r.audio_base64 ? 'audio/mpeg' : 'image/png');
    mediaUrl.value = b64.startsWith('data:') ? b64 : `data:${mime};base64,${b64}`;
  }
};

const upsertEvent = (ev: TaskStreamEvent): void => {
  const key = String(ev._id ?? ev.id);
  if (eventIndex.has(key)) return; // de-dupe by id
  eventIndex.set(key, ev);
  timeline.value = [...timeline.value, ev];
};

const apiBase = getApiBase;

/** One-shot refetch via the /detail endpoint after a terminal close. */
const refetch = async (): Promise<void> => {
  try {
    const res = await fetch(`${apiBase()}${taskPath(props.taskId, 'detail')}`, {
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) return;
    const json = await res.json();
    const data = json?.data ?? json;
    if (data && data.task) applyBundle(data as TaskStreamBundle);
  } catch {
    /* terminal refetch is best-effort */
  }
};

const applyBundle = (b: TaskStreamBundle): void => {
  bundle.value = b;
  for (const ev of b.events || []) upsertEvent(ev);
  resolveMedia();
};

const openStream = (): void => {
  handle = subscribeToTaskStream(props.taskId, {
    onInitial: (b) => applyBundle(b),
    onEvent: (ev) => {
      upsertEvent(ev);
      resolveMedia();
    },
    onClose: (_cursor, done) => {
      // done===true => terminal: composable already declines to reconnect, so
      // refetch once for the final result/error snapshot. done!==true is handled
      // by the composable's reconnect-from-cursor (nothing to do here).
      if (done && !userClosed) refetch();
    },
    onError: (err) => {
      loadError.value = bundle.value ? '' : 'Live stream unavailable';
      console.warn('[TaskDetailModal] stream error', err);
    },
  });
};

const close = (): void => {
  userClosed = true;
  emit('close');
};

onMounted(() => {
  openStream();
});

// Close the EventSource on unmount.
onUnmounted(() => {
  userClosed = true;
  if (handle) {
    handle.close();
    handle = null;
  }
});
</script>

<style scoped>
.tdm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 12px;
}
.tdm-modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  width: 100%;
  max-width: 480px;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
}
.tdm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-2);
}
.tdm-title { display: flex; align-items: center; gap: 10px; min-width: 0; }
.tdm-icon { font-size: 22px; line-height: 1; }
.tdm-titletext { min-width: 0; }
.tdm-typelabel { font-weight: 700; font-size: 13px; color: var(--text); }
.tdm-taskid {
  font-size: 10px;
  color: var(--text-muted);
  font-family: ui-monospace, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 220px;
}
.tdm-headbadges { display: flex; align-items: center; gap: 6px; }
.tdm-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 3px 7px;
  border-radius: 999px;
  white-space: nowrap;
}
.tdm-badge-fast { background: var(--accent-soft); color: var(--accent-fg, var(--accent)); }
.tdm-badge-ai { background: var(--surface); border: 1px solid var(--accent); color: var(--accent); }
.tdm-badge-bump {
  background: var(--accent);
  color: #fff;
  border: none;
  cursor: pointer;
}
.tdm-badge-bump:hover:not(:disabled) { filter: brightness(1.08); }
.tdm-badge-bump:disabled { opacity: 0.6; cursor: default; }
.tdm-close {
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 14px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 6px;
}
.tdm-close:hover { background: var(--surface); color: var(--text); }
.tdm-body { padding: 12px 14px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
.tdm-loading, .tdm-error { color: var(--text-muted); font-size: 12px; padding: 8px 0; }
.tdm-error { color: var(--warning); }
.tdm-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.tdm-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--text);
}
.tdm-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--dot, var(--accent)); }
.tdm-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 12px;
  margin: 0;
}
.tdm-field { display: flex; flex-direction: column; gap: 1px; }
.tdm-field dt { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.03em; }
.tdm-field dd { font-size: 12px; color: var(--text); margin: 0; word-break: break-word; }
.tdm-media img, .tdm-media audio { max-width: 100%; border-radius: 8px; }
.tdm-section { border: 1px solid var(--border); border-radius: 8px; padding: 6px 8px; background: var(--surface-2); }
.tdm-section summary { cursor: pointer; font-size: 12px; font-weight: 600; color: var(--text); }
.tdm-pre {
  margin: 6px 0 0;
  font-size: 11px;
  font-family: ui-monospace, monospace;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text);
  max-height: 200px;
  overflow: auto;
}
.tdm-errbox {
  font-size: 12px;
  color: var(--warning);
  background: var(--surface-2);
  border: 1px solid var(--warning);
  border-radius: 8px;
  padding: 8px;
  white-space: pre-wrap;
}
.tdm-timeline { border-top: 1px solid var(--border); padding-top: 8px; }
.tdm-timeline-head { font-size: 12px; font-weight: 700; color: var(--text); margin-bottom: 6px; }
.tdm-timeline ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.tdm-event { display: flex; gap: 8px; }
.tdm-edot { width: 8px; height: 8px; border-radius: 50%; margin-top: 4px; flex-shrink: 0; }
.tdm-eventbody { flex: 1; min-width: 0; }
.tdm-eventrow { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.tdm-eventname { font-size: 12px; font-weight: 600; color: var(--text); }
.tdm-eventtime { font-size: 10px; color: var(--text-muted); }
.tdm-eventmeta { display: flex; gap: 8px; font-size: 10px; color: var(--text-muted); }
</style>
