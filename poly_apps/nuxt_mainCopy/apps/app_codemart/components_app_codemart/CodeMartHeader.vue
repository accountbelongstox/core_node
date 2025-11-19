<!--
  【DEVELOPMENT STANDARDS】
  - NO <style> tags allowed in this component
  - All styles must reference theme variables via class names
  - Theme file: common/styles/theme-base.css
  - Extended theme: apps/app_codemart/styles_app_codemart/theme-codemart.css
-->
<template>
  <header class="codemart-header" :class="{ 'codemart-header-scrolled': isScrolled }">
    <!-- Platform Announcement Banner -->
    <div v-if="showAnnouncement && platformAnnouncement" class="codemart-announcement-banner">
      <div class="container codemart-announcement-content">
        <span class="codemart-announcement-icon">📢</span>
        <span class="codemart-announcement-text">{{ platformAnnouncement }}</span>
        <button
          type="button"
          class="codemart-announcement-close"
          @click="dismissAnnouncement"
          :title="t('common.close')"
        >
          ×
        </button>
      </div>
    </div>

    <div class="container codemart-header-container">
      <!-- Logo with Badge -->
      <NuxtLink to="/" class="codemart-logo">
        <svg class="codemart-logo-icon" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" opacity="0.3"/>
          <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2"/>
          <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2"/>
        </svg>
        <span class="codemart-logo-text">{{ t('codemart.platform_name') }}</span>
        <span v-if="platformBadge" class="codemart-logo-badge">{{ platformBadge }}</span>
      </NuxtLink>

      <!-- Search Bar -->
      <div class="codemart-search-container hide-mobile">
        <div class="codemart-search-wrapper">
          <input
            v-model="searchQuery"
            type="text"
            class="codemart-search-input"
            :placeholder="t('codemart.search.placeholder')"
            @focus="showSearchSuggestions = true"
            @blur="hideSearchSuggestions"
            @keyup.enter="performSearch"
          />
          <button type="button" class="codemart-search-btn" @click="performSearch">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
              <path d="M21 21L16.65 16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>

          <!-- Search Suggestions Dropdown -->
          <div v-if="showSearchSuggestions && searchSuggestions.length > 0" class="codemart-search-suggestions">
            <div class="codemart-suggestion-section">
              <div class="codemart-suggestion-header">{{ t('codemart.search.suggestions') }}</div>
              <button
                v-for="suggestion in searchSuggestions"
                :key="suggestion.id"
                type="button"
                class="codemart-suggestion-item"
                @mousedown.prevent="selectSuggestion(suggestion)"
              >
                <span class="codemart-suggestion-icon">{{ suggestion.icon }}</span>
                <span class="codemart-suggestion-text">{{ suggestion.text }}</span>
                <span class="codemart-suggestion-type">{{ suggestion.type }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Desktop Navigation -->
      <nav class="codemart-nav hide-mobile">
        <NuxtLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="codemart-nav-link"
          :class="{ 'active': isActive(item.path) }"
        >
          <span v-if="item.icon" class="codemart-nav-icon">{{ item.icon }}</span>
          {{ t(item.label) }}
          <span v-if="item.badge" class="codemart-nav-badge">{{ item.badge }}</span>
        </NuxtLink>
      </nav>

      <!-- Right Actions -->
      <div class="codemart-header-actions">
        <!-- Saved Items Counter -->
        <NuxtLink v-if="isLoggedIn" to="/saved" class="codemart-icon-btn" :title="t('codemart.saved_items')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M19 21L12 16L5 21V5C5 3.89543 5.89543 3 7 3H17C18.1046 3 19 3.89543 19 5V21Z"
              stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          </svg>
          <span v-if="savedItemsCount > 0" class="codemart-icon-badge">{{ savedItemsCount }}</span>
        </NuxtLink>

        <!-- Notifications -->
        <div v-if="isLoggedIn" class="codemart-notifications">
          <button
            type="button"
            class="codemart-icon-btn"
            @click="showNotifications = !showNotifications"
            :title="t('codemart.notifications')"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span v-if="unreadNotificationsCount > 0" class="codemart-icon-badge codemart-badge-alert">
              {{ unreadNotificationsCount }}
            </span>
          </button>

          <!-- Notifications Dropdown -->
          <div v-if="showNotifications" class="codemart-notifications-dropdown">
            <div class="codemart-notifications-header">
              <span class="codemart-notifications-title">{{ t('codemart.notifications') }}</span>
              <button type="button" class="codemart-notifications-mark-all" @click="markAllAsRead">
                {{ t('codemart.mark_all_read') }}
              </button>
            </div>
            <div class="codemart-notifications-list">
              <div
                v-for="notification in recentNotifications"
                :key="notification.id"
                class="codemart-notification-item"
                :class="{ 'codemart-notification-unread': !notification.read }"
                @click="handleNotificationClick(notification)"
              >
                <span class="codemart-notification-icon">{{ notification.icon }}</span>
                <div class="codemart-notification-content">
                  <div class="codemart-notification-text">{{ notification.message }}</div>
                  <div class="codemart-notification-time">{{ formatRelativeTime(notification.createdAt) }}</div>
                </div>
              </div>
              <div v-if="recentNotifications.length === 0" class="codemart-notifications-empty">
                {{ t('codemart.no_notifications') }}
              </div>
            </div>
            <NuxtLink to="/notifications" class="codemart-notifications-view-all">
              {{ t('codemart.view_all_notifications') }}
            </NuxtLink>
          </div>
        </div>

        <!-- Theme Toggle -->
        <button
          type="button"
          class="codemart-icon-btn"
          @click="toggleTheme"
          :title="t('common.toggle_theme')"
        >
          <svg v-if="currentTheme === 'light'" width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2"/>
            <path d="M12 1V3M12 21V23M23 12H21M3 12H1M20.07 20.07L18.36 18.36M5.64 5.64L3.93 3.93M20.07 3.93L18.36 5.64M5.64 18.36L3.93 20.07"
              stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
              stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          </svg>
        </button>
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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useCodemartUser } from '../composables_app_codemart';

