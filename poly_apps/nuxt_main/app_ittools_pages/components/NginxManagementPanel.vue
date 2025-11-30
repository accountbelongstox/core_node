<template>
  <div class="space-y-6">
    <!-- Login Page -->
    <div v-if="!isAuthenticated" class="max-w-md mx-auto mt-12">
      <div class="bg-white rounded-lg shadow-lg p-8">
        <div class="text-center mb-6">
          <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-server text-white text-2xl"></i>
          </div>
          <h2 class="text-2xl font-bold text-gray-900">Nginx Management</h2>
          <p class="text-sm text-gray-500 mt-2">Please login to access nginx management</p>
        </div>

        <form @submit.prevent="handleLogin" class="space-y-4">
          <div>
            <label for="username" class="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              id="username"
              v-model="loginForm.username"
              type="text"
              required
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter username"
            />
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              v-model="loginForm.password"
              type="password"
              required
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter password"
            />
          </div>

          <div v-if="loginError" class="bg-red-50 border border-red-200 rounded-lg p-3">
            <p class="text-sm text-red-600">{{ loginError }}</p>
          </div>

          <button
            type="submit"
            :disabled="isLoggingIn"
            class="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <span v-if="!isLoggingIn">Login</span>
            <span v-else class="flex items-center justify-center">
              <i class="fas fa-spinner fa-spin mr-2"></i>
              Logging in...
            </span>
          </button>
        </form>
      </div>
    </div>

    <!-- Management Panel -->
    <div v-else class="space-y-6">
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-2xl font-bold text-gray-900">Nginx Management</h2>
            <p class="text-sm text-gray-500 mt-1">Manage nginx sites and configurations</p>
          </div>
          <button
            @click="handleLogout"
            class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
          >
            <i class="fas fa-sign-out-alt mr-2"></i>
            Logout
          </button>
        </div>

        <!-- Actions Bar -->
        <div class="flex items-center justify-between mb-6">
          <div class="flex space-x-3">
            <button
              @click="loadSites"
              :disabled="isLoading"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <i class="fas fa-sync-alt mr-2" :class="{ 'fa-spin': isLoading }"></i>
              Refresh
            </button>
            <button
              @click="testNginxConfig"
              :disabled="isLoading"
              class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <i class="fas fa-check-circle mr-2"></i>
              Test Config
            </button>
            <button
              @click="reloadNginx"
              :disabled="isLoading"
              class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <i class="fas fa-redo mr-2"></i>
              Reload Nginx
            </button>
          </div>
        </div>

        <!-- Status Messages -->
        <div v-if="statusMessage" class="mb-4 p-4 rounded-lg" :class="statusMessageType === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'">
          <p class="text-sm" :class="statusMessageType === 'success' ? 'text-green-600' : 'text-red-600'">
            {{ statusMessage }}
          </p>
        </div>

        <!-- Sites List -->
        <div v-if="sites.length > 0" class="space-y-3">
          <div
            v-for="site in sites"
            :key="site.name"
            class="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
          >
            <div class="flex items-center justify-between">
              <div class="flex-1">
                <div class="flex items-center space-x-3">
                  <h3 class="text-lg font-semibold text-gray-900">{{ site.name }}</h3>
                  <span
                    v-if="site.enabled"
                    class="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full"
                  >
                    Enabled
                  </span>
                  <span
                    v-else
                    class="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full"
                  >
                    Disabled
                  </span>
                </div>
                <p v-if="site.server_name" class="text-sm text-gray-500 mt-1">
                  Server: {{ site.server_name }}
                </p>
                <p v-if="site.root" class="text-sm text-gray-500">
                  Root: {{ site.root }}
                </p>
              </div>
              <div class="flex space-x-2">
                <button
                  v-if="!site.enabled"
                  @click="enableSite(site.name)"
                  :disabled="isLoading"
                  class="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Enable
                </button>
                <button
                  v-else
                  @click="disableSite(site.name)"
                  :disabled="isLoading"
                  class="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Disable
                </button>
                <button
                  @click="viewSiteConfig(site.name)"
                  class="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                >
                  View Config
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else-if="!isLoading" class="text-center py-12">
          <i class="fas fa-server text-4xl text-gray-300 mb-4"></i>
          <p class="text-gray-500">No nginx sites found</p>
        </div>

        <!-- Loading State -->
        <div v-if="isLoading" class="text-center py-12">
          <i class="fas fa-spinner fa-spin text-3xl text-blue-500 mb-4"></i>
          <p class="text-gray-500">Loading...</p>
        </div>
      </div>

      <!-- Config Viewer Modal -->
      <div
        v-if="showConfigModal"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        @click.self="showConfigModal = false"
      >
        <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
          <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900">Nginx Configuration: {{ selectedSiteName }}</h3>
            <button
              @click="showConfigModal = false"
              class="text-gray-400 hover:text-gray-600 transition"
            >
              <i class="fas fa-times text-xl"></i>
            </button>
          </div>
          <div class="flex-1 overflow-y-auto p-6">
            <pre class="bg-gray-50 rounded-lg p-4 text-sm text-gray-800 overflow-x-auto">{{ siteConfig }}</pre>
          </div>
          <div class="px-6 py-4 border-t border-gray-200 flex justify-end">
            <button
              @click="showConfigModal = false"
              class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useNginxApi } from '@/app_ittools_pages/composables/useNginxApi';

