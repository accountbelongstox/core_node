// =================================================================
// IT Tools UI Configuration - Centralized Data
// =================================================================

// Main Navigation Tabs
export interface MainTab {
  id: string;
  name: string;
  icon: string;
  badge?: string;
}

export const MAIN_TABS: MainTab[] = [
  { id: 'ittools', name: 'IT Tools', icon: 'fas fa-tools', badge: '88+' },
  { id: 'browser', name: 'Browser Automation', icon: 'fas fa-globe' },
  { id: 'windows', name: 'Windows Operations', icon: 'fab fa-windows' },
  { id: 'nginx', name: 'Nginx Management', icon: 'fas fa-server' }
];

// Category Menu Configuration (Two rows like Laravel)
export interface CategoryMenuItem {
  id: string;
  name: string;
  icon: string;
}

export const CATEGORY_MENU_ROW_1: CategoryMenuItem[] = [
  { id: 'crypto', name: 'Crypto & Security', icon: 'fas fa-lock' },
  { id: 'converter', name: 'Converters', icon: 'fas fa-exchange-alt' },
  { id: 'media', name: 'Image Tools', icon: 'fas fa-image' },
  { id: 'web', name: 'Web Dev', icon: 'fas fa-globe' },
  { id: 'math', name: 'Calculator Tools', icon: 'fas fa-calculator' },
  { id: 'development', name: 'Development', icon: 'fas fa-code' }
];

export const CATEGORY_MENU_ROW_2: CategoryMenuItem[] = [
  { id: 'text', name: 'Text Tools', icon: 'fas fa-font' },
  { id: 'network', name: 'Network Tools', icon: 'fas fa-network-wired' },
  { id: 'data', name: 'Data Tools', icon: 'fas fa-database' },
  { id: 'measurement', name: 'Utility Tools', icon: 'fas fa-ruler' }
];

// All Categories Combined
export const ALL_CATEGORY_MENUS = [...CATEGORY_MENU_ROW_1, ...CATEGORY_MENU_ROW_2];

// Category Icons Map
export const CATEGORY_ICONS: Record<string, string> = {
  crypto: 'fas fa-lock',
  converter: 'fas fa-exchange-alt',
  web: 'fas fa-globe',
  text: 'fas fa-font',
  math: 'fas fa-calculator',
  network: 'fas fa-network-wired',
  media: 'fas fa-photo-video',
  development: 'fas fa-code',
  measurement: 'fas fa-ruler',
  data: 'fas fa-database',
  all: 'fas fa-layer-group'
};

// Category Colors Map
export const CATEGORY_COLORS: Record<string, string> = {
  crypto: '#8b5cf6',
  converter: '#06b6d4',
  web: '#3b82f6',
  text: '#10b981',
  math: '#f59e0b',
  network: '#ef4444',
  media: '#ec4899',
  development: '#6366f1',
  measurement: '#14b8a6',
  data: '#f97316',
  all: '#6b7280'
};

// Default Expanded Categories
export const DEFAULT_EXPANDED_CATEGORIES = ['crypto', 'converter', 'web', 'text', 'development'];

// Helper Functions
export function getCategoryIcon(categoryId: string): string {
  return CATEGORY_ICONS[categoryId] || 'fas fa-folder';
}

export function getCategoryColor(categoryId: string): string {
  return CATEGORY_COLORS[categoryId] || '#6b7280';
}

export function getCategoryName(categoryId: string): string {
  const category = ALL_CATEGORY_MENUS.find(c => c.id === categoryId);
  return category?.name || categoryId.charAt(0).toUpperCase() + categoryId.slice(1);
}

// Status Configuration
export interface StatusConfig {
  icon: string;
  color: string;
  bgColor: string;
  text: string;
}

