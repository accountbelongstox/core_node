/**
 * Task Hall Composable
 *
 * Centralizes all business logic for task browsing and filtering:
 * - Task listing with pagination
 * - Advanced filtering (status, priority, skills, search)
 * - URL state synchronization
 * - Task bookmarking/favorites
 * - Filter presets
 * - Sorting options
 * - Cache management
 * - Task application logic
 */

import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { watchDebounced } from '@vueuse/core'
import taskApi from '~/apps/app_codemart/services_app_codemart/task-api'
import type {
  Task,
  TaskStatus,
  TaskPriority,
  PaginatedResponse
} from '~/apps/app_codemart/types_app_codemart'

interface TaskFilters {
  search: string
  status: TaskStatus | ''
  priority: TaskPriority | ''
  skills: string[]
  minBudget?: number
  maxBudget?: number
  assigned_to?: number
}

interface SortOption {
  field: 'created_at' | 'budget_allocation' | 'due_date' | 'priority'
  order: 'asc' | 'desc'
}

interface FilterPreset {
  id: string
  name: string
  filters: Partial<TaskFilters>
}

interface TaskCache {
  [key: string]: {
    data: Task[]
    total: number
    timestamp: number
  }
}

type ViewMode = 'grid' | 'list' | 'compact'

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
const BOOKMARKS_STORAGE_KEY = 'codemart_task_bookmarks'
const PREFERENCES_STORAGE_KEY = 'codemart_task_preferences'
const SEARCH_DEBOUNCE = 500

const POPULAR_SKILLS = [
  'Vue.js', 'React', 'Node.js', 'Python', 'TypeScript',
  'Java', 'Go', 'Docker', 'Kubernetes', 'AWS',
  'PostgreSQL', 'MongoDB', 'Redis', 'GraphQL', 'REST API'
]

const DEFAULT_PRESETS: FilterPreset[] = [
  {
    id: 'all',
    name: 'All Tasks',
    filters: {}
  },
  {
    id: 'open',
    name: 'Open Tasks',
    filters: { status: 'open' }
  },
  {
    id: 'high-priority',
    name: 'High Priority',
    filters: { priority: 'high' }
  },
  {
    id: 'urgent',
    name: 'Urgent Tasks',
    filters: { priority: 'urgent' }
  }
]

