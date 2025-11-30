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

const showMobileSidebar = ref(false);
const showNotifications = ref(false);
const showUserMenu = ref(false);

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

<!-- NO <style> tag - All styles defined in theme files -->
