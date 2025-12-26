<template>
  <header class="glass border-b border-white/20 shadow-sm z-50 relative">
    <div class="px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center h-16">
        <div class="flex items-center">
          <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30">
            <i class="fas fa-rocket text-white text-lg"></i>
          </div>
          <div class="ml-4">
            <h1 class="text-xl font-bold text-gray-900">Developer Hub</h1>
            <p class="text-xs text-gray-500">Web Automation & Developer Tools</p>
          </div>
        </div>
        <div class="flex items-center space-x-4">
          <!-- API Connection Status -->
          <div
            class="flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm"
            :class="connection.connected ? 'bg-green-100/80 text-green-800' : 'bg-red-100/80 text-red-800'"
            :title="apiStatusTitle"
          >
            <div class="w-2 h-2 rounded-full" :class="connection.connected ? 'bg-green-500' : 'bg-red-500'"></div>
            <span>{{ connection.text }}</span>
          </div>

          <!-- User Auth Section -->
          <div v-if="!authStore.isAuthenticated" class="flex items-center space-x-2">
            <button
              @click="showLoginModal = true"
              class="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50/50 rounded-lg transition"
            >
              Login
            </button>
            <button
              @click="showRegisterModal = true"
              class="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-md shadow-blue-500/20"
            >
              Register
            </button>
          </div>

          <!-- User Info (Authenticated) -->
          <div v-else class="relative">
            <button
              @click="showUserMenu = !showUserMenu"
              class="flex items-center space-x-2 px-3 py-1.5 rounded-lg hover:bg-white/40 transition"
            >
              <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold shadow-md">
                {{ authStore.userDisplayName.charAt(0).toUpperCase() }}
              </div>
              <span class="text-sm font-medium text-gray-700">{{ authStore.userDisplayName }}</span>
              <i class="fas fa-chevron-down text-xs text-gray-500"></i>
            </button>

            <!-- User Dropdown Menu -->
            <div
              v-if="showUserMenu"
              v-click-outside="() => showUserMenu = false"
              class="absolute right-0 top-full mt-2 w-48 glass-strong border border-white/40 rounded-lg shadow-xl z-50 backdrop-blur-xl"
            >
              <div class="p-3 border-b border-gray-200/30">
                <p class="text-sm font-medium text-gray-900">{{ authStore.user?.username }}</p>
                <p class="text-xs text-gray-500">{{ authStore.user?.email }}</p>
              </div>
              <button
                @click="handleLogout"
                class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50/50 transition rounded-b-lg"
              >
                <i class="fas fa-sign-out-alt mr-2"></i>
                Logout
              </button>
            </div>
          </div>

          <button
            @click="$emit('toggle-sidebar')"
            class="p-2 text-gray-600 hover:text-gray-900 transition rounded-lg hover:bg-white/40"
          >
            <i class="fas fa-bars text-xl"></i>
          </button>
        </div>
      </div>
    </div>
    <div class="border-t border-white/20">
      <div class="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <slot name="logo"></slot>
        <nav class="hidden md:flex space-x-1">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="$emit('switch-tab', tab.id)"
            :class="[
              'px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer flex items-center',
              activeTab === tab.id
                ? 'bg-blue-100/50 text-blue-700 border border-blue-200/50 shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/40 border border-transparent'
            ]"
          >
            <i :class="tab.icon" class="mr-2"></i>
            {{ tab.name }}
            <span v-if="tab.badge" class="ml-2 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full shadow-sm">
              {{ tab.badge }}
            </span>
          </button>
        </nav>
        <button class="md:hidden p-2 text-gray-600 hover:text-gray-900">
          <i class="fas fa-bars text-xl"></i>
        </button>
      </div>
    </div>

    <!-- Login Modal -->
    <LoginModal
      v-model:show="showLoginModal"
      @switch-to-register="handleSwitchToRegister"
    />

    <!-- Register Modal -->
    <RegisterModal
      v-model:show="showRegisterModal"
      @switch-to-login="handleSwitchToLogin"
    />
  </header>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/app_ittools_pages/stores/auth-store';
import { useApiEndpoints } from '@/common/composables/useApiEndpoints';
import LoginModal from '@/app_ittools_pages/components/auth/LoginModal.vue';
import RegisterModal from '@/app_ittools_pages/components/auth/RegisterModal.vue';

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

const emit = defineEmits(['toggle-sidebar', 'switch-tab']);

const authStore = useAuthStore();
const { activeEndpoint, healthyEndpointsCount } = useApiEndpoints();

const showUserMenu = ref(false);
const showLoginModal = ref(false);
const showRegisterModal = ref(false);

const apiStatusTitle = computed(() => {
  if (!activeEndpoint.value) {
    return 'No API endpoint selected';
  }
  return `Active: ${activeEndpoint.value.description} (${healthyEndpointsCount.value} healthy)`;
});

async function handleLogout() {
  showUserMenu.value = false;
  await authStore.logout();
}

function handleSwitchToRegister() {
  showLoginModal.value = false;
  showRegisterModal.value = true;
}

function handleSwitchToLogin() {
  showRegisterModal.value = false;
  showLoginModal.value = true;
}

// Click outside directive (inline implementation)
const vClickOutside = {
  mounted(el: HTMLElement, binding: any) {
    el.clickOutsideEvent = (event: MouseEvent) => {
      if (!(el === event.target || el.contains(event.target as Node))) {
        binding.value();
      }
    };
    document.addEventListener('click', el.clickOutsideEvent);
  },
  unmounted(el: any) {
    document.removeEventListener('click', el.clickOutsideEvent);
  }
};

onMounted(() => {
  authStore.initialize();
});
</script>
