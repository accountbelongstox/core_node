/**
 * Endpoint selection state shared by the header EndpointDropdown and the
 * Settings ApiSettings card: probe/test, manual pick, auto mode, custom
 * endpoints and the self-scheduling monitor loop. Components keep only markup
 * and their own labels.
 */

import { computed, onMounted, onUnmounted, ref } from 'vue';
import { apiManager, type ApiEndpoint, type EndpointStatus } from '@/services/ApiManager';
import { getMessage } from '@/utils/i18n';

const BASE_INTERVAL_MS = 15000;
const MAX_INTERVAL_MS = 60000;
const PROBE_TIMEOUT_MS = 3000;
const BACKOFF_FACTOR = 1.5;
const CUSTOM_ENDPOINT_PRIORITY = 99;
const LOG_PREFIX = '[Endpoint Selection]';

export function formatResponseTime(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`;
}

export function endpointAddress(endpoint: ApiEndpoint, withProtocol = true): string {
  const port = endpoint.port ? `:${endpoint.port}` : '';
  return withProtocol ? `${endpoint.protocol}://${endpoint.url}${port}` : `${endpoint.url}${port}`;
}

export function useEndpointSelection() {
  const open = ref(false);
  const rootRef = ref<HTMLElement | null>(null);

  const currentEndpoint = ref<ApiEndpoint | null>(null);
  const endpointStatuses = ref<EndpointStatus[]>([]);
  const isRefreshing = ref(false);
  const isAutoDetecting = ref(false);
  const testingId = ref<string | null>(null);
  const showCustomForm = ref(false);
  const autoMode = ref(false);
  const endpointsRevision = ref(0);

  const customUrl = ref('');
  const customProtocol = ref<'http' | 'https'>('http');
  const customPort = ref<number | undefined>(undefined);

  let monitorTimer: ReturnType<typeof setTimeout> | null = null;
  let currentBackoff = BASE_INTERVAL_MS;
  let disposed = false;
  let unsubscribeEndpoint: (() => void) | null = null;

  const sortedEndpoints = computed(() => {
    void endpointsRevision.value;
    return [...apiManager.getAllEndpoints()].sort((a, b) => a.priority - b.priority);
  });

  const currentEndpointUrl = computed(() =>
    currentEndpoint.value ? endpointAddress(currentEndpoint.value) : getMessage('apiNone'),
  );

  const isCurrentEndpoint = (id: string) => currentEndpoint.value?.id === id;

  const getStatus = (id: string): EndpointStatus | undefined =>
    endpointStatuses.value.find((s) => s.endpoint.id === id);

  const dotClass = (id: string): string => {
    const status = getStatus(id);
    if (!status) return 'bg-slate-500';
    return status.isAvailable ? 'bg-emerald-500' : 'bg-rose-500';
  };

  const headerDotClass = computed(() =>
    currentEndpoint.value ? dotClass(currentEndpoint.value.id) : 'bg-slate-500',
  );

  const upsertStatus = (status: EndpointStatus) => {
    const idx = endpointStatuses.value.findIndex((s) => s.endpoint.id === status.endpoint.id);
    if (idx >= 0) endpointStatuses.value[idx] = status;
    else endpointStatuses.value = [...endpointStatuses.value, status];
  };

  const syncSelection = () => {
    currentEndpoint.value = apiManager.getCurrentEndpoint();
    autoMode.value = apiManager.isAutoMode();
    endpointsRevision.value++;
  };

  const refreshEndpoints = async () => {
    if (isRefreshing.value) return;
    isRefreshing.value = true;
    try {
      // Manual "Test All" wants fast feedback — no retry (retries=0). The retry
      // only belongs to the monitor loop, where stability matters.
      endpointStatuses.value = await Promise.all(
        apiManager.getAllEndpoints().map((endpoint) =>
          apiManager.checkEndpoint(endpoint, PROBE_TIMEOUT_MS, 0),
        ),
      );
    } catch (error) {
      console.error(`${LOG_PREFIX} Failed to refresh endpoints:`, error);
    } finally {
      isRefreshing.value = false;
    }
  };

  const testEndpoint = async (endpoint: ApiEndpoint) => {
    if (testingId.value) return;
    testingId.value = endpoint.id;
    try {
      upsertStatus(await apiManager.checkEndpoint(endpoint, PROBE_TIMEOUT_MS, 0));
    } catch (error) {
      console.error(`${LOG_PREFIX} Failed to test endpoint:`, error);
    } finally {
      testingId.value = null;
    }
  };

  const selectEndpoint = async (endpointId: string) => {
    const success = await apiManager.setEndpoint(endpointId);
    if (success) {
      autoMode.value = false;
      open.value = false;
      currentEndpoint.value = apiManager.getCurrentEndpoint();
      currentBackoff = BASE_INTERVAL_MS;
    }
  };

  // Switch to auto mode: probe in weight order and ride the highest-weight
  // endpoint that answers. The monitor loop keeps it on the best available.
  const selectAuto = async () => {
    autoMode.value = true;
    open.value = false;
    await apiManager.setAutoMode(true);
    isAutoDetecting.value = true;
    try {
      const best = await apiManager.selectBestAvailable(PROBE_TIMEOUT_MS);
      endpointStatuses.value = [...apiManager.getAllEndpointStatuses()];
      if (best) currentEndpoint.value = best;
    } finally {
      isAutoDetecting.value = false;
      currentBackoff = BASE_INTERVAL_MS;
    }
  };

  const addCustomEndpoint = async () => {
    if (!customUrl.value) return;
    try {
      await apiManager.addCustomEndpoint({
        url: customUrl.value,
        protocol: customProtocol.value,
        port: customPort.value,
        priority: CUSTOM_ENDPOINT_PRIORITY,
        isLocal: false,
        description: getMessage('apiCustomEndpointDescription', [customUrl.value]),
      });
      customUrl.value = '';
      customPort.value = undefined;
      endpointsRevision.value++;
      await refreshEndpoints();
    } catch (error) {
      console.error(`${LOG_PREFIX} Failed to add custom endpoint:`, error);
    }
  };

  const scheduleNext = () => {
    if (disposed) return;
    monitorTimer = setTimeout(tick, currentBackoff);
  };

  // Self-scheduling monitor loop:
  //   • Auto mode  — sweep endpoints in weight order and ride the highest-weight
  //     one that answers, upgrading back as better endpoints recover.
  //   • Manual mode — only re-probe the pinned endpoint for its status dot and
  //     never switch away.
  // While everything is down the interval backs off (15s → up to 60s) so an
  // outage can't spin the CPU or flood the log; it resets on recovery.
  const tick = async () => {
    if (disposed) return;
    if (isRefreshing.value || testingId.value) {
      scheduleNext();
      return;
    }
    try {
      if (autoMode.value) {
        isAutoDetecting.value = true;
        const best = await apiManager.selectBestAvailable(PROBE_TIMEOUT_MS);
        endpointStatuses.value = [...apiManager.getAllEndpointStatuses()];
        if (best) {
          currentEndpoint.value = best;
          currentBackoff = BASE_INTERVAL_MS;
        } else {
          currentBackoff = Math.min(currentBackoff * BACKOFF_FACTOR, MAX_INTERVAL_MS);
        }
        return;
      }

      const current = currentEndpoint.value;
      if (current) {
        const status = await apiManager.checkEndpoint(current, PROBE_TIMEOUT_MS);
        upsertStatus(status);
        currentBackoff = status.isAvailable
          ? BASE_INTERVAL_MS
          : Math.min(currentBackoff * BACKOFF_FACTOR, MAX_INTERVAL_MS);
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} Monitor cycle failed:`, error);
      currentBackoff = Math.min(currentBackoff * BACKOFF_FACTOR, MAX_INTERVAL_MS);
    } finally {
      isAutoDetecting.value = false;
      scheduleNext();
    }
  };

  const onDocumentClick = (event: MouseEvent) => {
    if (!open.value) return;
    if (rootRef.value && !rootRef.value.contains(event.target as Node)) open.value = false;
  };

  onMounted(async () => {
    await apiManager.initialize({ autoDetect: false });
    syncSelection();
    // ApiManager follows api_settings from every context, so this also covers
    // selections made in another popup/options page or by the background.
    unsubscribeEndpoint = apiManager.onEndpointChange(() => {
      syncSelection();
      void refreshEndpoints();
    });
    await refreshEndpoints();
    // In auto mode, immediately settle on the best available endpoint so the
    // header reflects the real pick instead of the last provisional one.
    if (autoMode.value) {
      const best = await apiManager.selectBestAvailable(PROBE_TIMEOUT_MS);
      if (best) currentEndpoint.value = best;
    }
    document.addEventListener('click', onDocumentClick);
    scheduleNext();
  });

  onUnmounted(() => {
    disposed = true;
    unsubscribeEndpoint?.();
    unsubscribeEndpoint = null;
    document.removeEventListener('click', onDocumentClick);
    if (monitorTimer !== null) {
      clearTimeout(monitorTimer);
      monitorTimer = null;
    }
  });

  return {
    open,
    rootRef,
    currentEndpoint,
    endpointStatuses,
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
  };
}