const nginxApi = useNginxApi();

const isAuthenticated = ref(false);
const isLoggingIn = ref(false);
const loginError = ref('');
const loginForm = ref({
  username: '',
  password: ''
});

const isLoading = ref(false);
const sites = ref<any[]>([]);
const statusMessage = ref('');
const statusMessageType = ref<'success' | 'error'>('success');
const showConfigModal = ref(false);
const selectedSiteName = ref('');
const siteConfig = ref('');

// Check if already authenticated
onMounted(() => {
  const authToken = localStorage.getItem('nginx_auth_token');
  if (authToken) {
    isAuthenticated.value = true;
    loadSites();
  }
});

const handleLogin = async () => {
  isLoggingIn.value = true;
  loginError.value = '';

  try {
    // Simple authentication check (in production, this should call an API)
    // For now, we'll use a simple check - in production, this should be replaced with actual API call
    if (loginForm.value.username && loginForm.value.password) {
      // Store auth token
      localStorage.setItem('nginx_auth_token', 'authenticated');
      isAuthenticated.value = true;
      await loadSites();
    } else {
      loginError.value = 'Please enter both username and password';
    }
  } catch (error: any) {
    loginError.value = error.message || 'Login failed';
  } finally {
    isLoggingIn.value = false;
  }
};

const handleLogout = () => {
  localStorage.removeItem('nginx_auth_token');
  isAuthenticated.value = false;
  sites.value = [];
  statusMessage.value = '';
};

const loadSites = async () => {
  isLoading.value = true;
  statusMessage.value = '';

  try {
    const response = await nginxApi.listSites();
    if (response.success && response.data) {
      sites.value = response.data.sites || response.data || [];
      statusMessage.value = 'Sites loaded successfully';
      statusMessageType.value = 'success';
    } else {
      throw new Error(response.error || 'Failed to load sites');
    }
  } catch (error: any) {
    statusMessage.value = error.message || 'Failed to load sites';
    statusMessageType.value = 'error';
  } finally {
    isLoading.value = false;
  }
};

const enableSite = async (siteName: string) => {
  isLoading.value = true;
  statusMessage.value = '';

  try {
    const response = await nginxApi.enableSite(siteName);
    if (response.success) {
      statusMessage.value = `Site ${siteName} enabled successfully`;
      statusMessageType.value = 'success';
      await loadSites();
    } else {
      throw new Error(response.error || 'Failed to enable site');
    }
  } catch (error: any) {
    statusMessage.value = error.message || 'Failed to enable site';
    statusMessageType.value = 'error';
  } finally {
    isLoading.value = false;
  }
};

const disableSite = async (siteName: string) => {
  isLoading.value = true;
  statusMessage.value = '';

  try {
    const response = await nginxApi.disableSite(siteName);
    if (response.success) {
      statusMessage.value = `Site ${siteName} disabled successfully`;
      statusMessageType.value = 'success';
      await loadSites();
    } else {
      throw new Error(response.error || 'Failed to disable site');
    }
  } catch (error: any) {
    statusMessage.value = error.message || 'Failed to disable site';
    statusMessageType.value = 'error';
  } finally {
    isLoading.value = false;
  }
};

const viewSiteConfig = async (siteName: string) => {
  isLoading.value = true;
  selectedSiteName.value = siteName;

  try {
    const response = await nginxApi.getSiteConfig(siteName);
    if (response.success && response.data) {
      siteConfig.value = response.data.content || response.data.config || JSON.stringify(response.data, null, 2);
      showConfigModal.value = true;
    } else {
      throw new Error(response.error || 'Failed to load site config');
    }
  } catch (error: any) {
    statusMessage.value = error.message || 'Failed to load site config';
    statusMessageType.value = 'error';
  } finally {
    isLoading.value = false;
  }
};

const testNginxConfig = async () => {
  isLoading.value = true;
  statusMessage.value = '';

  try {
    const response = await nginxApi.testConfig();
    if (response.success) {
      statusMessage.value = 'Nginx configuration test passed';
      statusMessageType.value = 'success';
    } else {
      throw new Error(response.error || 'Configuration test failed');
    }
  } catch (error: any) {
    statusMessage.value = error.message || 'Configuration test failed';
    statusMessageType.value = 'error';
  } finally {
    isLoading.value = false;
  }
};

const reloadNginx = async () => {
  isLoading.value = true;
  statusMessage.value = '';

  try {
    const response = await nginxApi.reloadNginx();
    if (response.success) {
      statusMessage.value = 'Nginx reloaded successfully';
      statusMessageType.value = 'success';
      await loadSites();
    } else {
      throw new Error(response.error || 'Failed to reload nginx');
    }
  } catch (error: any) {
    statusMessage.value = error.message || 'Failed to reload nginx';
    statusMessageType.value = 'error';
  } finally {
    isLoading.value = false;
  }
};
</script>

