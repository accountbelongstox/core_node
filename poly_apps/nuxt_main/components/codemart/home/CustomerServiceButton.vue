<template>
  <div class="customer-service-wrapper">
    <Transition name="chat">
      <div v-if="showChat" class="chat-panel">
        <div class="chat-header">
          <div class="header-info">
            <div class="avatar-status">
              <img :src="agentAvatar" alt="Customer Service" class="agent-avatar">
              <span class="status-indicator"></span>
            </div>
            <div class="agent-info">
              <h3 class="agent-name">Customer Support</h3>
              <p class="agent-status">Online - We're here to help</p>
            </div>
          </div>
          <button class="close-btn" @click="toggleChat">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="chat-messages" ref="messagesContainer">
          <div
            v-for="message in messages"
            :key="message.id"
            class="message"
            :class="message.type"
          >
            <div v-if="message.type === 'agent'" class="message-avatar">
              <img :src="agentAvatar" alt="Agent">
            </div>
            <div class="message-bubble">
              <p>{{ message.text }}</p>
              <span class="message-time">{{ message.time }}</span>
            </div>
          </div>

          <div v-if="isTyping" class="message agent">
            <div class="message-avatar">
              <img :src="agentAvatar" alt="Agent">
            </div>
            <div class="message-bubble typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>

        <div class="chat-input-area">
          <div class="quick-actions">
            <button
              v-for="action in quickActions"
              :key="action.id"
              class="quick-action-btn"
              @click="sendQuickMessage(action.text)"
            >
              {{ action.label }}
            </button>
          </div>
          <div class="input-container">
            <input
              v-model="messageInput"
              type="text"
              placeholder="Type your message..."
              class="message-input"
              @keypress.enter="sendMessage"
            >
            <button class="send-btn" @click="sendMessage" :disabled="!messageInput.trim()">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <button
      class="service-button"
      :class="{ 'chat-open': showChat }"
      @click="toggleChat"
    >
      <Transition name="icon-fade" mode="out-in">
        <svg v-if="!showChat" key="chat" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
        </svg>
        <svg v-else key="close" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </Transition>
      <span v-if="unreadCount > 0" class="unread-badge">{{ unreadCount }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue';

const showChat = ref(false);
const messageInput = ref('');
const isTyping = ref(false);
const unreadCount = ref(0);
const messagesContainer = ref<HTMLElement | null>(null);

const agentAvatar = ref('https://placeholder-image.anthropic.com/80x80/support-agent');

const messages = ref([
  {
    id: 1,
    type: 'agent',
    text: 'Hello! How can I help you today?',
    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }
]);

const quickActions = ref([
  { id: 1, label: 'Pricing', text: 'Tell me about pricing' },
  { id: 2, label: 'Services', text: 'What services do you offer?' },
  { id: 3, label: 'Contact', text: 'How can I contact you?' }
]);

const toggleChat = () => {
  showChat.value = !showChat.value;
  if (showChat.value) {
    unreadCount.value = 0;
    nextTick(() => {
      scrollToBottom();
    });
  }
};

const sendMessage = () => {
  if (!messageInput.value.trim()) return;

  const newMessage = {
    id: messages.value.length + 1,
    type: 'user',
    text: messageInput.value,
    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  };

  messages.value.push(newMessage);
  messageInput.value = '';

  nextTick(() => {
    scrollToBottom();
  });

  simulateAgentResponse();
};

const sendQuickMessage = (text: string) => {
  messageInput.value = text;
  sendMessage();
};

const simulateAgentResponse = () => {
  isTyping.value = true;

  setTimeout(() => {
    isTyping.value = false;

    const responses = [
      'Thank you for your message! Let me help you with that.',
      'Great question! Our team can assist you with this.',
      'I\'d be happy to provide more information about this.',
      'Let me connect you with the right specialist for this inquiry.'
    ];

    const randomResponse = responses[Math.floor(Math.random() * responses.length)];

    messages.value.push({
      id: messages.value.length + 1,
      type: 'agent',
      text: randomResponse,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    });

    nextTick(() => {
      scrollToBottom();
    });

    if (!showChat.value) {
      unreadCount.value++;
    }
  }, 1500);
};

const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};
</script>

<style scoped>
.customer-service-wrapper {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: 999;
}

.service-button {
  width: 4rem;
  height: 4rem;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  border: none;
  border-radius: 50%;
  color: white;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);
  transition: all 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.service-button:hover {
  transform: scale(1.1);
  box-shadow: 0 12px 32px rgba(99, 102, 241, 0.5);
}

