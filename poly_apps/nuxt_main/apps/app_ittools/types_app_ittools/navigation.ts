// Navigation and Menu Types for Laravel Web Panel

export type ModuleId = 
  | 'api-testing'
  | 'dev-tools'
  | 'system-info'
  | 'vocabulary'
  | 'code-browser'
  | 'static-resources'
  | 'mcp-manager'
  | 'octane-tasks';

export interface MenuItem {
  id: ModuleId;
  icon: string;
  label: string;
  description?: string;
  badge?: string | number;
  children?: SubMenuItem[];
}

export interface SubMenuItem {
  id: string;
  label: string;
  icon?: string;
  route?: string;
}

export interface AppState {
  activeModule: ModuleId;
  sidebarCollapsed: boolean;
  mobileMenuOpen: boolean;
}
