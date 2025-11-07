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
  <div class="codemart-sidebar">
    <nav class="sidebar-nav">
      <div class="sidebar-header">
        <div class="logo">
          <svg class="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
          </svg>
          <span class="logo-text">CodeMart</span>
        </div>
      </div>

      <div class="role-selector" v-if="availableRoles.length > 1">
        <select v-model="currentRole" @change="onRoleChange" class="role-select">
          <option v-for="role in availableRoles" :key="role" :value="role">
            {{ getRoleLabel(role) }}
          </option>
        </select>
      </div>

      <div class="menu-items">
        <template v-for="item in filteredMenu" :key="item.id">
          <div class="menu-item" :class="{ 'has-children': item.children, 'active': isActive(item) }">
            <NuxtLink
              v-if="item.route && !item.children"
              :to="item.route"
              class="menu-link"
            >
              <component :is="getIcon(item.icon)" class="menu-icon" />
              <span class="menu-label">{{ item.label }}</span>
              <span v-if="item.badge" :class="`badge badge-${item.badge.type}`">
                {{ item.badge.value }}
              </span>
            </NuxtLink>

            <div
              v-else
              class="menu-link"
              @click="toggleSubmenu(item.id)"
            >
              <component :is="getIcon(item.icon)" class="menu-icon" />
              <span class="menu-label">{{ item.label }}</span>
              <svg
                class="chevron"
                :class="{ 'rotated': isSubmenuOpen(item.id) }"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
              </svg>
            </div>

            <div
              v-if="item.children"
              class="submenu"
              :class="{ 'open': isSubmenuOpen(item.id) }"
            >
              <NuxtLink
                v-for="child in item.children"
                :key="child.id"
                :to="child.route"
                class="submenu-link"
                :class="{ 'active': isActive(child) }"
              >
                <component :is="getIcon(child.icon)" class="submenu-icon" />
                <span class="submenu-label">{{ child.label }}</span>
                <span v-if="child.badge" :class="`badge badge-${child.badge.type}`">
                  {{ child.badge.value }}
                </span>
              </NuxtLink>
            </div>
          </div>
        </template>
      </div>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { codemartMenu, getMenuForRole, type UserRole, type MenuItem } from '@/configs/codemart-menu';
import { codemartTheme } from '@/app_codemart/theme_app_codemart/codemart-theme';
import { useAppTheme } from '@/common/composables/useAppTheme';
import { useCodemartStore } from '@/app_codemart/stores_app_codemart/codemart-store';

const route = useRoute();
const currentRole = ref<UserRole>('developer');
const openSubmenus = ref<Set<string>>(new Set());
const availableRoles = ref<UserRole[]>(['client', 'developer', 'architect', 'reviewer', 'admin']);

const { colors, gradients } = useAppTheme(codemartTheme);
const codemartStore = useCodemartStore();

onMounted(() => {
  const savedRole = codemartStore.currentRole;
  if (savedRole) {
    currentRole.value = savedRole;
  }
});

const filteredMenu = computed(() => {
  return getMenuForRole(currentRole.value);
});

const isActive = (item: MenuItem): boolean => {
  if (item.route === route.path) {
    return true;
  }
  if (item.children) {
    return item.children.some(child => child.route === route.path);
  }
  return false;
};

const isSubmenuOpen = (itemId: string): boolean => {
  return openSubmenus.value.has(itemId);
};

const toggleSubmenu = (itemId: string) => {
  if (openSubmenus.value.has(itemId)) {
    openSubmenus.value.delete(itemId);
  } else {
    openSubmenus.value.add(itemId);
  }
};

const onRoleChange = () => {
  openSubmenus.value.clear();
  codemartStore.setRole(currentRole.value);
};

const getRoleLabel = (role: UserRole): string => {
  const labels: Record<UserRole, string> = {
    client: 'Client',
    developer: 'Developer',
    architect: 'Architect',
    reviewer: 'Reviewer',
    admin: 'Admin'
  };
  return labels[role];
};