export function useTaskHall() {
  const router = useRouter()
  const route = useRoute()

  // State
  const loading = ref(false)
  const error = ref<string | null>(null)
  const tasks = ref<Task[]>([])
  const bookmarkedTasks = ref<Set<number>>(new Set())
  const cache = reactive<TaskCache>({})

  const filters = reactive<TaskFilters>({
    search: '',
    status: '',
    priority: '',
    skills: [],
    minBudget: undefined,
    maxBudget: undefined,
    assigned_to: undefined
  })

  const pagination = reactive({
    page: 1,
    pageSize: 12,
    total: 0
  })

  const sort = reactive<SortOption>({
    field: 'created_at',
    order: 'desc'
  })

  const viewMode = ref<ViewMode>('grid')
  const selectedTasks = ref<Set<number>>(new Set())
  const filterPresets = ref<FilterPreset[]>([...DEFAULT_PRESETS])
  const activePreset = ref<string>('all')

  // Computed
  const totalPages = computed(() => Math.ceil(pagination.total / pagination.pageSize))

  const hasActiveFilters = computed(() => {
    return (
      filters.search !== '' ||
      filters.status !== '' ||
      filters.priority !== '' ||
      filters.skills.length > 0 ||
      filters.minBudget !== undefined ||
      filters.maxBudget !== undefined
    )
  })

  const filteredTaskCount = computed(() => tasks.value.length)

  const bookmarkedTasksList = computed(() => {
    return tasks.value.filter(task => bookmarkedTasks.value.has(task.id as number))
  })

  const selectedTasksList = computed(() => {
    return tasks.value.filter(task => selectedTasks.value.has(task.id as number))
  })

  const canLoadMore = computed(() => pagination.page < totalPages.value)

  const popularSkills = computed(() => POPULAR_SKILLS)

  // URL State Synchronization
  const syncFiltersFromURL = () => {
    const query = route.query

    if (query.search) filters.search = String(query.search)
    if (query.status) filters.status = String(query.status) as TaskStatus | ''
    if (query.priority) filters.priority = String(query.priority) as TaskPriority | ''
    if (query.skills) {
      filters.skills = String(query.skills).split(',').filter(Boolean)
    }
    if (query.minBudget) filters.minBudget = Number(query.minBudget)
    if (query.maxBudget) filters.maxBudget = Number(query.maxBudget)
    if (query.page) pagination.page = Number(query.page)
    if (query.pageSize) pagination.pageSize = Number(query.pageSize)
    if (query.sortBy) sort.field = String(query.sortBy) as SortOption['field']
    if (query.sortOrder) sort.order = String(query.sortOrder) as 'asc' | 'desc'
    if (query.view) viewMode.value = String(query.view) as ViewMode
  }

  const syncFiltersToURL = () => {
    const query: Record<string, string> = {}

    if (filters.search) query.search = filters.search
    if (filters.status) query.status = filters.status
    if (filters.priority) query.priority = filters.priority
    if (filters.skills.length > 0) query.skills = filters.skills.join(',')
    if (filters.minBudget) query.minBudget = String(filters.minBudget)
    if (filters.maxBudget) query.maxBudget = String(filters.maxBudget)
    if (pagination.page > 1) query.page = String(pagination.page)
    if (pagination.pageSize !== 12) query.pageSize = String(pagination.pageSize)
    if (sort.field !== 'created_at') query.sortBy = sort.field
    if (sort.order !== 'desc') query.sortOrder = sort.order
    if (viewMode.value !== 'grid') query.view = viewMode.value

    router.replace({ query })
  }

  // Cache Management
  const getCacheKey = (): string => {
    return JSON.stringify({
      ...filters,
      page: pagination.page,
      pageSize: pagination.pageSize,
      sort
    })
  }

  const getCachedData = () => {
    const key = getCacheKey()
    const cached = cache[key]

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached
    }

    return null
  }

  const setCachedData = (data: Task[], total: number) => {
    const key = getCacheKey()
    cache[key] = {
      data,
      total,
      timestamp: Date.now()
    }
  }

  const clearCache = () => {
    Object.keys(cache).forEach(key => delete cache[key])
  }

  // Task Fetching
  const fetchTasks = async (useCache = true) => {
    // Check cache first
    if (useCache) {
      const cached = getCachedData()
      if (cached) {
        tasks.value = cached.data
        pagination.total = cached.total
        return
      }
    }

    loading.value = true
    error.value = null

    try {
      const response: PaginatedResponse<Task> = await taskApi.getTasks({
        ...filters,
        skills: filters.skills.length > 0 ? filters.skills.join(',') : undefined,
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sort.field,
        sort_order: sort.order
      })

      tasks.value = response.data
      pagination.total = response.total

      // Cache the result
      setCachedData(response.data, response.total)

      // Sync to URL
      syncFiltersToURL()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch tasks'
      console.error('Failed to fetch tasks:', err)
    } finally {
      loading.value = false
    }
  }

  // Filter Methods
  const handleSearch = watchDebounced(
    () => filters.search,
    () => {
      pagination.page = 1
      fetchTasks(false)
    },
    { debounce: SEARCH_DEBOUNCE }
  )

  const handleFilterChange = () => {
    pagination.page = 1
    activePreset.value = 'custom'
    fetchTasks(false)
  }

  const resetFilters = () => {
    filters.search = ''
    filters.status = ''
    filters.priority = ''
    filters.skills = []
    filters.minBudget = undefined
    filters.maxBudget = undefined
    pagination.page = 1
    activePreset.value = 'all'
    clearCache()
    fetchTasks(false)
  }

  const toggleSkill = (skill: string) => {
    const index = filters.skills.indexOf(skill)
    if (index > -1) {
      filters.skills.splice(index, 1)
    } else {
      filters.skills.push(skill)
    }
    handleFilterChange()
  }

  const applyPreset = (presetId: string) => {
    const preset = filterPresets.value.find(p => p.id === presetId)
    if (!preset) return

    // Reset filters
    resetFilters()

    // Apply preset filters
    if (preset.filters.status) filters.status = preset.filters.status
    if (preset.filters.priority) filters.priority = preset.filters.priority
    if (preset.filters.skills) filters.skills = [...preset.filters.skills]
    if (preset.filters.minBudget) filters.minBudget = preset.filters.minBudget
    if (preset.filters.maxBudget) filters.maxBudget = preset.filters.maxBudget

    activePreset.value = presetId
    fetchTasks(false)
  }

  // Sorting
  const handleSort = (field: SortOption['field']) => {
    if (sort.field === field) {
      sort.order = sort.order === 'asc' ? 'desc' : 'asc'
    } else {
      sort.field = field
      sort.order = 'desc'
    }
    pagination.page = 1
    fetchTasks(false)
  }

  // Pagination
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages.value) {
      pagination.page = page
      fetchTasks()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const nextPage = () => {
    if (canLoadMore.value) {
      handlePageChange(pagination.page + 1)
    }
  }

  const previousPage = () => {
    if (pagination.page > 1) {
      handlePageChange(pagination.page - 1)
    }
  }

  // Bookmarks
  const loadBookmarks = () => {
    try {
      const bookmarksStr = localStorage.getItem(BOOKMARKS_STORAGE_KEY)
      if (bookmarksStr) {
        const bookmarks = JSON.parse(bookmarksStr)
        bookmarkedTasks.value = new Set(bookmarks)
      }
    } catch (err) {
      console.error('Failed to load bookmarks:', err)
    }
  }

  const saveBookmarks = () => {
    try {
      const bookmarks = Array.from(bookmarkedTasks.value)
      localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(bookmarks))
    } catch (err) {
      console.error('Failed to save bookmarks:', err)
    }
  }

  const toggleBookmark = (taskId: number) => {
    if (bookmarkedTasks.value.has(taskId)) {
      bookmarkedTasks.value.delete(taskId)
    } else {
      bookmarkedTasks.value.add(taskId)
    }
    saveBookmarks()
  }

  const isBookmarked = (taskId: number) => {
    return bookmarkedTasks.value.has(taskId)
  }

  // Task Selection (for batch operations)
  const toggleTaskSelection = (taskId: number) => {
    if (selectedTasks.value.has(taskId)) {
      selectedTasks.value.delete(taskId)
    } else {
      selectedTasks.value.add(taskId)
    }
  }

  const selectAllTasks = () => {
    tasks.value.forEach(task => {
      if (task.id) selectedTasks.value.add(task.id)
    })
  }

  const deselectAllTasks = () => {
    selectedTasks.value.clear()
  }

  // Task Actions
  const applyToTask = async (taskId: number) => {
    try {
      await taskApi.applyToTask(taskId)
      // Refresh task data
      await fetchTasks(false)
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to apply to task'
      console.error('Failed to apply to task:', err)
      return false
    }
  }

  const viewTaskDetail = (taskId: number) => {
    router.push(`/codemart/tasks/${taskId}`)
  }

  // View Mode
  const setViewMode = (mode: ViewMode) => {
    viewMode.value = mode
    syncFiltersToURL()
    savePreferences()
  }

  // Preferences
  const loadPreferences = () => {
    try {
      const prefsStr = localStorage.getItem(PREFERENCES_STORAGE_KEY)
      if (prefsStr) {
        const prefs = JSON.parse(prefsStr)
        if (prefs.viewMode) viewMode.value = prefs.viewMode
        if (prefs.pageSize) pagination.pageSize = prefs.pageSize
      }
    } catch (err) {
      console.error('Failed to load preferences:', err)
    }
  }

  const savePreferences = () => {
    try {
      const prefs = {
        viewMode: viewMode.value,
        pageSize: pagination.pageSize
      }
      localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefs))
    } catch (err) {
      console.error('Failed to save preferences:', err)
    }
  }

  // Lifecycle
  onMounted(() => {
    loadBookmarks()
    loadPreferences()
    syncFiltersFromURL()
    fetchTasks()
  })

  // Watch for route changes
  watch(() => route.query, () => {
    syncFiltersFromURL()
    fetchTasks()
  })

  return {
    // State
    loading,
    error,
    tasks,
    filters,
    pagination,
    sort,
    viewMode,
    selectedTasks,
    bookmarkedTasks,
    filterPresets,
    activePreset,

    // Computed
    totalPages,
    hasActiveFilters,
    filteredTaskCount,
    bookmarkedTasksList,
    selectedTasksList,
    canLoadMore,
    popularSkills,

    // Methods - Fetching
    fetchTasks,
    clearCache,

    // Methods - Filtering
    handleFilterChange,
    resetFilters,
    toggleSkill,
    applyPreset,

    // Methods - Sorting
    handleSort,

    // Methods - Pagination
    handlePageChange,
    nextPage,
    previousPage,

    // Methods - Bookmarks
    toggleBookmark,
    isBookmarked,

    // Methods - Selection
    toggleTaskSelection,
    selectAllTasks,
    deselectAllTasks,

    // Methods - Actions
    applyToTask,
    viewTaskDetail,

    // Methods - View
    setViewMode
  }
}
