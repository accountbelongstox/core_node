<template>
  <div class="nginx-panel">
    <!-- Login Page -->
    <div v-if="!isAuthenticated" class="login-container">
      <div class="bento-card login-card">
        <div class="login-header">
          <div class="login-icon">
            <i class="fas fa-server"></i>
          </div>
          <h2>Nginx Management</h2>
          <p>Please login to access nginx management</p>
        </div>

        <form @submit.prevent="handleLogin" class="login-form">
          <div class="form-group">
            <label for="username">Username</label>
            <input
              id="username"
              v-model="loginForm.username"
              type="text"
              required
              class="input-glass"
              placeholder="Enter username"
            />
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input
              id="password"
              v-model="loginForm.password"
              type="password"
              required
              class="input-glass"
              placeholder="Enter password"
            />
          </div>

          <div v-if="loginError" class="error-alert">
            <i class="fas fa-exclamation-circle"></i>
            <span>{{ loginError }}</span>
          </div>

          <button type="submit" :disabled="isLoggingIn" class="btn-primary">
            <i v-if="isLoggingIn" class="fas fa-spinner fa-spin"></i>
            <span>{{ isLoggingIn ? 'Logging in...' : 'Login' }}</span>
          </button>
        </form>
      </div>
    </div>

    <!-- Management Panel -->
    <div v-else class="management-container">
      <div class="bento-card main-card">
        <div class="card-header">
          <div class="header-left">
            <i class="fas fa-server header-icon"></i>
            <div>
              <h2>Nginx Management</h2>
              <p>Manage nginx sites and configurations</p>
            </div>
          </div>
          <button @click="handleLogout" class="btn-glass logout-btn">
            <i class="fas fa-sign-out-alt"></i>
            Logout
          </button>
        </div>

        <!-- Actions Bar -->
        <div class="actions-bar">
          <button @click="loadSites" :disabled="isLoading" class="btn-action blue">
            <i :class="['fas fa-sync-alt', isLoading && 'fa-spin']"></i>
            Refresh
          </button>
          <button @click="testNginxConfig" :disabled="isLoading" class="btn-action green">
            <i class="fas fa-check-circle"></i>
            Test Config
          </button>
          <button @click="reloadNginx" :disabled="isLoading" class="btn-action purple">
            <i class="fas fa-redo"></i>
            Reload Nginx
          </button>
        </div>

        <!-- Status Messages -->
        <div v-if="statusMessage" class="status-alert" :class="statusMessageType">
          <i :class="['fas', statusMessageType === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle']"></i>
          <span>{{ statusMessage }}</span>
        </div>

        <!-- Sites List -->
        <div v-if="sites.length > 0" class="sites-list">
          <div v-for="site in sites" :key="site.name" class="site-card">
            <div class="site-info">
              <div class="site-header">
                <h3>{{ site.name }}</h3>
                <span class="status-badge" :class="site.enabled ? 'enabled' : 'disabled'">
                  {{ site.enabled ? 'Enabled' : 'Disabled' }}
                </span>
              </div>
              <p v-if="site.server_name" class="site-detail">
                <i class="fas fa-globe"></i> {{ site.server_name }}
              </p>
              <p v-if="site.root" class="site-detail">
                <i class="fas fa-folder"></i> {{ site.root }}
              </p>
            </div>
            <div class="site-actions">
              <button
                v-if="!site.enabled"
                @click="enableSite(site.name)"
                :disabled="isLoading"
                class="btn-sm green"
              >
                Enable
              </button>
              <button
                v-else
                @click="disableSite(site.name)"
                :disabled="isLoading"
                class="btn-sm gray"
              >
                Disable
              </button>
              <button @click="viewSiteConfig(site.name)" class="btn-sm blue">
                View Config
              </button>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else-if="!isLoading" class="empty-state">
          <i class="fas fa-server"></i>
          <p>No nginx sites found</p>
        </div>

        <!-- Loading State -->
        <div v-if="isLoading" class="loading-state">
          <i class="fas fa-spinner fa-spin"></i>
          <p>Loading...</p>
        </div>
      </div>

      <!-- Config Viewer Modal -->
      <div v-if="showConfigModal" class="modal-overlay" @click.self="showConfigModal = false">
        <div class="modal-card">
          <div class="modal-header">
            <h3>Nginx Configuration: {{ selectedSiteName }}</h3>
            <button @click="showConfigModal = false" class="modal-close">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="modal-body glass-scroll">
            <pre>{{ siteConfig }}</pre>
          </div>
          <div class="modal-footer">
            <button @click="showConfigModal = false" class="btn-glass">Close</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useNginxApi } from '@/apps/app_ittools/composables_app_ittools/useNginxApi';

