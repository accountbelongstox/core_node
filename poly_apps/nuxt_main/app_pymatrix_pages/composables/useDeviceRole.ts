import { computed } from 'vue';
import { useGroupStore } from '@/app_pymatrix_pages/stores/groupStore';

export type DeviceRole = 'host' | 'slave' | 'free';

/**
 * Composable to get device role in group control
 * @param deviceSerial - Device serial number
 * @returns Device role (host, slave, or free)
 */
export function useDeviceRole(deviceSerial: string) {
  const groupStore = useGroupStore();

  const role = computed<DeviceRole>(() => {
    if (!groupStore.hasGroup || !groupStore.enabled) {
      return 'free';
    }

    if (groupStore.isHost(deviceSerial)) {
      return 'host';
    }

    if (groupStore.isSlave(deviceSerial)) {
      return 'slave';
    }

    return 'free';
  });

  const isHost = computed(() => role.value === 'host');
  const isSlave = computed(() => role.value === 'slave');
  const isFree = computed(() => role.value === 'free');
  const isInGroup = computed(() => role.value !== 'free');

  return {
    role,
    isHost,
    isSlave,
    isFree,
    isInGroup
  };
}
