/**
 * Task Store
 *
 * Global state management for tasks:
 * - Task list cache
 * - Applied tasks tracking
 * - Task filters state
 * - Bookmarked/favorite tasks
 * - Task search history
 * - Task statistics
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  Task,
  TaskStatus,
  TaskPriority
} from '~/apps/app_codemart/types_app_codemart'

interface TaskFilters {
  status?: TaskStatus | ''
  priority?: TaskPriority | ''
  skills?: string[]
  search?: string
  minBudget?: number
  maxBudget?: number
}

interface TaskCache {
  [key: string]: {
    data: Task[]
    total: number
    timestamp: number
  }
}

interface TaskStatistics {
  total: number
  byStatus: Record<string, number>
  byPriority: Record<string, number>
  appliedCount: number
  bookmarkedCount: number
}

export const useTaskStore = defineStore('codemart-task', () => {
  // State
  const tasks = ref<Task[]>([])
  const appliedTasks = ref<Set<number>>(new Set())
  const bookmarkedTasks = ref<Set<number>>(new Set())
  const taskCache = ref<Map<number, Task>>(new Map())
  const filters = ref<TaskFilters>({})
  const searchHistory = ref<string[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const MAX_SEARCH_HISTORY = 20

  // Getters
  const allTasks = computed(() => tasks.value)

  const filteredTasks = computed(() => {
    let result = [...tasks.value]

    if (filters.value.status) {
      result = result.filter(t => t.status === filters.value.status)
    }

    if (filters.value.priority) {
      result = result.filter(t => t.priority === filters.value.priority)
    }

    if (filters.value.skills && filters.value.skills.length > 0) {
      result = result.filter(t => {
        // Check if task has any of the required skills
        // This assumes task has a skills field - adjust based on actual Task type
        return filters.value.skills?.some(skill =>
          t.deliverables?.some(d =>
            d.toLowerCase().includes(skill.toLowerCase())
          )
        )
      })
    }

    if (filters.value.minBudget !== undefined) {
      result = result.filter(t =>
        t.budget_allocation && t.budget_allocation >= (filters.value.minBudget || 0)
      )
    }

    if (filters.value.maxBudget !== undefined) {
      result = result.filter(t =>
        t.budget_allocation && t.budget_allocation <= (filters.value.maxBudget || Infinity)
      )
    }

    if (filters.value.search) {
      const searchLower = filters.value.search.toLowerCase()
      result = result.filter(t =>
        t.title.toLowerCase().includes(searchLower) ||
        t.description?.toLowerCase().includes(searchLower)
      )
    }

    return result
  })

  const tasksByStatus = computed(() => {
    const grouped: Record<string, Task[]> = {}

    tasks.value.forEach(task => {
      const status = task.status
      if (!grouped[status]) {
        grouped[status] = []
      }
      grouped[status].push(task)
    })

    return grouped
  })

  const appliedTasksList = computed(() => {
    return tasks.value.filter(t => t.id && appliedTasks.value.has(t.id))
  })

  const bookmarkedTasksList = computed(() => {
    return tasks.value.filter(t => t.id && bookmarkedTasks.value.has(t.id))
  })

  const openTasks = computed(() => {
    return tasks.value.filter(t => t.status === 'open')
  })

  const myTasks = computed(() => {
    // TODO: Filter by current user ID when user store is available
    return tasks.value.filter(t => t.assigned_to)
  })

  const statistics = computed<TaskStatistics>(() => {
    const stats: TaskStatistics = {
      total: tasks.value.length,
      byStatus: {},
      byPriority: {},
      appliedCount: appliedTasks.value.size,
      bookmarkedCount: bookmarkedTasks.value.size
    }

    tasks.value.forEach(task => {
      // Count by status
      if (!stats.byStatus[task.status]) {
        stats.byStatus[task.status] = 0
      }
      stats.byStatus[task.status]++

      // Count by priority
      if (!stats.byPriority[task.priority]) {
        stats.byPriority[task.priority] = 0
      }
      stats.byPriority[task.priority]++
    })

    return stats
  })

  // Actions - Tasks
  function addTask(task: Task) {
    tasks.value.push(task)

    // Add to cache
    if (task.id) {
      taskCache.value.set(task.id, task)
    }
  }

  function updateTask(taskId: number, updates: Partial<Task>) {
    const index = tasks.value.findIndex(t => t.id === taskId)
    if (index !== -1) {
      tasks.value[index] = { ...tasks.value[index], ...updates }

      // Update cache
      taskCache.value.set(taskId, tasks.value[index])
    }
  }

  function removeTask(taskId: number) {
    const index = tasks.value.findIndex(t => t.id === taskId)
    if (index !== -1) {
      tasks.value.splice(index, 1)
      taskCache.value.delete(taskId)
    }
  }

  function setTasks(newTasks: Task[]) {
    tasks.value = newTasks

    // Update cache
    taskCache.value.clear()
    newTasks.forEach(task => {
      if (task.id) {
        taskCache.value.set(task.id, task)
      }
    })
  }

  function getTaskById(taskId: number): Task | null {
    // Check cache first
    if (taskCache.value.has(taskId)) {
      return taskCache.value.get(taskId) || null
    }

    // Fallback to array search
    return tasks.value.find(t => t.id === taskId) || null
  }

  // Actions - Applied Tasks
  function markAsApplied(taskId: number) {
    appliedTasks.value.add(taskId)
    saveAppliedTasks()
  }

  function unmarkAsApplied(taskId: number) {
    appliedTasks.value.delete(taskId)
    saveAppliedTasks()
  }

  function isApplied(taskId: number): boolean {
    return appliedTasks.value.has(taskId)
  }

  function saveAppliedTasks() {
    try {
      const applied = Array.from(appliedTasks.value)
      localStorage.setItem('codemart_applied_tasks', JSON.stringify(applied))
    } catch (err) {
      console.error('Failed to save applied tasks:', err)
    }
  }

  function loadAppliedTasks() {
    try {
      const appliedStr = localStorage.getItem('codemart_applied_tasks')
      if (appliedStr) {
        const applied = JSON.parse(appliedStr)
        appliedTasks.value = new Set(applied)
      }
    } catch (err) {
      console.error('Failed to load applied tasks:', err)
    }
  }

  // Actions - Bookmarks
  function toggleBookmark(taskId: number) {
    if (bookmarkedTasks.value.has(taskId)) {
      bookmarkedTasks.value.delete(taskId)
    } else {
      bookmarkedTasks.value.add(taskId)
    }
    saveBookmarks()
  }

  function isBookmarked(taskId: number): boolean {
    return bookmarkedTasks.value.has(taskId)
  }

  function saveBookmarks() {
    try {
      const bookmarks = Array.from(bookmarkedTasks.value)
      localStorage.setItem('codemart_task_bookmarks', JSON.stringify(bookmarks))
    } catch (err) {
      console.error('Failed to save bookmarks:', err)
    }
  }

  function loadBookmarks() {
    try {
      const bookmarksStr = localStorage.getItem('codemart_task_bookmarks')
      if (bookmarksStr) {
        const bookmarks = JSON.parse(bookmarksStr)
        bookmarkedTasks.value = new Set(bookmarks)
      }
    } catch (err) {
      console.error('Failed to load bookmarks:', err)
    }
  }

  // Actions - Filters
  function updateFilters(newFilters: Partial<TaskFilters>) {
    filters.value = { ...filters.value, ...newFilters }
  }

  function clearFilters() {
    filters.value = {}
  }

  // Actions - Search History
  function addToSearchHistory(query: string) {
    if (!query.trim()) return

    // Remove if already exists
    const index = searchHistory.value.indexOf(query)
    if (index > -1) {
      searchHistory.value.splice(index, 1)
    }

    // Add to beginning
    searchHistory.value.unshift(query)

    // Limit size
    if (searchHistory.value.length > MAX_SEARCH_HISTORY) {
      searchHistory.value = searchHistory.value.slice(0, MAX_SEARCH_HISTORY)
    }

    saveSearchHistory()
  }

  function removeFromSearchHistory(query: string) {
    const index = searchHistory.value.indexOf(query)
    if (index > -1) {
      searchHistory.value.splice(index, 1)
      saveSearchHistory()
    }
  }

  function clearSearchHistory() {
    searchHistory.value = []
    localStorage.removeItem('codemart_task_search_history')
  }

  function saveSearchHistory() {
    try {
      localStorage.setItem('codemart_task_search_history', JSON.stringify(searchHistory.value))
    } catch (err) {
      console.error('Failed to save search history:', err)
    }
  }

  function loadSearchHistory() {
    try {
      const historyStr = localStorage.getItem('codemart_task_search_history')
      if (historyStr) {
        searchHistory.value = JSON.parse(historyStr)
      }
    } catch (err) {
      console.error('Failed to load search history:', err)
    }
  }

  // Actions - Cache
  function clearCache() {
    taskCache.value.clear()
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
    tasks.value = []
    appliedTasks.value.clear()
    bookmarkedTasks.value.clear()
    taskCache.value.clear()
    filters.value = {}
    searchHistory.value = []
    loading.value = false
    error.value = null
  }

  // Initialize
  function initialize() {
    loadAppliedTasks()
    loadBookmarks()
    loadSearchHistory()
  }

  return {
    // State
    tasks,
    appliedTasks,
    bookmarkedTasks,
    filters,
    searchHistory,
    loading,
    error,

    // Getters
    allTasks,
    filteredTasks,
    tasksByStatus,
    appliedTasksList,
    bookmarkedTasksList,
    openTasks,
    myTasks,
    statistics,

    // Actions - Tasks
    addTask,
    updateTask,
    removeTask,
    setTasks,
    getTaskById,

    // Actions - Applied
    markAsApplied,
    unmarkAsApplied,
    isApplied,

    // Actions - Bookmarks
    toggleBookmark,
    isBookmarked,

    // Actions - Filters
    updateFilters,
    clearFilters,

    // Actions - Search
    addToSearchHistory,
    removeFromSearchHistory,
    clearSearchHistory,

    // Actions - Cache
    clearCache,

    // Actions - State
    setLoading,
    setError,

    // Actions - Reset
    resetStore,
    initialize
  }
})
