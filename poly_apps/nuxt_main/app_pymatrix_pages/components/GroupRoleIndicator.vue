<template>
  <div
    v-if="role !== 'free'"
    class="pm-role-badge"
    :class="[
      role === 'host' ? 'pm-role-badge--host' : 'pm-role-badge--member',
      `size-${size}`,
      { 'show-label': showLabel }
    ]"
    :title="tooltipText"
  >
    <div class="pm-role-badge__icon">{{ roleIcon }}</div>
    <div v-if="showLabel" class="pm-role-badge__text">{{ roleText }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

type DeviceRole = 'host' | 'slave' | 'free';
type IndicatorSize = 'xs' | 'sm' | 'md' | 'lg';

interface Props {
  deviceSerial: string;
  role?: DeviceRole;
  size?: IndicatorSize;
  showLabel?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  role: 'free',
  size: 'md',
  showLabel: false
});

const roleIcon = computed(() => {
  switch (props.role) {
    case 'host':
      return '👑';
    case 'slave':
      return '📱';
    default:
      return '';
  }
});

const roleText = computed(() => {
  switch (props.role) {
    case 'host':
      return 'Host';
    case 'slave':
      return 'Slave';
    default:
      return 'Free';
  }
});

const tooltipText = computed(() => {
  switch (props.role) {
    case 'host':
      return 'Host Device - Controls slave devices';
    case 'slave':
      return 'Slave Device - Follows host actions';
    default:
      return 'Free Device - Not in group';
  }
});
</script>
