<!--
  【DEVELOPMENT STANDARDS】
  - NO <style> tags allowed in this component
  - All styles must reference theme variables via class names
  - Theme file: common/styles/theme-base.css
  - Extended theme: apps/app_codemart/styles_app_codemart/theme-codemart.css

  Task Hall - Browse and filter available development tasks
-->
<template>
  <div class="codemart-page">
    <div class="codemart-container">
      <!-- Page Header -->
      <div class="codemart-page-header">
        <div class="codemart-page-header-main">
          <h1 class="codemart-page-title">{{ t('codemart.tasks.hall.title') }}</h1>
          <p class="codemart-page-description">{{ t('codemart.tasks.hall.description') }}</p>
        </div>
        <div class="codemart-page-header-actions">
          <!-- View Mode Switcher -->
          <div class="codemart-view-mode-switcher">
            <button
              v-for="mode in viewModeOptions"
              :key="mode.value"
              type="button"
              class="codemart-btn codemart-btn-icon"
              :class="{ 'codemart-btn-active': viewMode === mode.value }"
              :title="mode.label"
              @click="handleViewModeChange(mode.value as any)"
            >
              {{ mode.icon }}
            </button>
          </div>

          <!-- Bookmarks Toggle -->
          <button
            type="button"
            class="codemart-btn codemart-btn-outline"
            :class="{ 'codemart-btn-active': showBookmarks }"
            @click="toggleBookmarksView"
          >
            <span class="codemart-icon">⭐</span>
            {{ t('codemart.tasks.bookmarks') }}
            <span v-if="bookmarkedTasksList.length > 0" class="codemart-badge">
              {{ bookmarkedTasksList.length }}
            </span>
          </button>

          <!-- Batch Mode Toggle -->
          <button
            type="button"
            class="codemart-btn codemart-btn-outline"
            :class="{ 'codemart-btn-active': batchMode }"
            @click="toggleBatchMode"
          >
            <span class="codemart-icon">☑</span>
            {{ t('codemart.tasks.batchMode') }}
          </button>

          <!-- Filters Toggle -->
          <button
            type="button"
            class="codemart-btn codemart-btn-outline"
            @click="toggleFiltersPanel"
          >
            <span class="codemart-icon">{{ showFilters ? '▼' : '▶' }}</span>
            {{ t('codemart.tasks.filters') }}
          </button>
        </div>
      </div>

      <!-- Batch Actions Bar -->
      <div v-if="batchMode && hasSelectedTasks" class="codemart-batch-actions">
        <div class="codemart-batch-info">
          <span class="codemart-icon">☑</span>
          {{ t('codemart.tasks.selectedCount', { count: selectedCount }) }}
        </div>
        <div class="codemart-batch-buttons">
          <button
            type="button"
            class="codemart-btn codemart-btn-primary codemart-btn-sm"
            @click="handleBatchApply"
          >
            {{ t('codemart.tasks.batchApply') }}
          </button>
          <button
            type="button"
            class="codemart-btn codemart-btn-outline codemart-btn-sm"
            @click="handleDeselectAll"
          >
            {{ t('codemart.common.deselectAll') }}
          </button>
        </div>
      </div>

      <!-- Filter Presets -->
      <div v-if="showFilters" class="codemart-filter-presets">
        <button
          v-for="preset in filterPresets"
          :key="preset.id"
          type="button"
          class="codemart-preset-btn"
          :class="{ 'codemart-preset-btn-active': activePreset === preset.id }"
          @click="applyPreset(preset.id)"
        >
          {{ preset.name }}
        </button>
      </div>

      <!-- Filters Panel -->
      <div v-if="showFilters" class="codemart-filters">
        <div class="codemart-filter-row">
          <!-- Search Input -->
          <div class="codemart-filter-group codemart-filter-group-wide">
            <div class="codemart-input-with-icon">
              <span class="codemart-input-icon">🔍</span>
              <input
                v-model="filters.search"
                type="text"
                class="codemart-form-input codemart-search-input"
                :placeholder="t('codemart.tasks.hall.search')"
                @input="handleSearch"
              />
              <button
                v-if="filters.search"
                type="button"
                class="codemart-input-clear"
                @click="filters.search = ''; handleFilterChange()"
              >
                ×
              </button>
            </div>
          </div>

          <!-- Status Filter -->
          <div class="codemart-filter-group">
            <label class="codemart-filter-label">{{ t('codemart.tasks.hall.status') }}</label>
            <select
              v-model="filters.status"
              class="codemart-form-select"
              @change="handleFilterChange"
            >
              <option value="">{{ t('codemart.tasks.hall.allStatuses') }}</option>
              <option value="open">{{ t('codemart.tasks.status.open') }}</option>
              <option value="in_progress">{{ t('codemart.tasks.status.inProgress') }}</option>
              <option value="review">{{ t('codemart.tasks.status.review') }}</option>
              <option value="completed">{{ t('codemart.tasks.status.completed') }}</option>
            </select>
          </div>

          <!-- Priority Filter -->
          <div class="codemart-filter-group">
            <label class="codemart-filter-label">{{ t('codemart.tasks.hall.priority') }}</label>
            <select
              v-model="filters.priority"
              class="codemart-form-select"
              @change="handleFilterChange"
            >
              <option value="">{{ t('codemart.tasks.hall.allPriorities') }}</option>
              <option value="low">{{ t('codemart.tasks.priority.low') }}</option>
              <option value="normal">{{ t('codemart.tasks.priority.normal') }}</option>
              <option value="high">{{ t('codemart.tasks.priority.high') }}</option>
              <option value="urgent">{{ t('codemart.tasks.priority.urgent') }}</option>
            </select>
          </div>

          <!-- Sort Dropdown -->
          <div class="codemart-filter-group">
            <label class="codemart-filter-label">{{ t('codemart.tasks.hall.sortBy') }}</label>
            <select
              :value="sort.field"
              class="codemart-form-select"
              @change="handleSortChange(($event.target as HTMLSelectElement).value)"
            >
              <option
                v-for="option in sortOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.icon }} {{ option.label }}
              </option>
            </select>
          </div>

          <!-- Sort Order Toggle -->
          <div class="codemart-filter-group">
            <button
              type="button"
              class="codemart-btn codemart-btn-outline"
              :title="sort.order === 'asc' ? t('codemart.tasks.sort.ascending') : t('codemart.tasks.sort.descending')"
              @click="handleSort(sort.field)"
            >
              {{ sort.order === 'asc' ? '↑' : '↓' }}
            </button>
          </div>

          <!-- Reset Filters -->
          <div class="codemart-filter-group">
            <button
              type="button"
              class="codemart-btn codemart-btn-outline"
              :disabled="!hasActiveFilters"
              @click="resetFilters"
            >
              <span class="codemart-icon">🔄</span>
              {{ t('codemart.common.reset') }}
            </button>
          </div>
        </div>

        <!-- Skill Tags -->
        <div class="codemart-filter-tags">
          <span class="codemart-filter-label">{{ t('codemart.tasks.hall.filterBySkills') }}:</span>
          <div class="codemart-tag-group">
            <button
              v-for="skill in popularSkills"
              :key="skill"
              type="button"
              class="codemart-tag codemart-tag-clickable"
              :class="{ 'codemart-tag-active': filters.skills?.includes(skill) }"
              @click="toggleSkill(skill)"
            >
              {{ skill }}
            </button>
          </div>
        </div>

        <!-- Active Filters Summary -->
        <div v-if="hasActiveFilters" class="codemart-active-filters">
          <span class="codemart-filter-label">{{ t('codemart.tasks.hall.activeFilters') }}:</span>
          <div class="codemart-filter-chips">
            <span v-if="filters.search" class="codemart-filter-chip">
              🔍 {{ filters.search }}
              <button type="button" @click="filters.search = ''; handleFilterChange()">×</button>
            </span>
            <span v-if="filters.status" class="codemart-filter-chip">
              {{ t(`codemart.tasks.status.${filters.status}`) }}
              <button type="button" @click="filters.status = ''; handleFilterChange()">×</button>
            </span>
            <span v-if="filters.priority" class="codemart-filter-chip">
              {{ t(`codemart.tasks.priority.${filters.priority}`) }}
              <button type="button" @click="filters.priority = ''; handleFilterChange()">×</button>
            </span>
            <span
              v-for="skill in filters.skills"
              :key="skill"
              class="codemart-filter-chip"
            >
              {{ skill }}
              <button type="button" @click="toggleSkill(skill)">×</button>
            </span>
          </div>
        </div>
      </div>

      <!-- Results Summary -->
      <div class="codemart-results-summary">
        <div class="codemart-results-count">
          {{ showBookmarks
            ? t('codemart.tasks.bookmarkedCount', { count: bookmarkedTasksList.length })
            : t('codemart.tasks.resultsCount', { count: filteredTaskCount })
          }}
        </div>
        <div v-if="batchMode" class="codemart-batch-select-all">
          <button
            type="button"
            class="codemart-btn codemart-btn-link"
            @click="handleSelectAll"
          >
            {{ t('codemart.common.selectAll') }}
          </button>
        </div>
      </div>

      <div v-if="loading" class="codemart-loading">
        <div class="codemart-spinner"></div>
        <p>{{ t('codemart.common.loading') }}</p>
      </div>

      <div v-else-if="error" class="codemart-error">
        <p>{{ t('codemart.common.error') }}: {{ error }}</p>
        <button
          type="button"
          class="codemart-btn codemart-btn-primary"
          @click="fetchTasks"
        >
          {{ t('codemart.common.retry') }}
        </button>
      </div>

      <div v-else-if="tasks.length === 0" class="codemart-empty">
        <p>{{ t('codemart.tasks.hall.noTasks') }}</p>
      </div>

      <div v-else :class="`codemart-task-${viewMode}`">
        <div
          v-for="task in displayTasks"
          :key="task.id"
          class="codemart-task-item"
          :class="{
            'codemart-task-selected': batchMode && selectedTasks.has(task.id as number),
            'codemart-task-bookmarked': isBookmarked(task.id as number)
          }"
          @click="handleTaskClick(task)"
        >
          <!-- Batch Mode Checkbox -->
          <div v-if="batchMode" class="codemart-task-checkbox">
            <input
              type="checkbox"
              :checked="selectedTasks.has(task.id as number)"
              @click.stop="toggleTaskSelection(task.id as number)"
            />
          </div>

          <!-- Bookmark Icon -->
          <button
            type="button"
            class="codemart-task-bookmark-btn"
            :class="{ 'codemart-task-bookmark-active': isBookmarked(task.id as number) }"
            @click.stop="handleToggleBookmark(task)"
          >
            {{ isBookmarked(task.id as number) ? '⭐' : '☆' }}
          </button>

          <!-- Task Card Content -->
          <CodeMartTaskCard :task="task">
            <template #actions="{ task }">
              <button
                type="button"
                class="codemart-btn codemart-btn-primary codemart-btn-sm"
                @click.stop="handleApplyTask(task)"
              >
                {{ t('codemart.tasks.hall.apply') }}
              </button>
              <button
                type="button"
                class="codemart-btn codemart-btn-outline codemart-btn-sm"
                @click.stop="handleViewTask(task)"
              >
                {{ t('codemart.common.viewDetails') }}
              </button>
            </template>
          </CodeMartTaskCard>
        </div>
      </div>

      <div v-if="pagination.total > pagination.pageSize" class="codemart-pagination">
        <button
          type="button"
          class="codemart-btn codemart-btn-outline"
          :disabled="pagination.page === 1"
          @click="handlePageChange(pagination.page - 1)"
        >
          {{ t('codemart.common.previous') }}
        </button>
        <span class="codemart-pagination-info">
          {{ t('codemart.common.page') }} {{ pagination.page }} / {{ totalPages }}
        </span>
        <button
          type="button"
          class="codemart-btn codemart-btn-outline"
          :disabled="pagination.page >= totalPages"
          @click="handlePageChange(pagination.page + 1)"
        >
          {{ t('codemart.common.next') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useTaskHall } from '~/apps/app_codemart/composables_app_codemart/use-task-hall'
import { useTaskStore } from '~/apps/app_codemart/stores/codemart/task'
import CodeMartTaskCard from '~/apps/app_codemart/components_app_codemart/CodeMartTaskCard.vue'
import type { Task } from '~/apps/app_codemart/types_app_codemart'

const { t } = useI18n()
const router = useRouter()
const taskStore = useTaskStore()

definePageMeta({
  layout: 'default-with-nav'
})

// Use composable for all business logic
const {
  loading,
  error,
  tasks,
  filters,
  pagination,
  sort,
  viewMode,
  selectedTasks,
  filterPresets,
  activePreset,
  totalPages,
  hasActiveFilters,
  filteredTaskCount,
  bookmarkedTasksList,
  canLoadMore,
  popularSkills,
  fetchTasks,
  handleFilterChange,
  resetFilters,
  toggleSkill,
  applyPreset,
  handleSort,
  handlePageChange,
  nextPage,
  previousPage,
  toggleBookmark,
  isBookmarked,
  toggleTaskSelection,
  selectAllTasks,
  deselectAllTasks,
  applyToTask,
  viewTaskDetail,
  setViewMode
} = useTaskHall()

// Local UI state
const showFilters = ref(true)
const showBookmarks = ref(false)
const batchMode = ref(false)

// Computed
const selectedCount = computed(() => selectedTasks.value.size)

const hasSelectedTasks = computed(() => selectedCount.value > 0)

const sortOptions = computed(() => [
  { value: 'created_at', label: t('codemart.tasks.sort.newest'), icon: '🆕' },
  { value: 'budget_allocation', label: t('codemart.tasks.sort.budget'), icon: '💰' },
  { value: 'due_date', label: t('codemart.tasks.sort.deadline'), icon: '⏰' },
  { value: 'priority', label: t('codemart.tasks.sort.priority'), icon: '⭐' }
])

const viewModeOptions = computed(() => [
  { value: 'grid', label: t('codemart.tasks.view.grid'), icon: '▦' },
  { value: 'list', label: t('codemart.tasks.view.list'), icon: '☰' },
  { value: 'compact', label: t('codemart.tasks.view.compact'), icon: '≡' }
])

const displayTasks = computed(() => {
  return showBookmarks.value ? bookmarkedTasksList.value : tasks.value
})

// Methods
const handleSearch = (event: Event) => {
  const target = event.target as HTMLInputElement
  filters.search = target.value
  // handleFilterChange is debounced in composable
}

const handleApplyTask = async (task: Task) => {
  const success = await applyToTask(task.id as number)
  if (success) {
    // Mark as applied in store
    taskStore.markAsApplied(task.id as number)
  }
}

const handleViewTask = (task: Task) => {
  viewTaskDetail(task.id as number)
}

const handleToggleBookmark = (task: Task) => {
  toggleBookmark(task.id as number)
  // Also update store
  taskStore.toggleBookmark(task.id as number)
}

const handleBatchApply = async () => {
  const selectedArray = Array.from(selectedTasks.value)
  for (const taskId of selectedArray) {
    await applyToTask(taskId)
    taskStore.markAsApplied(taskId)
  }
  deselectAllTasks()
  batchMode.value = false
}

const toggleBatchMode = () => {
  batchMode.value = !batchMode.value
  if (!batchMode.value) {
    deselectAllTasks()
  }
}

const handleSelectAll = () => {
  selectAllTasks()
}

const handleDeselectAll = () => {
  deselectAllTasks()
}

const handleTaskClick = (task: Task) => {
  if (batchMode.value) {
    toggleTaskSelection(task.id as number)
  } else {
    handleViewTask(task)
  }
}

const handleSortChange = (field: any) => {
  handleSort(field)
}

const handleViewModeChange = (mode: 'grid' | 'list' | 'compact') => {
  setViewMode(mode)
}

const toggleFiltersPanel = () => {
  showFilters.value = !showFilters.value
}

const toggleBookmarksView = () => {
  showBookmarks.value = !showBookmarks.value
}
</script>

<!-- NO <style> tag - All styles defined in theme files -->
