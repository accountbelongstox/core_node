<template>
  <div class="inline-flex flex-wrap items-center gap-3">
    <input
      ref="fileInput"
      :accept="accept"
      class="hidden"
      :multiple="multiple"
      type="file"
      @change="handleChange"
    />
    <button :class="buttonClass" :disabled="disabled" type="button" @click="triggerSelect">
      <slot name="icon">
        <i v-if="icon" :class="[icon, 'mr-2']"></i>
      </slot>
      <span>{{ buttonText }}</span>
    </button>
    <slot name="hint">
      <span v-if="hint" class="text-xs text-gray-500 dark:text-gray-400">{{ hint }}</span>
    </slot>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  buttonText: {
    type: String,
    default: '选择文件'
  },
  accept: {
    type: String,
    default: '*'
  },
  multiple: {
    type: Boolean,
    default: false
  },
  icon: {
    type: String,
    default: 'fas fa-upload'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  hint: {
    type: String,
    default: ''
  },
  variant: {
    type: String,
    default: 'primary' // primary | success | outline
  }
})

const emit = defineEmits(['select'])
const fileInput = ref(null)

const variantClassMap = {
  primary:
    'inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:cursor-not-allowed disabled:bg-blue-300',
  success:
    'inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:bg-emerald-300',
  outline:
    'inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-60'
}

const buttonClass = computed(() => variantClassMap[props.variant] || variantClassMap.primary)

const triggerSelect = () => {
  if (props.disabled) return
  fileInput.value?.click()
}

const handleChange = (event) => {
  const files = Array.from(event.target.files || [])
  if (files.length) {
    emit('select', files)
  }
  event.target.value = ''
}
</script>
