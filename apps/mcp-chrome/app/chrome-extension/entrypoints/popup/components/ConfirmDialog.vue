<template>
  <div v-if="visible" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50" @click.self="$emit('cancel')">
    <div class="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden">
      <div class="flex items-center gap-3 px-4 py-3 border-b border-slate-700">
        <span class="text-lg">{{ icon }}</span>
        <h3 class="text-sm font-bold text-slate-200">{{ title }}</h3>
      </div>

      <div class="px-4 py-3 space-y-2">
        <p class="text-[10px] text-slate-300 leading-relaxed">{{ message }}</p>

        <ul v-if="items && items.length > 0" class="space-y-1 pl-4 text-[10px] text-slate-400">
          <li v-for="item in items" :key="item" class="list-disc">{{ item }}</li>
        </ul>

        <div v-if="warning" class="p-2 bg-rose-500/10 border-l-2 border-rose-500 rounded">
          <strong class="text-[10px] text-rose-400">{{ warning }}</strong>
        </div>
      </div>

      <div class="flex gap-2 px-4 py-3 bg-slate-950 border-t border-slate-700">
        <button class="flex-1 px-3 py-1.5 bg-slate-700 text-slate-300 text-[10px] font-bold rounded-md hover:bg-slate-600 transition-colors" @click="$emit('cancel')">
          {{ cancelText }}
        </button>
        <button
          class="flex-1 px-3 py-1.5 bg-rose-600 text-white text-[10px] font-bold rounded-md hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