export const CONNECTION_STATUS: Record<string, StatusConfig> = {
  connected: {
    icon: 'fas fa-check-circle',
    color: '#22c55e',
    bgColor: 'rgba(34, 197, 94, 0.1)',
    text: 'Connected'
  },
  disconnected: {
    icon: 'fas fa-times-circle',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.1)',
    text: 'Disconnected'
  },
  connecting: {
    icon: 'fas fa-spinner fa-spin',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.1)',
    text: 'Connecting...'
  }
};

// Log Levels
export const LOG_LEVEL_STYLES: Record<string, { color: string; bgColor: string }> = {
  info: { color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.1)' },
  success: { color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.1)' },
  warning: { color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.1)' },
  error: { color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.1)' }
};

// Stat Icons
export const STAT_ICONS = {
  totalTools: '🧰',
  categories: '🗂️',
  favorites: '⭐',
  recentlyUsed: '🕐'
};

// App Metadata
export const APP_CONFIG = {
  name: 'Developer Hub',
  tagline: 'Web Automation & Developer Tools',
  version: '1.0.0',
  copyright: '2025 Developer Hub',
  framework: 'Nuxt.js 3 & Vue.js 3'
};

// Browser Automation Actions
export interface ActionConfig {
  id: string;
  name: string;
  icon: string;
  description: string;
  color?: string;
}

export const BROWSER_ACTIONS: ActionConfig[] = [
  { id: 'navigate', name: 'Navigate', icon: 'fas fa-compass', description: 'Go to URL' },
  { id: 'click', name: 'Click Element', icon: 'fas fa-mouse-pointer', description: 'Click on element' },
  { id: 'type', name: 'Type Text', icon: 'fas fa-keyboard', description: 'Enter text' },
  { id: 'screenshot', name: 'Screenshot', icon: 'fas fa-camera', description: 'Capture page' },
  { id: 'executeJs', name: 'Execute JS', icon: 'fas fa-code', description: 'Run JavaScript' },
  { id: 'waitFor', name: 'Wait For', icon: 'fas fa-clock', description: 'Wait for element' }
];

// Windows Operations Actions
export const WINDOWS_ACTIONS: ActionConfig[] = [
  { id: 'killPort', name: 'Kill Port', icon: 'fas fa-plug', description: 'Terminate process on port' },
  { id: 'powerShell', name: 'PowerShell', icon: 'fas fa-terminal', description: 'Run PS command' },
  { id: 'shortcut', name: 'Shortcut', icon: 'fas fa-link', description: 'Create desktop shortcut' },
  { id: 'pythonPackage', name: 'Python Package', icon: 'fab fa-python', description: 'Manage pip packages' },
  { id: 'pythonScript', name: 'Python Script', icon: 'fab fa-python', description: 'Run Python script' }
];

// Nginx Management Actions
export const NGINX_ACTIONS: ActionConfig[] = [
  { id: 'status', name: 'Status', icon: 'fas fa-heartbeat', description: 'Check server status' },
  { id: 'sites', name: 'Sites', icon: 'fas fa-sitemap', description: 'Manage virtual hosts' },
  { id: 'reload', name: 'Reload', icon: 'fas fa-sync', description: 'Reload configuration' },
  { id: 'logs', name: 'Logs', icon: 'fas fa-file-alt', description: 'View access/error logs' }
];

// Quick Jump Categories (for sidebar)
export function getQuickJumpCategories(categoriesWithCounts: { id: string; name: string; count: number }[]) {
  return categoriesWithCounts.filter(c => c.id !== 'all');
}

// Export all for easy import
export default {
  MAIN_TABS,
  CATEGORY_MENU_ROW_1,
  CATEGORY_MENU_ROW_2,
  ALL_CATEGORY_MENUS,
  CATEGORY_ICONS,
  CATEGORY_COLORS,
  DEFAULT_EXPANDED_CATEGORIES,
  CONNECTION_STATUS,
  LOG_LEVEL_STYLES,
  STAT_ICONS,
  APP_CONFIG,
  BROWSER_ACTIONS,
  WINDOWS_ACTIONS,
  NGINX_ACTIONS,
  getCategoryIcon,
  getCategoryColor,
  getCategoryName
};

