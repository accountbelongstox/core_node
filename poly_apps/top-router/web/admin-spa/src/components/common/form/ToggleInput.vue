<template>
  <label
    class="inline-flex items-center gap-3"
    :class="[disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer']"
  >
    <input
      :checked="modelValue"
      class="peer sr-only"
      :disabled="disabled"
      type="checkbox"
      @change="onToggle"
    />
    <div
      :class="[
        trackClass,
        'peer relative rounded-full bg-gray-200 transition-colors peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:border-gray-600 dark:bg-gray-700 dark:peer-focus:ring-blue-800'
      ]"
    >
      <span
        :class="[
          thumbClass,
          'absolute left-[2px] top-[2px] rounded-full border border-gray-300 bg-white transition-all dark:border-gray-500 dark:bg-gray-200'
        ]"
      />
    </div>
    <span v-if="$slots.default" class="text-sm font-medium text-gray-900 dark:text-gray-200">
      <slot :checked="modelValue" />
    </span>
    <span v-else-if="showStateLabel" class="text-sm font-medium text-gray-900 dark:text-gray-200">
      {{ modelValue ? onLabel : offLabel }}
    </span>
  </label>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  onLabel: {
    type: String,
    default: '开启'
  },
  offLabel: {
    type: String,
    default: '关闭'
  },
  size: {
    type: String,
    default: 'md' // md | sm
  },
  disabled: {
    type: Boolean,
    default: false
  },
  showStateLabel: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

const sizeConfig = {
  md: {
    track: 'h-6 w-11 peer-checked:bg-blue-600',
    thumb: 'h-5 w-5 peer-checked:translate-x-full peer-checked:border-white'
  },
  sm: {
    track: 'h-5 w-9 peer-checked:bg-green-600',
    thumb: 'h-4 w-4 peer-checked:translate-x-full peer-checked:border-white'
  }
}

const trackClass = computed(() => sizeConfig[props.size]?.track || sizeConfig.md.track)
const thumbClass = computed(() => sizeConfig[props.size]?.thumb || sizeConfig.md.thumb)

const onToggle = (event) => {
  if (props.disabled) return
  const checked = event.target.checked
  emit('update:modelValue', checked)
  emit('change', checked)
}
</script>