.service-button.chat-open {
  background: #ef4444;
}

.service-button svg {
  width: 2rem;
  height: 2rem;
}

.unread-badge {
  position: absolute;
  top: -0.25rem;
  right: -0.25rem;
  background: #ef4444;
  color: white;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  min-width: 1.5rem;
  text-align: center;
  border: 2px solid white;
}

.chat-panel {
  position: absolute;
  bottom: 5rem;
  right: 0;
  width: 400px;
  height: 600px;
  background: white;
  border-radius: 1.5rem;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-header {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  padding: 1.25rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.header-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
}

.avatar-status {
  position: relative;
}

.agent-avatar {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  border: 2px solid white;
  object-fit: cover;
}

.status-indicator {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 0.875rem;
  height: 0.875rem;
  background: #10b981;
  border: 2px solid white;
  border-radius: 50%;
}

.agent-info {
  flex: 1;
}

.agent-name {
  font-size: 1rem;
  font-weight: 700;
  margin: 0 0 0.25rem 0;
}

.agent-status {
  font-size: 0.8125rem;
  margin: 0;
  opacity: 0.9;
}

.close-btn {
  width: 2rem;
  height: 2rem;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 0.5rem;
  color: white;
  cursor: pointer;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.close-btn svg {
  width: 1.25rem;
  height: 1.25rem;
}

.chat-messages {
  flex: 1;
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: #f8fafc;
}

.message {
  display: flex;
  gap: 0.75rem;
  align-items: flex-end;
}

.message.user {
  flex-direction: row-reverse;
}

.message-avatar {
  flex-shrink: 0;
}

.message-avatar img {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  object-fit: cover;
}

.message-bubble {
  max-width: 70%;
  padding: 0.875rem 1.125rem;
  border-radius: 1rem;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.message.user .message-bubble {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
}

.message-bubble p {
  margin: 0 0 0.5rem 0;
  font-size: 0.9375rem;
  line-height: 1.5;
}

.message-time {
  font-size: 0.75rem;
  opacity: 0.6;
}

.typing-indicator {
  display: flex;
  gap: 0.375rem;
  padding: 1rem 1.25rem;
}

.typing-indicator span {
  width: 0.5rem;
  height: 0.5rem;
  background: #94a3b8;
  border-radius: 50%;
  animation: typing 1.4s infinite;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.7;
  }
  30% {
    transform: translateY(-0.5rem);
    opacity: 1;
  }
}

.chat-input-area {
  background: white;
  border-top: 1px solid #e2e8f0;
  padding: 1rem;
  flex-shrink: 0;
}

.quick-actions {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  overflow-x: auto;
  padding-bottom: 0.5rem;
}

.quick-action-btn {
  padding: 0.5rem 1rem;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 1rem;
  color: #475569;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
}

.quick-action-btn:hover {
  background: #e0e7ff;
  border-color: #6366f1;
  color: #6366f1;
}

.input-container {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.message-input {
  flex: 1;
  padding: 0.875rem 1rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 1rem;
  font-size: 0.9375rem;
  transition: all 0.2s;
}

.message-input:focus {
  outline: none;
  border-color: #6366f1;
  background: white;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.send-btn {
  width: 2.75rem;
  height: 2.75rem;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  border: none;
  border-radius: 50%;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.send-btn:hover:not(:disabled) {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.send-btn svg {
  width: 1.25rem;
  height: 1.25rem;
}

.chat-enter-active,
.chat-leave-active {
  transition: all 0.3s ease;
}

.chat-enter-from,
.chat-leave-to {
  opacity: 0;
  transform: translateY(1rem) scale(0.95);
}

.icon-fade-enter-active,
.icon-fade-leave-active {
  transition: all 0.2s ease;
}

.icon-fade-enter-from,
.icon-fade-leave-to {
  opacity: 0;
  transform: scale(0.8) rotate(90deg);
}

@media (max-width: 768px) {
  .customer-service-wrapper {
    bottom: 1rem;
    right: 1rem;
  }

  .service-button {
    width: 3.5rem;
    height: 3.5rem;
  }

  .service-button svg {
    width: 1.75rem;
    height: 1.75rem;
  }

  .chat-panel {
    width: calc(100vw - 2rem);
    max-width: 400px;
    height: 500px;
  }
}
</style>
