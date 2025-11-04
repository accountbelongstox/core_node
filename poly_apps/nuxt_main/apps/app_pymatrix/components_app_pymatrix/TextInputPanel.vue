<template>
  <BasePanel
    v-model="isOpen"
    title="Text Input"
    header-icon="⌨️"
    size="md"
    variant="primary"
    @close="handleClose"
  >
    <div class="pm-panel pm-panel--blue">
      <div class="pm-input-section">
        <label class="pm-form-label">Enter text to send to device:</label>
        <textarea
          v-model="text"
          class="pm-textarea"
          placeholder="Type or paste text here..."
          rows="4"
          :maxlength="maxLength"
          @keydown.ctrl.enter="sendText"
          @keydown.meta.enter="sendText"
        ></textarea>
        <div class="pm-input-info">
          <span class="pm-char-count" :class="{ 'pm-char-count--warning': text.length > maxLength * 0.9 }">
            {{ text.length }} / {{ maxLength }}
          </span>
          <span class="pm-input-hint">Ctrl+Enter to send</span>
        </div>
      </div>

      <div class="pm-quick-actions">
        <div class="pm-section-label">Quick Actions:</div>
        <div class="pm-action-buttons">
          <BaseButton
            v-for="action in quickActions"
            :key="action.text"
            variant="ghost"
            size="sm"
            @click="insertQuickText(action.text)"
            :title="action.description"
          >
            {{ action.label }}
          </BaseButton>
        </div>
      </div>

      <div class="pm-send-section">
        <BaseButton
          variant="primary"
          size="md"
          block
          :loading="sending"
          :disabled="!text.trim()"
          icon="📤"
          @click="sendText"
          class="pm-button pm-button--electric-blue"
        >
          {{ sending ? 'Sending...' : 'Send Text' }}
        </BaseButton>

        <BaseButton
          variant="ghost"
          size="md"
          :disabled="!text"
          @click="clearText"
        >
          Clear
        </BaseButton>
      </div>

      <div v-if="lastSent" class="pm-last-sent">
        <div class="pm-last-sent-label">Last sent:</div>
        <div class="pm-last-sent-text">{{ truncate(lastSent, 50) }}</div>
      </div>
    </div>
  </BasePanel>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import BasePanel from '~/common/components/ui/BasePanel.vue';
import BaseButton from '~/common/components/ui/BaseButton.vue';

interface QuickAction {
  label: string;
  text: string;
  description: string;
}

interface Props {
  show?: boolean;
  maxLength?: number;
}

interface Emits {
  (e: 'close'): void;
  (e: 'send', text: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  show: true,
  maxLength: 5000
});

const emit = defineEmits<Emits>();

const isOpen = ref(props.show);
const text = ref('');
const sending = ref(false);
const lastSent = ref('');

const quickActions: QuickAction[] = [
  { label: 'Enter', text: '\n', description: 'Insert newline' },
  { label: 'Tab', text: '\t', description: 'Insert tab' },
  { label: 'Space', text: ' ', description: 'Insert space' },
  { label: 'Clear', text: '', description: 'Clear all text' }
];

function handleClose() {
  isOpen.value = false;
  emit('close');
}

async function sendText() {
  const textToSend = text.value.trim();

  if (!textToSend) return;

  sending.value = true;

  try {
    emit('send', textToSend);
    lastSent.value = textToSend;
    text.value = '';
  } finally {
    setTimeout(() => {
      sending.value = false;
    }, 500);
  }
}

function insertQuickText(quickText: string) {
  if (quickText === '') {
    clearText();
  } else {
    const cursorPos = text.value.length;
    text.value = text.value.slice(0, cursorPos) + quickText + text.value.slice(cursorPos);
  }
}

function clearText() {
  text.value = '';
}

function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}
</script>

