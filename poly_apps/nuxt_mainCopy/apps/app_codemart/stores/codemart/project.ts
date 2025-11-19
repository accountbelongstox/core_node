/**
 * Project Store
 *
 * Global state management for projects:
 * - Active project drafts
 * - Submitted projects list
 * - Project list cache
 * - Current editing project
 * - Project filters and preferences
 * - Project statistics
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  Project,
  ProjectStatus,
  ProjectComplexity,
  Milestone
} from '~/apps/app_codemart/types_app_codemart'

interface ProjectDraft {
  id: string
  data: any
  lastModified: string
}

interface ProjectFilters {
  status?: ProjectStatus
  complexity?: ProjectComplexity
  minBudget?: number
  maxBudget?: number
  search?: string
}

interface ProjectStatistics {
  total: number
  byStatus: Record<ProjectStatus, number>
  byComplexity: Record<ProjectComplexity, number>
  totalBudget: number
  averageBudget: number
}

export const useProjectStore = defineStore('codemart-project', () => {
  // State
  const projects = ref<Project[]>([])
  const drafts = ref<Map<string, ProjectDraft>>(new Map())
  const currentProject = ref<Project | null>(null)
  const filters = ref<ProjectFilters>({})
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Project cache by ID
  const projectCache = ref<Map<number, Project>>(new Map())

  // Last fetch timestamp for cache invalidation
  const lastFetchTimestamp = ref<number>(0)
  const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  // Getters
  const allProjects = computed(() => projects.value)

  const filteredProjects = computed(() => {
    let result = [...projects.value]

    if (filters.value.status) {
      result = result.filter(p => p.status === filters.value.status)
    }

    if (filters.value.complexity) {
      result = result.filter(p => p.complexity === filters.value.complexity)
    }

    if (filters.value.minBudget !== undefined) {
      result = result.filter(p => p.budget >= (filters.value.minBudget || 0))
    }

    if (filters.value.maxBudget !== undefined) {
      result = result.filter(p => p.budget <= (filters.value.maxBudget || Infinity))
    }

    if (filters.value.search) {
      const searchLower = filters.value.search.toLowerCase()
      result = result.filter(p =>
        p.title.toLowerCase().includes(searchLower) ||
        p.description?.toLowerCase().includes(searchLower)
      )
    }

    return result
  })

  const projectsByStatus = computed(() => {
    const grouped: Record<string, Project[]> = {}

    projects.value.forEach(project => {
      const status = project.status
      if (!grouped[status]) {
        grouped[status] = []
      }
      grouped[status].push(project)
    })

    return grouped
  })

  const activeProjects = computed(() => {
    return projects.value.filter(p =>
      p.status === 'active' || p.status === 'in_progress'
    )
  })

  const completedProjects = computed(() => {
    return projects.value.filter(p => p.status === 'completed')
  })

  const pendingProjects = computed(() => {
    return projects.value.filter(p => p.status === 'pending')
  })

  const statistics = computed<ProjectStatistics>(() => {
    const stats: ProjectStatistics = {
      total: projects.value.length,
      byStatus: {
        pending: 0,
        active: 0,
        in_progress: 0,
        completed: 0,
        cancelled: 0,
        on_hold: 0
      },
      byComplexity: {
        simple: 0,
        medium: 0,
        complex: 0,
        enterprise: 0
      },
      totalBudget: 0,
      averageBudget: 0
    }

    projects.value.forEach(project => {
      stats.byStatus[project.status]++
      stats.byComplexity[project.complexity]++
      stats.totalBudget += project.budget
    })

    stats.averageBudget = projects.value.length > 0
      ? stats.totalBudget / projects.value.length
      : 0

    return stats
  })

  const hasDrafts = computed(() => drafts.value.size > 0)

  const draftCount = computed(() => drafts.value.size)

  // Actions - Projects
  function addProject(project: Project) {
    projects.value.push(project)

    // Add to cache
    if (project.id) {
      projectCache.value.set(project.id, project)
    }
  }

  function updateProject(projectId: number, updates: Partial<Project>) {
    const index = projects.value.findIndex(p => p.id === projectId)
    if (index !== -1) {
      projects.value[index] = { ...projects.value[index], ...updates }

      // Update cache
      projectCache.value.set(projectId, projects.value[index])

      // Update current project if it's the one being edited
      if (currentProject.value?.id === projectId) {
        currentProject.value = projects.value[index]
      }
    }
  }

  function removeProject(projectId: number) {
    const index = projects.value.findIndex(p => p.id === projectId)
    if (index !== -1) {
      projects.value.splice(index, 1)
      projectCache.value.delete(projectId)

      if (currentProject.value?.id === projectId) {
        currentProject.value = null
      }
    }
  }

  function setProjects(newProjects: Project[]) {
    projects.value = newProjects

    // Update cache
    projectCache.value.clear()
    newProjects.forEach(project => {
      if (project.id) {
        projectCache.value.set(project.id, project)
      }
    })

    lastFetchTimestamp.value = Date.now()
  }

  function getProjectById(projectId: number): Project | null {
    // Check cache first
    if (projectCache.value.has(projectId)) {
      return projectCache.value.get(projectId) || null
    }

    // Fallback to array search
    return projects.value.find(p => p.id === projectId) || null
  }

  function setCurrentProject(project: Project | null) {
    currentProject.value = project
  }

  // Actions - Filters
  function updateFilters(newFilters: Partial<ProjectFilters>) {
    filters.value = { ...filters.value, ...newFilters }
  }

  function clearFilters() {
    filters.value = {}
  }

  // Actions - Drafts
  function saveDraft(draftId: string, data: any) {
    drafts.value.set(draftId, {
      id: draftId,
      data,
      lastModified: new Date().toISOString()
    })
  }

  function getDraft(draftId: string): ProjectDraft | null {
    return drafts.value.get(draftId) || null
  }

  function removeDraft(draftId: string) {
    drafts.value.delete(draftId)
  }

  function clearAllDrafts() {
    drafts.value.clear()
  }

  function getAllDrafts(): ProjectDraft[] {
    return Array.from(drafts.value.values())
  }

  // Actions - Cache
  function isCacheValid(): boolean {
    return Date.now() - lastFetchTimestamp.value < CACHE_DURATION
  }

  function invalidateCache() {
    lastFetchTimestamp.value = 0
    projectCache.value.clear()
  }

  function clearCache() {
    projectCache.value.clear()
    lastFetchTimestamp.value = 0
  }

  // Actions - State Management
  function setLoading(value: boolean) {
    loading.value = value
  }

  function setError(errorMessage: string | null) {
    error.value = errorMessage
  }

  // Actions - Reset
  function resetStore() {
    projects.value = []
    drafts.value.clear()
    currentProject.value = null
    filters.value = {}
    projectCache.value.clear()
    lastFetchTimestamp.value = 0
    loading.value = false
    error.value = null
  }

  return {
    // State
    projects,
    drafts,
    currentProject,
    filters,
    loading,
    error,

    // Getters
    allProjects,
    filteredProjects,
    projectsByStatus,
    activeProjects,
    completedProjects,
    pendingProjects,
    statistics,
    hasDrafts,
    draftCount,

    // Actions - Projects
    addProject,
    updateProject,
    removeProject,
    setProjects,
    getProjectById,
    setCurrentProject,

    // Actions - Filters
    updateFilters,
    clearFilters,

    // Actions - Drafts
    saveDraft,
    getDraft,
    removeDraft,
    clearAllDrafts,
    getAllDrafts,

    // Actions - Cache
    isCacheValid,
    invalidateCache,
    clearCache,

    // Actions - State
    setLoading,
    setError,

    // Actions - Reset
    resetStore
  }
})
