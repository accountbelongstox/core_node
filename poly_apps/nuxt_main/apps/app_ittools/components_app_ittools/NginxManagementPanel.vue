<template>
  <div class="it-tools-panel">
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
            <label class="label-glass" for="username">Username</label>
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
            <label class="label-glass" for="password">Password</label>
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

          <button type="submit" :disabled="isLoggingIn" class="btn-glass btn-primary full-width">
            <i v-if="isLoggingIn" class="fas fa-spinner fa-spin"></i>
            <span>{{ isLoggingIn ? 'Logging in...' : 'Login' }}</span>
          </button>
        </form>
      </div>
    </div>

    <!-- Management Panel -->
    <div v-else class="management-container">
      <div class="bento-card">
        <div class="panel-header">
          <div class="panel-title">
            <i class="fas fa-server"></i>
            <div class="title-text">
              <span>Nginx Management</span>
              <small>Manage nginx sites and configurations</small>
            </div>
          </div>
          <button @click="handleLogout" class="btn-glass">
            <i class="fas fa-sign-out-alt"></i>
            <span>Logout</span>
          </button>
        </div>

        <div class="panel-body">
          <!-- Actions Bar -->
          <div class="actions-bar">
            <button @click="loadSites" :disabled="isLoading" class="btn-glass btn-primary">
              <i :class="['fas fa-sync-alt', isLoading && 'fa-spin']"></i>
              <span>Refresh</span>
            </button>
            <button @click="testNginxConfig" :disabled="isLoading" class="btn-glass btn-success">
              <i class="fas fa-check-circle"></i>
              <span>Test Config</span>
            </button>
            <button @click="reloadNginx" :disabled="isLoading" class="btn-glass" style="background: var(--gradient-primary); color: white;">
              <i class="fas fa-redo"></i>
              <span>Reload Nginx</span>
            </button>
          </div>

          <!-- Status Messages -->
          <div v-if="statusMessage" class="status-alert" :class="statusMessageType">
            <i :class="['fas', statusMessageType === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle']"></i>
            <span>{{ statusMessage }}</span>
          </div>

          <!-- Sites List -->
          <div v-if="sites.length > 0" class="sites-list">
            <div v-for="site in sites" :key="site.name" class="site-card bento-card-sm">
              <div class="site-info">
                <div class="site-header">
                  <h3>{{ site.name }}</h3>
                  <span class="tag-glass" :class="site.enabled ? 'tag-success' : ''">
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
                  class="btn-glass btn-success btn-sm"
                >
                  Enable
                </button>
                <button
                  v-else
                  @click="disableSite(site.name)"
                  :disabled="isLoading"
                  class="btn-glass btn-sm"
                >
                  Disable
                </button>
                <button @click="viewSiteConfig(site.name)" class="btn-glass btn-sm">
                  <i class="fas fa-eye"></i>
                  View Config
                </button>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else-if="!isLoading" class="empty-state">
            <i class="fas fa-server empty-state-icon"></i>
            <h3 class="empty-state-title">No nginx sites found</h3>
            <p class="empty-state-desc">Click refresh to load sites</p>
          </div>

          <!-- Loading State -->
          <div v-if="isLoading" class="loading-state">
            <div class="loading-spinner"></div>
            <p>Loading...</p>
          </div>
        </div>
      </div>

      <!-- Config Viewer Modal -->
      <div v-if="showConfigModal" class="modal-overlay" @click.self="showConfigModal = false">
        <div class="modal-content">
          <div class="modal-header">
            <div class="modal-title">
              <i class="fas fa-file-code"></i>
              <span>Nginx Configuration: {{ selectedSiteName }}</span>
            </div>
            <button @click="showConfigModal = false" class="modal-close">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="modal-body glass-scroll">
            <div class="code-block">
              <pre>{{ siteConfig }}</pre>
            </div>
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
.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 2rem;
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
  background: var(--gradient-primary);
  border-radius: var(--radius-lg);
  color: white;
  font-size: 1.75rem;
  box-shadow: var(--shadow-lg);
}

.login-header h2 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}

.login-header p {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin: 0.5rem 0 0;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.error-alert {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: var(--radius-md);
  color: var(--color-error);
  font-size: 0.875rem;
}

.full-width {
  width: 100%;
}

.management-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-bento);
}

.title-text {
  display: flex;
  flex-direction: column;
}

.title-text span {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text);
}

.title-text small {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  font-weight: 400;
}

.actions-bar {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.status-alert {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
}

.status-alert.success {
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.2);
  color: var(--color-success);
}

.status-alert.error {
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: var(--color-error);
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
  transition: all var(--transition-fast);
}

.site-card:hover {
  border-color: rgba(99, 102, 241, 0.25);
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
  color: var(--color-text);
  margin: 0;
}

.site-detail {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
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
  font-size: 0.75rem;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: var(--color-text-light);
}

.loading-state p {
  margin-top: 1rem;
}
</style>
