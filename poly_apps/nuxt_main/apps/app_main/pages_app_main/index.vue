<template>
  <div class="app-main-showcase">
    <div class="showcase-header">
      <h1>Nuxt Multi-App Showcase</h1>
      <p>All applications in one place for debugging and development</p>
    </div>

    <div class="apps-grid">
      <div v-for="app in apps" :key="app.namespace" class="app-card">
        <div class="app-card-header" :style="{ background: app.gradient }">
          <h2>{{ app.name }}</h2>
          <p>{{ app.description }}</p>
        </div>
        <div class="app-card-body">
          <div class="app-info">
            <div class="info-item">
              <span class="label">Namespace:</span>
              <code>{{ app.namespace }}</code>
            </div>
            <div class="info-item">
              <span class="label">Route:</span>
              <code>{{ app.route }}</code>
            </div>
            <div class="info-item">
              <span class="label">Pages:</span>
              <span>{{ app.pageCount }} pages</span>
            </div>
          </div>
          <div class="app-actions">
            <NuxtLink :to="app.route" class="btn-primary">
              Open App
            </NuxtLink>
            <button class="btn-secondary" @click="showAppDetails(app)">
              View Details
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="architecture-info">
      <h2>Architecture Overview</h2>
      <div class="info-grid">
        <div class="info-card">
          <h3>Apps Structure</h3>
          <pre><code>apps/
├── app_main/          # This app (aggregator)
├── app_codemart/      # Business app
├── app_admin/         # Admin panel
├── app_example/       # Demo pages
├── app_dev/           # Dev tools
└── app_dashboard/     # Analytics</code></pre>
        </div>
        <div class="info-card">
          <h3>Common Resources</h3>
          <pre><code>common/
├── theme/             # Base themes
├── components/        # Shared components
├── stores/            # Base stores
├── constants/         # Constants
└── plugins/           # Plugins</code></pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { mainAppConfig } from '@/app_main/config_app_main/app-config';

definePageMeta({
  layout: 'default',
  title: 'Multi-App Showcase',
});

const apps = ref([
  {
    name: 'CodeMart',
    namespace: 'codemart',
    route: '/codemart',
    description: 'Business marketplace application with projects, templates, and payments',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    pageCount: 5,
  },
  {
    name: 'Admin',
    namespace: 'admin',
    route: '/admin',
    description: 'Administration panel for managing users, roles, and system settings',
    gradient: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
    pageCount: 3,
  },
  {
    name: 'Example',
    namespace: 'example',
    route: '/example',
    description: 'Demo pages showcasing UI components, forms, and data tables',
    gradient: 'linear-gradient(135deg, #4361ee 0%, #3182ce 100%)',
    pageCount: 50,
  },
  {
    name: 'Dev Tools',
    namespace: 'dev',
    route: '/dev',
    description: 'Developer tools and utilities for debugging',
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    pageCount: 2,
  },
  {
    name: 'Dashboard',
    namespace: 'dashboard',
    route: '/dashboard',
    description: 'Analytics dashboard with charts and widgets',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    pageCount: 4,
  },
]);

const showAppDetails = (app: any) => {
  console.log('App details:', app);
};
</script>

<style scoped>
.app-main-showcase {
  min-height: 100vh;
  padding: 2rem;
  background: #f8fafc;
}

.showcase-header {
  text-align: center;
  margin-bottom: 3rem;
}

.showcase-header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 0.5rem;
}

.showcase-header p {
  font-size: 1.125rem;
  color: #64748b;
}

.apps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 2rem;
  margin-bottom: 3rem;
}

.app-card {
  background: white;
  border-radius: 1rem;
  overflow: hidden;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s, box-shadow 0.2s;
}

.app-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
}

.app-card-header {
  padding: 2rem;
  color: white;
}

.app-card-header h2 {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.app-card-header p {
  font-size: 0.875rem;
  opacity: 0.9;
}

.app-card-body {
  padding: 1.5rem;
}

.app-info {
  margin-bottom: 1.5rem;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
}

.info-item .label {
  font-weight: 600;
  color: #475569;
}

.info-item code {
  background: #f1f5f9;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-family: monospace;
  font-size: 0.8125rem;
  color: #334155;
}

.app-actions {
  display: flex;
  gap: 0.75rem;
}

.btn-primary,
.btn-secondary {
  flex: 1;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
  text-decoration: none;
  border: none;
}

.btn-primary {
  background: #4361ee;
  color: white;
}

.btn-primary:hover {
  background: #3451d4;
}

.btn-secondary {
  background: #f1f5f9;
  color: #475569;
}

.btn-secondary:hover {
  background: #e2e8f0;
}

.architecture-info {
  background: white;
  border-radius: 1rem;
  padding: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.architecture-info h2 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 1.5rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.info-card {
  background: #f8fafc;
  padding: 1.5rem;
  border-radius: 0.75rem;
}

.info-card h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #334155;
  margin-bottom: 1rem;
}

.info-card pre {
  margin: 0;
}

.info-card code {
  font-family: 'Courier New', monospace;
  font-size: 0.8125rem;
  color: #475569;
  line-height: 1.6;
}

@media (max-width: 768px) {
  .apps-grid {
    grid-template-columns: 1fr;
  }

  .showcase-header h1 {
    font-size: 2rem;
  }
}
</style>