const nginxApi = useNginxApi();

const isAuthenticated = ref(false);
const isLoggingIn = ref(false);
const loginError = ref('');
const loginForm = ref({ username: '', password: '' });

const isLoading = ref(false);
const sites = ref<any[]>([]);
const statusMessage = ref('');
const statusMessageType = ref<'success' | 'error'>('success');
const showConfigModal = ref(false);
const selectedSiteName = ref('');
const siteConfig = ref('');

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
    if (loginForm.value.username && loginForm.value.password) {
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

<style scoped>
.nginx-panel {
  min-height: 100%;
}

.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 2rem;
}

.bento-card {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 24px;
  box-shadow: 0 8px 32px rgba(99, 102, 241, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.login-card {
  max-width: 400px;
  width: 100%;
  padding: 2.5rem;
}

.login-header {
  text-align: center;
  margin-bottom: 2rem;
}

.login-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  border-radius: 16px;
  color: white;
  font-size: 1.75rem;
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.35);
}

.login-header h2 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.login-header p {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0.5rem 0 0;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.input-glass {
  padding: 0.75rem 1rem;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(229, 231, 235, 0.6);
  border-radius: 12px;
  font-size: 0.9375rem;
  transition: all 0.2s ease;
}

.input-glass:focus {
  outline: none;
  border-color: rgba(99, 102, 241, 0.5);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.error-alert {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 10px;
  color: #dc2626;
  font-size: 0.875rem;
}

.btn-primary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.875rem 1.5rem;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  border: none;
  border-radius: 12px;
  font-size: 0.9375rem;
  font-weight: 600;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.35);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.45);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.management-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.main-card {
  padding: 1.5rem;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.header-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  border-radius: 14px;
  color: white;
  font-size: 1.25rem;
}

.header-left h2 {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.header-left p {
  font-size: 0.8125rem;
  color: #6b7280;
  margin: 0.25rem 0 0;
}

.btn-glass {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(229, 231, 235, 0.6);
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-glass:hover {
  background: rgba(99, 102, 241, 0.08);
  border-color: rgba(99, 102, 241, 0.2);
  color: #4f46e5;
}

.logout-btn {
  color: #6b7280;
}

.actions-bar {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.btn-action {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border: none;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-action.blue { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); }
.btn-action.green { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); }
.btn-action.purple { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); }

.status-alert {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
  border-radius: 12px;
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
}

.status-alert.success {
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.2);
  color: #16a34a;
}

.status-alert.error {
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #dc2626;
}

.sites-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.site-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(229, 231, 235, 0.6);
  border-radius: 16px;
  transition: all 0.2s ease;
}

.site-card:hover {
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(99, 102, 241, 0.2);
}

.site-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.site-header h3 {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.status-badge {
  padding: 0.25rem 0.625rem;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.status-badge.enabled {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

.status-badge.disabled {
  background: rgba(107, 114, 128, 0.1);
  color: #6b7280;
}

.site-detail {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: #6b7280;
  margin: 0.25rem 0 0;
}

.site-detail i {
  width: 14px;
  opacity: 0.6;
}

.site-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  border: none;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 500;
  color: white;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-sm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-sm.blue { background: #3b82f6; }
.btn-sm.blue:hover { background: #2563eb; }
.btn-sm.green { background: #22c55e; }
.btn-sm.green:hover { background: #16a34a; }
.btn-sm.gray { background: #6b7280; }
.btn-sm.gray:hover { background: #4b5563; }

.empty-state, .loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: #9ca3af;
}

.empty-state i, .loading-state i {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
}

.modal-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
  max-width: 800px;
  width: 100%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid rgba(229, 231, 235, 0.5);
}

.modal-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.modal-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s ease;
}

.modal-close:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.modal-body pre {
  background: rgba(249, 250, 251, 0.8);
  border: 1px solid rgba(229, 231, 235, 0.6);
  border-radius: 12px;
  padding: 1rem;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.8125rem;
  color: #374151;
  margin: 0;
  white-space: pre-wrap;
  overflow-x: auto;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  padding: 1rem 1.5rem;
  border-top: 1px solid rgba(229, 231, 235, 0.5);
}
</style>