// ========================================
// Composables & Router
// ========================================
const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();
const { currentUser, isLoggedIn } = useCodemartUser();

// ========================================
// Local State
// ========================================
const showMobileMenu = ref(false);
const showUserDropdown = ref(false);
const showNotifications = ref(false);
const showSearchSuggestions = ref(false);
const showAnnouncement = ref(true);
const isScrolled = ref(false);
const currentTheme = ref<'light' | 'dark'>('light');
const searchQuery = ref('');

// Mock notifications data (replace with real API calls)
const notifications = ref([
  { id: 1, icon: '💼', message: 'New project matches your skills', createdAt: '2024-01-15T10:30:00', read: false },
  { id: 2, icon: '💬', message: 'Client responded to your proposal', createdAt: '2024-01-15T09:15:00', read: false },
  { id: 3, icon: '⭐', message: 'You received a 5-star review', createdAt: '2024-01-14T18:45:00', read: true },
]);

// ========================================
// Navigation Items
// ========================================
const navItems = computed(() => {
  const items = [
    { path: '/', label: 'codemart.nav.home', icon: '🏠', badge: null },
    { path: '/projects', label: 'codemart.nav.projects', icon: '📦', badge: newProjectsCount.value > 0 ? newProjectsCount.value : null },
    { path: '/developers', label: 'codemart.nav.developers', icon: '👨‍💻', badge: null },
    { path: '/how-it-works', label: 'codemart.nav.how_it_works', icon: '❓', badge: null },
  ];

  if (isLoggedIn.value) {
    items.push({ path: '/dashboard', label: 'codemart.nav.dashboard', icon: '📊', badge: null });
  }

  return items;
});

// ========================================
// Computed Properties
// ========================================
const currentLocale = computed(() => locale.value);

const platformBadge = computed(() => {
  // Could be 'BETA', 'v2.0', etc.
  return 'BETA';
});

const platformAnnouncement = computed(() => {
  return t('codemart.announcement.welcome');
});

const savedItemsCount = computed(() => {
  if (!isLoggedIn.value) return 0;
  const savedProjects = JSON.parse(localStorage.getItem('codemart_bookmarks') || '[]');
  const savedTasks = JSON.parse(localStorage.getItem('codemart_saved_tasks') || '[]');
  const savedDevs = JSON.parse(localStorage.getItem('codemart_bookmarked_developers') || '[]');
  return savedProjects.length + savedTasks.length + savedDevs.length;
});

const unreadNotificationsCount = computed(() => {
  return notifications.value.filter(n => !n.read).length;
});

const recentNotifications = computed(() => {
  return notifications.value.slice(0, 5); // Show only 5 most recent
});

const newProjectsCount = computed(() => {
  // Mock implementation - replace with real data
  return 3;
});

