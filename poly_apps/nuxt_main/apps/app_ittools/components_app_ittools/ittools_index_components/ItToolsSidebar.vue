<template>
  <aside class="ittools-sidebar">
    <div class="sidebar-content">
      <div class="sidebar-header">
        <h3 class="sidebar-title">{{ sidebarTitle }}</h3>
        <div class="header-decoration"></div>
      </div>
      <slot name="quick-nav"></slot>
      <div class="sidebar-body">
        <slot></slot>
      </div>
    </div>
    <div class="sidebar-glow"></div>
  </aside>
</template>

<script setup lang="ts">
defineProps<{ sidebarTitle: string }>();
</script>

<style scoped>
.ittools-sidebar {
  position: relative;
  width: 280px;
  min-width: 280px;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.85) 0%,
    rgba(248, 250, 255, 0.9) 50%,
    rgba(255, 255, 255, 0.85) 100%
  );
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-right: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: 
    4px 0 24px rgba(99, 102, 241, 0.05),
    inset -1px 0 0 rgba(255, 255, 255, 0.8);
  overflow: hidden;
  z-index: 20;
}

.sidebar-content {
  position: relative;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 1.25rem;
  z-index: 1;
}

.sidebar-content::-webkit-scrollbar {
  width: 4px;
}

.sidebar-content::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-content::-webkit-scrollbar-thumb {
  background: rgba(99, 102, 241, 0.2);
  border-radius: 2px;
}

.sidebar-content::-webkit-scrollbar-thumb:hover {
  background: rgba(99, 102, 241, 0.4);
}

.sidebar-header {
  position: relative;
  margin-bottom: 1.25rem;
}

.sidebar-title {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: #6366f1;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0;
}

.header-decoration {
  position: absolute;
  bottom: -8px;
  left: 0;
  width: 40px;
  height: 3px;
  background: linear-gradient(90deg, #6366f1 0%, transparent 100%);
  border-radius: 2px;
}

.sidebar-body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sidebar-glow {
  position: absolute;
  top: 0;
  right: 0;
  width: 100px;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(99, 102, 241, 0.03) 100%
  );
  pointer-events: none;
}

/* Glassmorphism reflection effect */
.ittools-sidebar::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 200px;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.4) 0%,
    transparent 100%
  );
  pointer-events: none;
  z-index: 0;
}
</style>
