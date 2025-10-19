<!--
  【DEVELOPMENT STANDARDS】
  - NO <style> tags allowed in this component
  - All styles must reference theme variables via class names
  - Theme file: common/styles/theme-base.css
  - Extended theme: apps/app_codemart/styles_app_codemart/theme-codemart.css
-->
<template>
  <header class="codemart-header">
    <div class="container codemart-header-container">
      <!-- Logo -->
      <NuxtLink to="/" class="codemart-logo">
        <svg class="codemart-logo-icon" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" opacity="0.3"/>
          <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2"/>
          <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2"/>
        </svg>
        <span class="codemart-logo-text">{{ t('codemart.platform_name') }}</span>
      </NuxtLink>

      <!-- Desktop Navigation -->
      <nav class="codemart-nav hide-mobile">
        <NuxtLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="codemart-nav-link"
          :class="{ 'active': isActive(item.path) }"
        >
          {{ t(item.label) }}
        </NuxtLink>
      </nav>

      <!-- Right Actions -->
      <div class="codemart-header-actions">
        <!-- Language Switcher -->
        <button class="codemart-lang-btn" @click="toggleLanguage">
          {{ currentLocale.toUpperCase() }}
        </button>

        <!-- User Menu (if logged in) -->
        <div v-if="isLoggedIn" class="codemart-user-menu">
          <button class="codemart-user-btn" @click="showUserDropdown = !showUserDropdown">
            <img
              v-if="currentUser?.avatar"
              :src="currentUser.avatar"
              :alt="currentUser.username"
              class="codemart-user-avatar"
            />
            <div v-else class="codemart-user-avatar-placeholder">
              {{ currentUser?.username?.charAt(0).toUpperCase() }}
            </div>
            <span class="hide-mobile">{{ currentUser?.username }}</span>
          </button>

          <!-- Dropdown -->
          <div v-if="showUserDropdown" class="codemart-user-dropdown">
            <NuxtLink to="/profile" class="codemart-dropdown-item">
              {{ t('common.profile') }}
            </NuxtLink>
            <NuxtLink to="/dashboard" class="codemart-dropdown-item">
              {{ t('common.dashboard') }}
            </NuxtLink>
            <NuxtLink to="/settings" class="codemart-dropdown-item">
              {{ t('common.settings') }}
            </NuxtLink>
            <button @click="handleLogout" class="codemart-dropdown-item">
              {{ t('common.logout') }}
            </button>
          </div>
        </div>

        <!-- Login/Register (if not logged in) -->
        <div v-else class="codemart-auth-buttons">
          <NuxtLink to="/login" class="codemart-btn codemart-btn-outline">
            {{ t('common.login') }}
          </NuxtLink>
          <NuxtLink to="/register" class="codemart-btn codemart-btn-primary">
            {{ t('common.register') }}
          </NuxtLink>
        </div>

        <!-- Mobile Menu Toggle -->
        <button class="codemart-mobile-menu-btn hide-desktop" @click="showMobileMenu = !showMobileMenu">
          <svg v-if="!showMobileMenu" width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M3 12H21M3 6H21M3 18H21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M6 18L18 6M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Mobile Navigation -->
    <div v-if="showMobileMenu" class="codemart-mobile-nav hide-desktop">
      <NuxtLink
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="codemart-mobile-nav-link"
        @click="showMobileMenu = false"
      >
        {{ t(item.label) }}
      </NuxtLink>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useCodemartUser } from '../composables_app_codemart';

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();
const { currentUser, isLoggedIn } = useCodemartUser();

const showMobileMenu = ref(false);
const showUserDropdown = ref(false);

const navItems = [
  { path: '/', label: 'codemart.nav.home' },
  { path: '/projects', label: 'codemart.nav.projects' },
  { path: '/developers', label: 'codemart.nav.developers' },
  { path: '/how-it-works', label: 'codemart.nav.how_it_works' },
  { path: '/about', label: 'codemart.nav.about' },
];

const currentLocale = computed(() => locale.value);

const isActive = (path: string): boolean => {
  if (path === '/') {
    return route.path === '/';
  }
  return route.path.startsWith(path);
};

const toggleLanguage = () => {
  locale.value = locale.value === 'zh' ? 'en' : 'zh';
};

const handleLogout = async () => {
  // Implement logout logic
  showUserDropdown.value = false;
  router.push('/');
};
</script>

<!-- NO <style> tag - All styles defined in theme files -->
