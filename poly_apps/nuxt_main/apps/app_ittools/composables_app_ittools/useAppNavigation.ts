// App Navigation Composable - uses unified state management
import type { ModuleId, MenuItem } from '../types_app_ittools/navigation'
import { useAppState } from './useAppState'
import { useI18n } from './useI18n'

export const useAppNavigation = () => {
  const appState = useAppState()
  const { t } = useI18n()

  // Build menu items with i18n
  const menuItems = computed<MenuItem[]>(() => [
    {
      id: 'api-testing',
      icon: t('modules.apiTesting.icon'),
      label: t('modules.apiTesting.name'),
      description: t('modules.apiTesting.description')
    },
    {
      id: 'dev-tools',
      icon: t('modules.devTools.icon'),
      label: t('modules.devTools.name'),
      description: t('modules.devTools.description'),
      children: [
        {
          id: 'ittools',
          label: t('modules.devTools.name'),
          icon: 'wrench'
        }
      ]
    },
    {
      id: 'system-info',
      icon: t('modules.systemInfo.icon'),
      label: t('modules.systemInfo.name'),
      description: t('modules.systemInfo.description')
    },
    {
      id: 'vocabulary',
      icon: t('modules.vocabulary.icon'),
      label: t('modules.vocabulary.name'),
      description: t('modules.vocabulary.description')
    },
    {
      id: 'code-browser',
      icon: t('modules.codeBrowser.icon'),
      label: t('modules.codeBrowser.name'),
      description: t('modules.codeBrowser.description')
    },
    {
      id: 'static-resources',
      icon: t('modules.staticResources.icon'),
      label: t('modules.staticResources.name'),
      description: t('modules.staticResources.description')
    },
    {
      id: 'mcp-manager',
      icon: t('modules.mcpManager.icon'),
      label: t('modules.mcpManager.name'),
      description: t('modules.mcpManager.description')
    },
    {
      id: 'octane-tasks',
      icon: t('modules.octaneTasks.icon'),
      label: t('modules.octaneTasks.name'),
      description: t('modules.octaneTasks.description')
    }
  ])

  // Get current module info
  const currentModule = computed(() => {
    return menuItems.value.find(item => item.id === appState.activeModule.value)
  })

  return {
    // State from unified state management
    activeModule: appState.activeModule,
    sidebarCollapsed: appState.sidebarCollapsed,
    mobileMenuOpen: appState.mobileMenuOpen,

    // Computed
    menuItems,
    currentModule,

    // Actions from unified state management
    setActiveModule: appState.setActiveModule,
    toggleSidebar: appState.toggleSidebar,
    toggleMobileMenu: appState.toggleMobileMenu,
    closeMobileMenu: () => appState.setMobileMenuOpen(false)
  }
}