const getIcon = (iconName: string) => {
  const icons: Record<string, any> = {
    'chart-bar': 'IconChartBar',
    'home': 'IconHome',
    'folder': 'IconFolder',
    'folder-open': 'IconFolderOpen',
    'clock': 'IconClock',
    'check-circle': 'IconCheckCircle',
    'archive': 'IconArchive',
    'plus-circle': 'IconPlusCircle',
    'credit-card': 'IconCreditCard',
    'list': 'IconList',
    'file-text': 'IconFileText',
    'rotate-ccw': 'IconRotateCcw',
    'users': 'IconUsers',
    'user-check': 'IconUserCheck',
    'user-cog': 'IconUserCog',
    'star': 'IconStar',
    'bar-chart': 'IconBarChart',
    'trending-up': 'IconTrendingUp',
    'dollar-sign': 'IconDollarSign',
    'check-square': 'IconCheckSquare',
    'briefcase': 'IconBriefcase',
    'zap': 'IconZap',
    'play-circle': 'IconPlayCircle',
    'x-circle': 'IconXCircle',
    'code': 'IconCode',
    'terminal': 'IconTerminal',
    'download': 'IconDownload',
    'upload': 'IconUpload',
    'bar-chart-2': 'IconBarChart2',
    'award': 'IconAward',
    'book': 'IconBook',
    'video': 'IconVideo',
    'check': 'IconCheck',
    'layers': 'IconLayers',
    'user-plus': 'IconUserPlus',
    'activity': 'IconActivity',
    'git-pull-request': 'IconGitPullRequest',
    'book-open': 'IconBookOpen',
    'git-branch': 'IconGitBranch',
    'history': 'IconHistory',
    'monitor': 'IconMonitor',
    'pie-chart': 'IconPieChart',
    'trello': 'IconTrello',
    'calendar': 'IconCalendar',
    'alert-triangle': 'IconAlertTriangle',
    'clipboard': 'IconClipboard',
    'target': 'IconTarget',
    'hash': 'IconHash',
    'shield': 'IconShield',
    'database': 'IconDatabase',
    'percent': 'IconPercent',
    'settings': 'IconSettings',
    'sliders': 'IconSliders',
    'cpu': 'IconCpu',
    'bell': 'IconBell'
  };

  return icons[iconName] || 'IconCircle';
};

watch(() => route.path, () => {
  const currentItem = filteredMenu.value.find(item => {
    if (item.route === route.path) return true;
    if (item.children) {
      return item.children.some(child => child.route === route.path);
    }
    return false;
  });

  if (currentItem && currentItem.children) {
    openSubmenus.value.add(currentItem.id);
  }
});
</script>

<style scoped>
.codemart-sidebar {
  width: 260px;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  position: fixed;
  left: 0;
  top: 0;
  overflow-y: auto;
  box-shadow: 4px 0 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
}

.sidebar-header {
  padding: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.logo-text {
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
}

.role-selector {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.role-select {
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: rgba(255, 255, 255, 0.15);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.5rem;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.role-select:hover {
  background: rgba(255, 255, 255, 0.2);
}

.role-select option {
  background: #667eea;
  color: white;
}

.menu-items {
  padding: 1rem 0;
}

.menu-item {
  margin-bottom: 0.25rem;
}

.menu-link {
  display: flex;
  align-items: center;
  padding: 0.75rem 1.5rem;
  color: rgba(255, 255, 255, 0.9);
  text-decoration: none;
  transition: all 0.2s;
  cursor: pointer;
  position: relative;
}

.menu-link:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.menu-item.active > .menu-link {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border-left: 3px solid white;
}

.menu-icon {
  width: 1.25rem;
  height: 1.25rem;
  margin-right: 0.75rem;
  flex-shrink: 0;
}

.menu-label {
  flex: 1;
  font-size: 0.875rem;
  font-weight: 500;
}

.chevron {
  width: 1rem;
  height: 1rem;
  transition: transform 0.2s;
}

.chevron.rotated {
  transform: rotate(180deg);
}

.badge {
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  margin-left: 0.5rem;
}

.badge-success {
  background: #10b981;
  color: white;
}

.badge-warning {
  background: #f59e0b;
  color: white;
}

.badge-danger {
  background: #ef4444;
  color: white;
}

.badge-info {
  background: #3b82f6;
  color: white;
}

.submenu {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease-out;
  background: rgba(0, 0, 0, 0.1);
}

.submenu.open {
  max-height: 1000px;
  transition: max-height 0.5s ease-in;
}

.submenu-link {
  display: flex;
  align-items: center;
  padding: 0.625rem 1.5rem 0.625rem 3.5rem;
  color: rgba(255, 255, 255, 0.8);
  text-decoration: none;
  transition: all 0.2s;
  font-size: 0.8125rem;
}

.submenu-link:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.submenu-link.active {
  background: rgba(255, 255, 255, 0.15);
  color: white;
  border-left: 2px solid white;
}

.submenu-icon {
  width: 1rem;
  height: 1rem;
  margin-right: 0.75rem;
  flex-shrink: 0;
}

.submenu-label {
  flex: 1;
}

::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}
</style>