// Search suggestions based on query
const searchSuggestions = computed(() => {
  if (!searchQuery.value || searchQuery.value.length < 2) return [];

  // Mock suggestions - replace with real search API
  const mockSuggestions = [
    { id: 1, icon: '📦', text: 'React Native Mobile App', type: 'Project' },
    { id: 2, icon: '👨‍💻', text: 'Senior React Developer', type: 'Developer' },
    { id: 3, icon: '🏷️', text: 'React', type: 'Skill' },
    { id: 4, icon: '📦', text: 'E-commerce Website', type: 'Project' },
    { id: 5, icon: '👨‍💻', text: 'Full Stack JavaScript Developer', type: 'Developer' },
  ];

  return mockSuggestions.filter(s =>
    s.text.toLowerCase().includes(searchQuery.value.toLowerCase())
  ).slice(0, 5);
});

// ========================================
// Navigation & Active State
// ========================================
const isActive = (path: string): boolean => {
  if (path === '/') {
    return route.path === '/';
  }
  return route.path.startsWith(path);
};

// ========================================
// Utility Functions
// ========================================
const formatRelativeTime = (date: string): string => {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return t('common.just_now');
  if (diffMinutes < 60) return `${diffMinutes}${t('common.minute_short')} ${t('common.ago')}`;
  if (diffHours < 24) return `${diffHours}${t('common.hour_short')} ${t('common.ago')}`;
  if (diffDays < 7) return `${diffDays}${t('common.day_short')} ${t('common.ago')}`;

  return new Date(date).toLocaleDateString();
};

// ========================================
// Interaction Methods
// ========================================
const toggleLanguage = () => {
  locale.value = locale.value === 'zh' ? 'en' : 'zh';
  localStorage.setItem('codemart_locale', locale.value);
};

const toggleTheme = () => {
  currentTheme.value = currentTheme.value === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', currentTheme.value);
  localStorage.setItem('codemart_theme', currentTheme.value);
};

const dismissAnnouncement = () => {
  showAnnouncement.value = false;
  sessionStorage.setItem('codemart_announcement_dismissed', 'true');
};

const performSearch = () => {
  if (!searchQuery.value.trim()) return;
  router.push(`/search?q=${encodeURIComponent(searchQuery.value)}`);
  showSearchSuggestions.value = false;
};

const selectSuggestion = (suggestion: any) => {
  searchQuery.value = suggestion.text;
  performSearch();
};

const hideSearchSuggestions = () => {
  // Delay to allow click events on suggestions to fire first
  setTimeout(() => {
    showSearchSuggestions.value = false;
  }, 200);
};

const handleNotificationClick = (notification: any) => {
  // Mark as read
  notification.read = true;

  // Navigate based on notification type
  // Implementation depends on notification structure
  showNotifications.value = false;
};

const markAllAsRead = () => {
  notifications.value.forEach(n => n.read = true);
};

const handleLogout = async () => {
  // Implement logout logic
  showUserDropdown.value = false;

  // Clear auth tokens/session
  localStorage.removeItem('codemart_auth_token');

  // Redirect to home
  router.push('/');
};

// ========================================
// Scroll Event Handling
// ========================================
const handleScroll = () => {
  isScrolled.value = window.scrollY > 50;
};

// ========================================
// Click Outside Handling
// ========================================
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement;

  // Close user dropdown if clicked outside
  if (showUserDropdown.value && !target.closest('.codemart-user-menu')) {
    showUserDropdown.value = false;
  }

  // Close notifications if clicked outside
  if (showNotifications.value && !target.closest('.codemart-notifications')) {
    showNotifications.value = false;
  }
};

// ========================================
// Lifecycle Hooks
// ========================================
onMounted(() => {
  // Load theme preference
  const savedTheme = localStorage.getItem('codemart_theme') as 'light' | 'dark' | null;
  if (savedTheme) {
    currentTheme.value = savedTheme;
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  // Load locale preference
  const savedLocale = localStorage.getItem('codemart_locale');
  if (savedLocale) {
    locale.value = savedLocale;
  }

  // Check if announcement was dismissed
  if (sessionStorage.getItem('codemart_announcement_dismissed')) {
    showAnnouncement.value = false;
  }

  // Add scroll event listener
  window.addEventListener('scroll', handleScroll);

  // Add click outside event listener
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  // Clean up event listeners
  window.removeEventListener('scroll', handleScroll);
  document.removeEventListener('click', handleClickOutside);
});

// Watch for route changes to close mobile menu
watch(() => route.path, () => {
  showMobileMenu.value = false;
  showUserDropdown.value = false;
  showNotifications.value = false;
});
</script>

<!-- NO <style> tag - All styles defined in theme files -->
