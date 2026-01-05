<template>
  <div class="stat-card">
    <div class="flex items-start justify-between">
      <div class="flex-1">
        <p :class="titleClass">
          <slot name="title">{{ title }}</slot>
        </p>
        <p :class="valueClass">
          <slot name="value">{{ value }}</slot>
        </p>
        <p v-if="subtitle || $slots.subtitle" :class="subtitleClass">
          <slot name="subtitle">{{ subtitle }}</slot>
        </p>
      </div>
      <div :class="['stat-icon flex-shrink-0', iconBgClass]">
        <slot name="icon">
          <i v-if="icon" :class="[icon, 'text-sm sm:text-base']" />
        </slot>
      </div>
    </div>
    <slot name="footer" />
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  value: {
    type: [String, Number],
    required: true
  },
  subtitle: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: ''
  },
  iconColor: {
    type: String,
    default: 'primary'
  },
  valueClass: {
    type: String,
    default: 'text-2xl font-bold text-gray-800 dark:text-gray-100 sm:text-3xl'
  },
  titleClass: {
    type: String,
    default: 'mb-1 text-xs font-medium text-gray-600 dark:text-gray-400 sm:text-sm'
  },
  subtitleClass: {
    type: String,
    default: 'mt-1.5 text-xs text-gray-500 dark:text-gray-400 sm:mt-2 sm:text-sm'
  }
})

const iconBgClass = computed(() => {
  const colorMap = {
    primary: 'bg-gradient-to-br from-blue-500 to-purple-500',
    success: 'bg-gradient-to-br from-green-500 to-emerald-500',
    warning: 'bg-gradient-to-br from-yellow-500 to-orange-500',
    danger: 'bg-gradient-to-br from-red-500 to-pink-500',
    info: 'bg-gradient-to-br from-cyan-500 to-blue-500'
  }
  return colorMap[props.iconColor] || colorMap.primary
})
</script>

<style scoped>
/* 使用全局样式中定义的 .stat-card 和 .stat-icon 类 */
</style>
