<template>
  <header class="ittools-header">
    <div class="header-main">
      <div class="header-content">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center">
            <div class="logo-icon">
              <i class="fas fa-rocket text-white text-lg"></i>
              <div class="logo-glow"></div>
            </div>
            <div class="ml-4">
              <h1 class="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Developer Hub
              </h1>
              <p class="text-xs text-gray-500">Web Automation & Developer Tools</p>
            </div>
          </div>
          <div class="flex items-center space-x-3">
            <div class="connection-status" :class="{ 'connected': connection.connected }">
              <div class="status-dot"></div>
              <span>{{ connection.text }}</span>
            </div>
            <button
              @click="$emit('toggle-sidebar')"
              class="header-btn"
            >
              <i class="fas fa-bars"></i>
            </button>
            <button class="header-btn user-btn">
              <i class="fas fa-user-circle"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
    <div class="header-tabs">
      <div class="tabs-content">
        <nav class="tab-nav">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="$emit('switch-tab', tab.id)"
            class="tab-btn"
            :class="{ 'active': activeTab === tab.id }"
          >
            <i :class="tab.icon" class="tab-icon"></i>
            <span>{{ tab.name }}</span>
            <span v-if="tab.badge" class="tab-badge">
              {{ tab.badge }}
            </span>
            <div v-if="activeTab === tab.id" class="tab-indicator"></div>
          </button>
        </nav>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
interface TabItem {
  id: string;
  name: string;
  icon: string;
  badge?: string;
}

const props = defineProps<{
  tabs: TabItem[];
  activeTab: string;
  connection: { text: string; connected: boolean };
}>();

defineEmits(['toggle-sidebar', 'switch-tab']);
</script>

<style scoped>
.ittools-header {
  position: relative;
  z-index: 30;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: 
    0 4px 30px rgba(99, 102, 241, 0.06),
    inset 0 -1px 0 rgba(255, 255, 255, 0.8);
}

.header-main {
  padding: 0 1.5rem;
}

.header-content {
  max-width: 100%;
}

.logo-icon {
  position: relative;
  width: 44px;
  height: 44px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 
    0 4px 15px rgba(99, 102, 241, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  overflow: hidden;
}

.logo-glow {
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: conic-gradient(
    from 0deg,
    transparent 0%,
    rgba(255, 255, 255, 0.3) 10%,
    transparent 20%
  );
  animation: spin 3s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.875rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 500;
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
  border: 1px solid rgba(239, 68, 68, 0.2);
  transition: all 0.3s ease;
}

.connection-status.connected {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
  border-color: rgba(34, 197, 94, 0.2);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.5);
  animation: pulse 2s ease-in-out infinite;
}

.connection-status.connected .status-dot {
  background: #22c55e;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.header-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(229, 231, 235, 0.8);
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s ease;
}

.header-btn:hover {
  background: rgba(99, 102, 241, 0.08);
  border-color: rgba(99, 102, 241, 0.2);
  color: #6366f1;
  transform: translateY(-1px);
}

.user-btn {
  font-size: 1.125rem;
}

.header-tabs {
  border-top: 1px solid rgba(229, 231, 235, 0.5);
}

.tabs-content {
  padding: 0.75rem 1.5rem;
}

.tab-nav {
  display: flex;
  gap: 0.5rem;
}

.tab-btn {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #6b7280;
  background: transparent;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  overflow: hidden;
}

.tab-btn:hover {
  background: rgba(99, 102, 241, 0.06);
  color: #4f46e5;
}

.tab-btn.active {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.12) 100%);
  color: #4f46e5;
  border-color: rgba(99, 102, 241, 0.25);
}

.tab-icon {
  font-size: 0.875rem;
  opacity: 0.8;
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 20px;
  padding: 0 6px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  font-size: 0.7rem;
  font-weight: 600;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.tab-indicator {
  position: absolute;
  bottom: -1px;
  left: 50%;
  transform: translateX(-50%);
  width: 30px;
  height: 3px;
  background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%);
  border-radius: 2px;
}
</style>
