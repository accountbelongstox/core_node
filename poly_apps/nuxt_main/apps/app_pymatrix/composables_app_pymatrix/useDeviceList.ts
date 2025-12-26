/**
 * Device List Management Composable
 *
 * Handles device list fetching, auto-refresh, and state management
 */

import { ref, onMounted, onUnmounted } from 'vue';
import { pyMatrixDeviceAPI } from '@/services/api/pymatrix/pymatrix-device-api';
import { INITIAL_DEVICES } from '@/app_pymatrix_pages/constants/initial-state';
import type { Device } from '@/types/pymatrix';

export interface UseDeviceListOptions {
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
}

export function useDeviceList(options: UseDeviceListOptions = {}) {
  const {
    autoRefresh = true,
    refreshInterval = 5000 // 5 seconds
  } = options;

  const devices = ref<Device[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lastUpdateTime = ref<Date | null>(null);

  let refreshTimer: NodeJS.Timeout | null = null;

  /**
   * Fetch device list from backend
   */
  async function fetchDevices() {
    loading.value = true;
    error.value = null;

    const outcome = await pyMatrixDeviceAPI.getDeviceList().then(
      (response) => ({ status: 'success' as const, response }),
      (err) => ({ status: 'error' as const, error: err })
    );

    if (outcome.status === 'error') {
      error.value = outcome.error instanceof Error ? outcome.error.message : 'Failed to fetch devices';
      console.warn('[useDeviceList] Falling back to initial device list due to error');
      devices.value = INITIAL_DEVICES.map(device => ({ ...device }));
    } else {
      devices.value = outcome.response.devices;
      console.log('[useDeviceList] Fetched devices:', outcome.response.devices.length);
    }

    lastUpdateTime.value = new Date();
    loading.value = false;
  }

  /**
   * Start auto-refresh timer
   */
  function startAutoRefresh() {
    if (!autoRefresh) return;

    stopAutoRefresh();
    refreshTimer = setInterval(() => {
      fetchDevices();
    }, refreshInterval);

    console.log('[useDeviceList] Auto-refresh started');
  }

  /**
   * Stop auto-refresh timer
   */
  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
      console.log('[useDeviceList] Auto-refresh stopped');
    }
  }

  /**
   * Manually refresh device list
   */
  async function refresh() {
    await fetchDevices();
  }

  /**
   * Get device by serial
   */
  function getDevice(serial: string): Device | undefined {
    return devices.value.find(d => d.serial === serial);
  }

  /**
   * Add or update a device in the list
   */
  function updateDevice(device: Device) {
    const index = devices.value.findIndex(d => d.serial === device.serial);
    if (index >= 0) {
      devices.value[index] = device;
    } else {
      devices.value.push(device);
    }
  }

  /**
   * Remove a device from the list
   */
  function removeDevice(serial: string) {
    const index = devices.value.findIndex(d => d.serial === serial);
    if (index >= 0) {
      devices.value.splice(index, 1);
    }
  }

  // Lifecycle hooks
  onMounted(async () => {
    await fetchDevices();
    startAutoRefresh();
  });

  onUnmounted(() => {
    stopAutoRefresh();
  });

  return {
    devices,
    loading,
    error,
    lastUpdateTime,
    fetchDevices,
    refresh,
    getDevice,
    updateDevice,
    removeDevice,
    startAutoRefresh,
    stopAutoRefresh
  };
}
