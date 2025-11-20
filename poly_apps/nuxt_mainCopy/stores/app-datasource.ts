// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import { defineStore } from 'pinia'
import type { DataSourceConfig, DataSourceStatus } from '@/types/datasource'
import { getCurrentAppEntry, getAppEntryConfig } from '@/app-entry'
import { exampleDataSourceAPI } from '@/services/api/example/example-datasource-api'
import { adminDataSourceAPI } from '@/services/api/admin/admin-datasource-api'

export const useAppDataSourceStore = defineStore('app-datasource', () => {
  // State
  const dataSources = ref<DataSourceConfig[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const currentAppEntry = ref(getCurrentAppEntry())
  const appConfig = ref(getAppEntryConfig())

  // Getters
  const activeDataSources = computed(() => 
    dataSources.value.filter(ds => ds.status === 'active')
  )

  const dataSourceCount = computed(() => dataSources.value.length)

  const healthyDataSources = computed(() => 
    dataSources.value.filter(ds => ds.status === 'active').length
  )

  const unhealthyDataSources = computed(() => 
    dataSources.value.filter(ds => ds.status === 'error').length
  )

  const stats = computed(() => ({
    total: dataSourceCount.value,
    healthy: healthyDataSources.value,
    unhealthy: unhealthyDataSources.value,
    inactive: dataSources.value.filter(ds => ds.status === 'inactive').length
  }))

  // Get appropriate API service based on current app entry
  const getAPIService = () => {
    switch (currentAppEntry.value) {
      case 'admin':
        return adminDataSourceAPI
      case 'example':
      default:
        return exampleDataSourceAPI
    }
  }

  // Actions
  const loadDataSources = async () => {
    loading.value = true
    error.value = null
    
    try {
      const apiService = getAPIService()
      
      if (currentAppEntry.value === 'admin') {
        // Admin can see all data sources
        dataSources.value = await (apiService as typeof adminDataSourceAPI).getAllDataSources()
      } else {
        // Other apps see only their namespace data sources
        dataSources.value = await apiService.getDataSources()
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load data sources'
      console.error('DataSource store error:', err)
    } finally {
      loading.value = false
    }
  }

  const loadDataSourcesByNamespace = async (namespace: string) => {
    if (currentAppEntry.value !== 'admin') {
      throw new Error('Only admin can load data sources by namespace')
    }

    loading.value = true
    error.value = null
    
    try {
      dataSources.value = await adminDataSourceAPI.getDataSourcesByNamespace(namespace)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load data sources by namespace'
      console.error('DataSource store error:', err)
    } finally {
      loading.value = false
    }
  }

  const addDataSource = async (config: Partial<DataSourceConfig>, targetNamespace?: string) => {
    loading.value = true
    error.value = null
    
    try {
      const apiService = getAPIService()
      let newDataSource: DataSourceConfig | null

      if (currentAppEntry.value === 'admin') {
        newDataSource = await (apiService as typeof adminDataSourceAPI).createDataSource(config, targetNamespace)
      } else {
        newDataSource = await apiService.createDataSource(config)
      }

      if (newDataSource) {
        dataSources.value.push(newDataSource)
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to add data source'
      console.error('DataSource store error:', err)
    } finally {
      loading.value = false
    }
  }

  const updateDataSource = async (id: string, config: Partial<DataSourceConfig>) => {
    loading.value = true
    error.value = null
    
    try {
      const apiService = getAPIService()
      const updatedDataSource = await apiService.updateDataSource(id, config)

      if (updatedDataSource) {
        const index = dataSources.value.findIndex(ds => ds.id === id)
        if (index !== -1) {
          dataSources.value[index] = updatedDataSource
        }
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update data source'
      console.error('DataSource store error:', err)
    } finally {
      loading.value = false
    }
  }

  const removeDataSource = async (id: string) => {
    loading.value = true
    error.value = null
    
    try {
      const apiService = getAPIService()
      const success = await apiService.deleteDataSource(id)

      if (success) {
        const index = dataSources.value.findIndex(ds => ds.id === id)
        if (index !== -1) {
          dataSources.value.splice(index, 1)
        }
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to remove data source'
      console.error('DataSource store error:', err)
    } finally {
      loading.value = false
    }
  }

  const testConnection = async (id: string): Promise<{ success: boolean; message: string }> => {
    loading.value = true
    error.value = null
    
    try {
      const apiService = getAPIService()
      return await apiService.testConnection(id)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Connection test failed'
      console.error('DataSource store error:', err)
      return { success: false, message: 'Connection test failed' }
    } finally {
      loading.value = false
    }
  }

  const getStatistics = async () => {
    loading.value = true
    error.value = null
    
    try {
      const apiService = getAPIService()
      
      if (currentAppEntry.value === 'admin') {
        return await (apiService as typeof adminDataSourceAPI).getSystemStatistics()
      } else {
        return await apiService.getStatistics()
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to get statistics'
      console.error('DataSource store error:', err)
      return { total: 0, active: 0, inactive: 0, error: 0 }
    } finally {
      loading.value = false
    }
  }

  // Switch app entry context
  const switchAppEntry = (newEntry: typeof currentAppEntry.value) => {
    currentAppEntry.value = newEntry
    appConfig.value = getAppEntryConfig(newEntry)
    // Clear current data when switching context
    dataSources.value = []
  }

  return {
    // State
    dataSources: readonly(dataSources),
    loading: readonly(loading),
    error: readonly(error),
    currentAppEntry: readonly(currentAppEntry),
    appConfig: readonly(appConfig),
    
    // Getters
    activeDataSources,
    dataSourceCount,
    healthyDataSources,
    unhealthyDataSources,
    stats,
    
    // Actions
    loadDataSources,
    loadDataSourcesByNamespace,
    addDataSource,
    updateDataSource,
    removeDataSource,
    testConnection,
    getStatistics,
    switchAppEntry
  }
})
