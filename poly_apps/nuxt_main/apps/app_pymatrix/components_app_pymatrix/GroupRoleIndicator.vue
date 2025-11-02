<template>
  <div
    v-if="role !== 'free'"
    class="group-role-indicator"
    :class="[
      `role-${role}`,
      `size-${size}`,
      { 'show-label': showLabel }
    ]"
    :title="tooltipText"
  >
    <div class="role-icon">{{ roleIcon }}</div>
    <div v-if="showLabel" class="role-label">{{ roleText }}</div>
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

<style scoped>
.group-role-indicator {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: 6px;
  padding: 4px 8px;
  font-weight: 600;
  transition: all 0.2s ease;
}

/* Role Colors */
.group-role-indicator.role-host {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border: 1px solid #fbbf24;
  color: #92400e;
}

.group-role-indicator.role-slave {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  border: 1px solid #60a5fa;
  color: #1e40af;
}

/* Sizes */
.group-role-indicator.size-xs {
  padding: 2px 4px;
  border-radius: 4px;
}

.group-role-indicator.size-xs .role-icon {
  font-size: 12px;
}

.group-role-indicator.size-xs .role-label {
  font-size: 10px;
}

.group-role-indicator.size-sm {
  padding: 3px 6px;
  border-radius: 5px;
}

.group-role-indicator.size-sm .role-icon {
  font-size: 14px;
}

.group-role-indicator.size-sm .role-label {
  font-size: 11px;
}

.group-role-indicator.size-md {
  padding: 4px 8px;
  border-radius: 6px;
}

.group-role-indicator.size-md .role-icon {
  font-size: 16px;
}

.group-role-indicator.size-md .role-label {
  font-size: 12px;
}

.group-role-indicator.size-lg {
  padding: 6px 12px;
  border-radius: 8px;
}

.group-role-indicator.size-lg .role-icon {
  font-size: 20px;
}

.group-role-indicator.size-lg .role-label {
  font-size: 14px;
}

.role-icon {
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.role-label {
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

/* Hover Effect */
.group-role-indicator:hover {
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

/* Animation */
@keyframes pulse-host {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.7);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(251, 191, 36, 0);
  }
}

@keyframes pulse-slave {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(96, 165, 250, 0.7);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(96, 165, 250, 0);
  }
}

.group-role-indicator.role-host {
  animation: pulse-host 2s infinite;
}

.group-role-indicator.role-slave {
  animation: pulse-slave 2s infinite;
}
</style>
