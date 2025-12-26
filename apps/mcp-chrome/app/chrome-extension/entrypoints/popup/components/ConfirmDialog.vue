<template>
  <div v-if="visible" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" @click.self="$emit('cancel')">
    <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
      <div class="flex items-center gap-4 p-6 border-b border-gray-200">
        <span class="text-3xl">{{ icon }}</span>
        <h3 class="text-xl font-bold text-gray-800">{{ title }}</h3>
      </div>

      <div class="p-6 space-y-4">
        <p class="text-sm text-gray-700 leading-relaxed">{{ message }}</p>

        <ul v-if="items && items.length > 0" class="space-y-2 pl-5 text-sm text-gray-600">
          <li v-for="item in items" :key="item" class="list-disc">{{ item }}</li>
        </ul>

        <div v-if="warning" class="p-4 bg-red-50 border-l-4 border-red-500 rounded">
          <strong class="text-sm text-red-800">{{ warning }}</strong>
        </div>
      </div>

      <div class="flex gap-3 p-6 bg-gray-50 border-t border-gray-200">
        <button class="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors" @click="$emit('cancel')">
          {{ cancelText }}
        </button>
        <button
          class="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white font-medium rounded-lg hover:from-red-600 hover:to-red-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-md"
          :disabled="isConfirming"
          @click="$emit('confirm')"
        >
          {{ isConfirming ? confirmingText : confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { getMessage } from '@/utils/i18n';
interface Props {
  visible: boolean;
  title: string;
  message: string;
  items?: string[];
  warning?: string;
  icon?: string;
  confirmText?: string;
  cancelText?: string;
  confirmingText?: string;
  isConfirming?: boolean;
}

interface Emits {
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}

withDefaults(defineProps<Props>(), {
  icon: '⚠️',
  confirmText: getMessage('confirmButton'),
  cancelText: getMessage('cancelButton'),
  confirmingText: getMessage('processingStatus'),
  isConfirming: false,
});

defineEmits<Emits>();
</script>

