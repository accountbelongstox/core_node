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
  <header class="shared-main-header">
    <div class="flex items-center justify-between p-4">
      <!-- Logo and Site Info -->
      <div class="flex items-center space-x-4">
        <div class="logo">
          <h1 class="text-xl font-bold">{{ currentSite.name }}</h1>
        </div>
        <div class="site-indicator">
          <span class="px-2 py-1 text-xs rounded-full" :class="siteIndicatorClass">
            {{ currentSite.namespace }}
          </span>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="hidden md:flex items-center space-x-6">
        <NuxtLink 
          v-for="item in navigationItems" 
          :key="item.path"
          :to="item.path"
          class="nav-link"
          :class="{ 'active': isActiveRoute(item.path) }"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>

      <!-- User Actions -->
      <div class="flex items-center space-x-4">
        <button class="notification-btn" @click="toggleNotifications">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-5 5v-5z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3"/>
          </svg>
        </button>
        
        <div class="user-menu relative">
          <button @click="toggleUserMenu" class="flex items-center space-x-2">
            <div class="w-8 h-8 bg-gray-300 rounded-full"></div>
            <span class="hidden md:block">{{ user.name }}</span>
          </button>
          
          <div v-if="showUserMenu" class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-50">
            <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Profile</a>
            <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Settings</a>
            <hr class="my-1">
            <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" @click="logout">Logout</a>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';

// Props
interface Props {
  siteConfig?: any;
  navigationItems?: Array<{
    path: string;
    label: string;
  }>;
}

const props = withDefaults(defineProps<Props>(), {
  navigationItems: () => []
});

// Reactive data
const route = useRoute();
const showUserMenu = ref(false);
const showNotifications = ref(false);

const user = ref({
  name: 'John Doe',
  email: 'john@example.com'
});

// Computed
const currentSite = computed(() => {
  return props.siteConfig || {
    name: 'Core Node',
    namespace: 'mainsite'
  };
});

const siteIndicatorClass = computed(() => {
  const namespace = currentSite.value.namespace;
  const classMap: Record<string, string> = {
    mainsite: 'bg-blue-100 text-blue-800',
    admin: 'bg-red-100 text-red-800',
    dashboard: 'bg-green-100 text-green-800',
    analytics: 'bg-purple-100 text-purple-800'
  };
  return classMap[namespace] || 'bg-gray-100 text-gray-800';
});

// Methods
const isActiveRoute = (path: string) => {
  return route.path === path;
};

const toggleUserMenu = () => {
  showUserMenu.value = !showUserMenu.value;
};

const toggleNotifications = () => {
  showNotifications.value = !showNotifications.value;
};

const logout = () => {
  // Implement logout logic
  console.log('Logout clicked');
};

// Lifecycle
onMounted(() => {
  // Close menus when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target?.closest('.user-menu')) {
      showUserMenu.value = false;
    }
  });
});
</script>

<style scoped>
.shared-main-header {
  background: white;
  border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
}

.nav-link {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  transition: all 0.2s;
  color: #6b7280;
}

.nav-link:hover,
.nav-link.active {
  background-color: #f3f4f6;
  color: #1f2937;
}

.notification-btn {
  padding: 0.5rem;
  border-radius: 0.375rem;
  color: #6b7280;
  transition: all 0.2s;
}

.notification-btn:hover {
  background-color: #f3f4f6;
  color: #1f2937;
}
</style>
