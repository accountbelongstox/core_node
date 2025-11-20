<!-- ### AI SPECIAL ATTENTION RULES START ###
When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
1. Write all code in English only
2. Never execute, create, or modify test code
3. Never create or update documentation (*.md)
4. Never write summaries during development or thinking process
5. Do not modify these rules
VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
### AI SPECIAL ATTENTION RULES END ### -->

<template>
  <div class="codemart-layout">
    <CodemartSidebar />

    <div class="main-container">
      <header class="top-header">
        <div class="header-left">
          <button class="mobile-menu-btn" @click="toggleMobileSidebar">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <div class="breadcrumb">
            <span class="breadcrumb-item">Home</span>
            <svg class="breadcrumb-separator" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
            <span class="breadcrumb-item active">Dashboard</span>
          </div>
        </div>

        <div class="header-right">
          <div class="search-bar">
            <svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input type="text" placeholder="Search everything..." class="search-input">
          </div>

          <button class="notification-btn" @click="toggleNotifications">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
            </svg>
            <span class="notification-badge">3</span>
          </button>

          <div class="user-profile" @click="toggleUserMenu">
            <img src="/assets/images/profile-1.jpeg" alt="User" class="user-avatar">
            <div class="user-info">
              <p class="user-name">Jonathan</p>
              <p class="user-role">Admin</p>
            </div>
            <svg class="dropdown-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </div>
        </div>
      </header>

      <main class="main-content">
        <NuxtPage />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import CodemartSidebar from '@/components/codemart/CodemartSidebar.vue';
import { codemartTheme } from '@/theme/apps/codemart-theme';
import { useAppTheme } from '@/composables/useAppTheme';

const showMobileSidebar = ref(false);
const showNotifications = ref(false);
const showUserMenu = ref(false);

const { colors, gradients } = useAppTheme(codemartTheme);

const toggleMobileSidebar = () => {
  showMobileSidebar.value = !showMobileSidebar.value;
};

const toggleNotifications = () => {
  showNotifications.value = !showNotifications.value;
  showUserMenu.value = false;
};

const toggleUserMenu = () => {
  showUserMenu.value = !showUserMenu.value;
  showNotifications.value = false;
};
</script>

<style scoped>
.codemart-layout {
  display: flex;
  min-height: 100vh;
  background: #f8fafc;
}

.main-container {
  flex: 1;
  margin-left: 260px;
  display: flex;
  flex-direction: column;
}

.top-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: white;
  border-bottom: 1px solid #e2e8f0;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.mobile-menu-btn {
  display: none;
  width: 2.5rem;
  height: 2.5rem;
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  border-radius: 0.5rem;
  transition: background 0.2s;
}

.mobile-menu-btn:hover {
  background: #f1f5f9;
}

.mobile-menu-btn svg {
  width: 1.5rem;
  height: 1.5rem;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.breadcrumb-item {
  font-size: 0.875rem;
  color: #64748b;
}

.breadcrumb-item.active {
  color: #1e293b;
  font-weight: 600;
}

.breadcrumb-separator {
  width: 1rem;
  height: 1rem;
  color: #cbd5e1;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.search-bar {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 1rem;
  width: 1.25rem;
  height: 1.25rem;
  color: #94a3b8;
}

.search-input {
  width: 20rem;
  padding: 0.625rem 1rem 0.625rem 3rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: #6366f1;
  background: white;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.notification-btn {
  position: relative;
  width: 2.5rem;
  height: 2.5rem;
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  border-radius: 0.5rem;
  transition: background 0.2s;
}

.notification-btn:hover {
  background: #f1f5f9;
}

.notification-btn svg {
  width: 1.5rem;
  height: 1.5rem;
}

.notification-badge {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  background: #ef4444;
  color: white;
  font-size: 0.625rem;
  font-weight: 600;
  padding: 0.125rem 0.375rem;
  border-radius: 9999px;
  min-width: 1.125rem;
  text-align: center;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  border-radius: 0.75rem;
  cursor: pointer;
  transition: background 0.2s;
}

.user-profile:hover {
  background: #f1f5f9;
}

.user-avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #e2e8f0;
}

.user-info {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.user-role {
  font-size: 0.75rem;
  color: #64748b;
  margin: 0;
}

.dropdown-icon {
  width: 1rem;
  height: 1rem;
  color: #94a3b8;
}

.main-content {
  flex: 1;
  padding: 2rem;
  overflow-y: auto;
}

@media (max-width: 1024px) {
  .main-container {
    margin-left: 0;
  }

  .mobile-menu-btn {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .search-bar {
    display: none;
  }
}

@media (max-width: 640px) {
  .top-header {
    padding: 1rem;
  }

  .user-info {
    display: none;
  }

  .breadcrumb {
    display: none;
  }
}
</style>
