<template>
  <BasePanel
    v-model="isOpen"
    title="Text Input"
    header-icon="⌨️"
    size="md"
    variant="primary"
    @close="handleClose"
  >
    <div class="text-input-content">
      <div class="input-section">
        <label class="input-label">Enter text to send to device:</label>
        <textarea
          v-model="text"
          class="text-area"
          placeholder="Type or paste text here..."
          rows="4"
          :maxlength="maxLength"
          @keydown.ctrl.enter="sendText"
          @keydown.meta.enter="sendText"
        />
        <div class="input-info">
          <span class="char-count" :class="{ warning: text.length > maxLength * 0.9 }">
            {{ text.length }} / {{ maxLength }}
          </span>
          <span class="input-hint">Ctrl+Enter to send</span>
        </div>
      </div>

      <div class="quick-actions">
        <div class="section-label">Quick Actions:</div>
        <div class="action-buttons">
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

      <div class="send-section">
        <BaseButton
          variant="primary"
          size="md"
          block
          :loading="sending"
          :disabled="!text.trim()"
          icon="📤"
          @click="sendText"
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

      <div v-if="lastSent" class="last-sent">
        <div class="last-sent-label">Last sent:</div>
        <div class="last-sent-text">{{ truncate(lastSent, 50) }}</div>
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

<style scoped>
.text-input-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.input-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-label {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.text-area {
  width: 100%;
  padding: 12px;
  font-size: 14px;
  font-family: 'Segoe UI', system-ui, sans-serif;
  color: #1f2937;
  background: #f9fafb;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  resize: vertical;
  transition: all 0.2s ease;
}

.text-area:focus {
  outline: none;
  border-color: #3b82f6;
  background: white;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.input-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.char-count {
  color: #6b7280;
  font-weight: 500;
}

.char-count.warning {
  color: #f59e0b;
  font-weight: 600;
}

.input-hint {
  color: #9ca3af;
  font-style: italic;
}

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.action-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.send-section {
  display: flex;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid #e5e7eb;
}

.last-sent {
  padding: 12px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
}

.last-sent-label {
  font-size: 11px;
  font-weight: 600;
  color: #15803d;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.last-sent-text {
  font-size: 13px;
  color: #166534;
  word-break: break-word;
}
</style>
