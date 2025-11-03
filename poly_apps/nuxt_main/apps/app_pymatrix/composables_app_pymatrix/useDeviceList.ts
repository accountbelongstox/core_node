/**
 * Device List Management Composable
 *
 * Handles device list fetching, auto-refresh, and state management
 */

import { ref, onMounted, onUnmounted } from 'vue';
import { pyMatrixDeviceAPI } from '~/services/api/pymatrix/pymatrix-device-api';
import type { Device } from '../../../types/pymatrix';

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

    try {
      const response = await pyMatrixDeviceAPI.getDeviceList();
      devices.value = response.devices;
      lastUpdateTime.value = new Date();

      console.log('[useDeviceList] Fetched devices:', response.devices.length);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch devices';
      console.error('[useDeviceList] Error fetching devices:', err);
    } finally {
      loading.value = false;
    }
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
