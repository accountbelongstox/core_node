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
      <div class="codemart-page-header">
        <h1 class="codemart-page-title">{{ t('codemart.tasks.hall.title') }}</h1>
        <p class="codemart-page-description">{{ t('codemart.tasks.hall.description') }}</p>
      </div>

      <div class="codemart-filters">
        <div class="codemart-filter-row">
          <div class="codemart-filter-group">
            <input
              v-model="filters.search"
              type="text"
              class="codemart-form-input codemart-search-input"
              :placeholder="t('codemart.tasks.hall.search')"
              @input="handleSearch"
            />
          </div>

          <div class="codemart-filter-group">
            <select
              v-model="filters.status"
              class="codemart-form-select"
              @change="handleFilterChange"
            >
              <option value="">{{ t('codemart.tasks.hall.allStatuses') }}</option>
              <option value="open">{{ t('codemart.tasks.status.open') }}</option>
              <option value="in_progress">{{ t('codemart.tasks.status.inProgress') }}</option>
              <option value="review">{{ t('codemart.tasks.status.review') }}</option>
            </select>
          </div>

          <div class="codemart-filter-group">
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

          <button
            type="button"
            class="codemart-btn codemart-btn-outline"
            @click="resetFilters"
          >
            {{ t('codemart.common.reset') }}
          </button>
        </div>

        <div class="codemart-filter-tags">
          <span class="codemart-filter-label">{{ t('codemart.tasks.hall.filterBySkills') }}:</span>
          <div class="codemart-tag-group">
            <button
              v-for="skill in popularSkills"
              :key="skill"
              type="button"
              class="codemart-tag codemart-tag-clickable"
              :class="{ 'codemart-tag-active': selectedSkills.includes(skill) }"
              @click="toggleSkill(skill)"
            >
              {{ skill }}
            </button>
          </div>
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

      <div v-else class="codemart-task-grid">
        <CodeMartTaskCard
          v-for="task in tasks"
          :key="task.id"
          :task="task"
        >
          <template #actions="{ task }">
            <button
              type="button"
              class="codemart-btn codemart-btn-primary codemart-btn-sm"
              @click="handleApplyTask(task)"
            >
              {{ t('codemart.tasks.hall.apply') }}
            </button>
            <button
              type="button"
              class="codemart-btn codemart-btn-outline codemart-btn-sm"
              @click="handleViewTask(task)"
            >
              {{ t('codemart.common.viewDetails') }}
            </button>
          </template>
        </CodeMartTaskCard>
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
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import CodeMartTaskCard from '~/apps/app_codemart/components_app_codemart/CodeMartTaskCard.vue'
import taskApi from '~/apps/app_codemart/services_app_codemart/task-api'
import type { Task } from '~/apps/app_codemart/types_app_codemart'

const { t } = useI18n()
const router = useRouter()

definePageMeta({
  layout: 'default-with-nav'
})

const loading = ref(false)
const error = ref<string | null>(null)
const tasks = ref<Task[]>([])

const filters = reactive({
  search: '',
  status: '',
  priority: '',
  assigned_to: undefined as number | undefined
})

const selectedSkills = ref<string[]>([])

const popularSkills = [
  'Vue.js', 'React', 'Node.js', 'Python', 'TypeScript',
  'Java', 'Go', 'Docker', 'Kubernetes', 'AWS'
]

const pagination = reactive({
  page: 1,
  pageSize: 12,
  total: 0
})

const totalPages = computed(() => Math.ceil(pagination.total / pagination.pageSize))

let searchTimeout: NodeJS.Timeout | null = null

const fetchTasks = async () => {
  loading.value = true
  error.value = null

  try {
    const response = await taskApi.getTasks({
      ...filters,
      page: pagination.page,
      page_size: pagination.pageSize
    })

    tasks.value = response.data
    pagination.total = response.total
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error'
    console.error('Failed to fetch tasks:', err)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
  searchTimeout = setTimeout(() => {
    pagination.page = 1
    fetchTasks()
  }, 300)
}

const handleFilterChange = () => {
  pagination.page = 1
  fetchTasks()
}

const resetFilters = () => {
  filters.search = ''
  filters.status = ''
  filters.priority = ''
  selectedSkills.value = []
  pagination.page = 1
  fetchTasks()
}

const toggleSkill = (skill: string) => {
  const index = selectedSkills.value.indexOf(skill)
  if (index > -1) {
    selectedSkills.value.splice(index, 1)
  } else {
    selectedSkills.value.push(skill)
  }
  handleFilterChange()
}

const handlePageChange = (page: number) => {
  pagination.page = page
  fetchTasks()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const handleApplyTask = (task: Task) => {
  // TODO: Implement apply to task logic
  router.push(`/codemart/tasks/${task.id}/apply`)
}

const handleViewTask = (task: Task) => {
  router.push(`/codemart/tasks/${task.id}`)
}

onMounted(() => {
  fetchTasks()
})
</script>

<!-- NO <style> tag - All styles defined in theme files -->
