<!--
  【DEVELOPMENT STANDARDS】
  - NO <style> tags allowed in this component
  - All styles must reference theme variables via class names
  - Theme file: common/styles/theme-base.css
  - Extended theme: apps/app_codemart/styles_app_codemart/theme-codemart.css
-->
<template>
  <div class="codemart-customer-service">
    <!-- Chat Button -->
    <button
      v-if="!isOpen"
      class="codemart-cs-button"
      @click="toggleChat"
      :aria-label="t('codemart.customer_service.open_chat')"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M7 9H17M7 13H13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <span v-if="unreadCount > 0" class="codemart-cs-badge">{{ unreadCount }}</span>
    </button>

    <!-- Chat Window -->
    <div v-if="isOpen" class="codemart-cs-window">
      <!-- Header -->
      <div class="codemart-cs-header">
        <div class="codemart-cs-header-info">
          <div class="codemart-cs-avatar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 5C13.66 5 15 6.34 15 8C15 9.66 13.66 11 12 11C10.34 11 9 9.66 9 8C9 6.34 10.34 5 12 5ZM12 19.2C9.5 19.2 7.29 17.92 6 15.98C6.03 13.99 10 12.9 12 12.9C13.99 12.9 17.97 13.99 18 15.98C16.71 17.92 14.5 19.2 12 19.2Z"/>
            </svg>
          </div>
          <div>
            <div class="codemart-cs-name">{{ t('codemart.customer_service.support_team') }}</div>
            <div class="codemart-cs-status">
              <span class="codemart-cs-status-dot"></span>
              {{ t('codemart.customer_service.online') }}
            </div>
          </div>
        </div>
        <button class="codemart-cs-close" @click="toggleChat" :aria-label="t('common.close')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <!-- Messages -->
      <div class="codemart-cs-messages" ref="messagesContainer">
        <div
          v-for="message in messages"
          :key="message.id"
          :class="['codemart-cs-message', message.sender === 'user' ? 'codemart-cs-message-user' : 'codemart-cs-message-agent']"
        >
          <div class="codemart-cs-message-content">
            {{ message.text }}
          </div>
          <div class="codemart-cs-message-time">{{ formatTime(message.timestamp) }}</div>
        </div>

        <!-- Typing indicator -->
        <div v-if="isTyping" class="codemart-cs-message codemart-cs-message-agent">
          <div class="codemart-cs-typing">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div v-if="showQuickActions" class="codemart-cs-quick-actions">
        <button
          v-for="action in quickActions"
          :key="action.id"
          class="codemart-cs-quick-action"
          @click="sendQuickAction(action)"
        >
          {{ t(action.label) }}
        </button>
      </div>

      <!-- Input -->
      <div class="codemart-cs-input-container">
        <textarea
          v-model="inputMessage"
          class="codemart-cs-input"
          :placeholder="t('codemart.customer_service.type_message')"
          rows="1"
          @keydown.enter.exact.prevent="sendMessage"
          @input="adjustTextareaHeight"
          ref="inputTextarea"
        ></textarea>
        <button
          class="codemart-cs-send"
          @click="sendMessage"
          :disabled="!inputMessage.trim()"
          :aria-label="t('common.send')"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 8L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: Date;
}

interface QuickAction {
  id: string;
  label: string;
  text: string;
}

const isOpen = ref(false);
const inputMessage = ref('');
const messages = ref<Message[]>([]);
const isTyping = ref(false);
const unreadCount = ref(0);
const showQuickActions = ref(true);
const messagesContainer = ref<HTMLElement | null>(null);
const inputTextarea = ref<HTMLTextAreaElement | null>(null);

const quickActions: QuickAction[] = [
  { id: '1', label: 'codemart.cs.quick.how_to_start', text: 'How do I get started?' },
  { id: '2', label: 'codemart.cs.quick.pricing', text: 'What are your pricing options?' },
  { id: '3', label: 'codemart.cs.quick.payment', text: 'How does payment work?' },
  { id: '4', label: 'codemart.cs.quick.support', text: 'I need help with my project' },
];

const toggleChat = () => {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    unreadCount.value = 0;
    if (messages.value.length === 0) {
      // Send welcome message
      addAgentMessage(t('codemart.customer_service.welcome'));
    }
    nextTick(() => {
      scrollToBottom();
      inputTextarea.value?.focus();
    });
  }
};

const addMessage = (sender: 'user' | 'agent', text: string) => {
  messages.value.push({
    id: Date.now().toString(),
    sender,
    text,
    timestamp: new Date()
  });
  nextTick(() => scrollToBottom());
};

const addAgentMessage = (text: string) => {
  isTyping.value = true;
  setTimeout(() => {
    isTyping.value = false;
    addMessage('agent', text);
    if (!isOpen.value) {
      unreadCount.value++;
    }
  }, 1000 + Math.random() * 1000);
};

const sendMessage = () => {
  if (!inputMessage.value.trim()) return;

  const text = inputMessage.value.trim();
  addMessage('user', text);
  inputMessage.value = '';
  showQuickActions.value = false;

  // Adjust textarea height back to default
  if (inputTextarea.value) {
    inputTextarea.value.style.height = 'auto';
  }

  // Simulate agent response
  addAgentMessage(getAutoResponse(text));
};

const sendQuickAction = (action: QuickAction) => {
  inputMessage.value = action.text;
  sendMessage();
};

const adjustTextareaHeight = () => {
  if (inputTextarea.value) {
    inputTextarea.value.style.height = 'auto';
    inputTextarea.value.style.height = inputTextarea.value.scrollHeight + 'px';
  }
};

const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getAutoResponse = (userMessage: string): string => {
  const lowerMessage = userMessage.toLowerCase();

  if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('pricing')) {
    return t('codemart.cs.response.pricing');
  } else if (lowerMessage.includes('payment') || lowerMessage.includes('pay')) {
    return t('codemart.cs.response.payment');
  } else if (lowerMessage.includes('start') || lowerMessage.includes('begin')) {
    return t('codemart.cs.response.getting_started');
  } else if (lowerMessage.includes('help') || lowerMessage.includes('support')) {
    return t('codemart.cs.response.support');
  } else {
    return t('codemart.cs.response.default');
  }
};

onMounted(() => {
  // Show initial notification after a delay
  setTimeout(() => {
    if (!isOpen.value && messages.value.length === 0) {
      unreadCount.value = 1;
    }
  }, 5000);
});
</script>

<!-- NO <style> tag - All styles defined in theme files -->
