<!--
  【DEVELOPMENT STANDARDS】
  - NO <style> tags allowed in this component
  - All styles must reference theme variables via class names
  - Theme file: common/styles/theme-base.css
  - Extended theme: apps/app_codemart/styles_app_codemart/theme-codemart.css

  Task Detail Page
-->
<template>
  <div class="codemart-page">
    <div class="codemart-container">
      <div v-if="loading" class="codemart-loading">
        <div class="codemart-spinner"></div>
        <p>{{ t('codemart.common.loading') }}</p>
      </div>

      <div v-else-if="error" class="codemart-error">
        <p>{{ t('codemart.common.error') }}: {{ error }}</p>
        <button
          type="button"
          class="codemart-btn codemart-btn-primary"
          @click="router.back()"
        >
          {{ t('codemart.common.back') }}
        </button>
      </div>

      <div v-else-if="task" class="codemart-task-detail">
        <div class="codemart-task-header">
          <div class="codemart-task-header-main">
            <h1 class="codemart-task-title">{{ task.title }}</h1>
            <div class="codemart-task-meta">
              <span class="codemart-badge" :class="`codemart-badge-${task.status}`">
                {{ t(`codemart.tasks.status.${task.status}`) }}
              </span>
              <span class="codemart-badge" :class="`codemart-badge-${task.priority}`">
                {{ t(`codemart.tasks.priority.${task.priority}`) }}
              </span>
              <span class="codemart-task-meta-item">
                {{ t('codemart.tasks.detail.budget') }}: {{ formatBudget(task.budget_allocation) }}
              </span>
              <span v-if="task.due_date" class="codemart-task-meta-item">
                {{ t('codemart.tasks.detail.dueDate') }}: {{ formatDate(task.due_date) }}
              </span>
            </div>
          </div>

          <div class="codemart-task-header-actions">
            <button
              v-if="!task.assigned_to"
              type="button"
              class="codemart-btn codemart-btn-primary"
              @click="handleApply"
            >
              {{ t('codemart.tasks.detail.applyForTask') }}
            </button>
            <button
              v-else-if="task.assigned_to === currentUserId"
              type="button"
              class="codemart-btn codemart-btn-primary"
              @click="handleStartWork"
            >
              {{ t('codemart.tasks.detail.startWork') }}
            </button>
          </div>
        </div>

        <div class="codemart-task-content">
          <div class="codemart-task-section">
            <h2 class="codemart-section-title">{{ t('codemart.tasks.detail.description') }}</h2>
            <div class="codemart-task-description">
              {{ task.description }}
            </div>
          </div>

          <div v-if="task.deliverables && task.deliverables.length > 0" class="codemart-task-section">
            <h2 class="codemart-section-title">{{ t('codemart.tasks.detail.deliverables') }}</h2>
            <ul class="codemart-deliverables-list">
              <li v-for="(deliverable, index) in task.deliverables" :key="index">
                {{ deliverable }}
              </li>
            </ul>
          </div>

          <div class="codemart-task-section">
            <h2 class="codemart-section-title">{{ t('codemart.tasks.detail.projectInfo') }}</h2>
            <div class="codemart-info-grid">
              <div class="codemart-info-item">
                <span class="codemart-info-label">{{ t('codemart.tasks.detail.milestone') }}:</span>
                <span class="codemart-info-value">{{ task.milestone_id }}</span>
              </div>
              <div class="codemart-info-item">
                <span class="codemart-info-label">{{ t('codemart.tasks.detail.createdAt') }}:</span>
                <span class="codemart-info-value">{{ formatDate(task.created_at) }}</span>
              </div>
              <div v-if="task.assigned_to" class="codemart-info-item">
                <span class="codemart-info-label">{{ t('codemart.tasks.detail.assignedTo') }}:</span>
                <span class="codemart-info-value">{{ task.assigned_to }}</span>
              </div>
            </div>
          </div>

          <div v-if="task.comments && task.comments.length > 0" class="codemart-task-section">
            <h2 class="codemart-section-title">{{ t('codemart.tasks.detail.comments') }}</h2>
            <div class="codemart-comments-list">
              <div
                v-for="comment in task.comments"
                :key="comment.id"
                class="codemart-comment"
              >
                <div class="codemart-comment-header">
                  <span class="codemart-comment-author">{{ comment.user_name }}</span>
                  <span class="codemart-comment-date">{{ formatDate(comment.created_at) }}</span>
                </div>
                <div class="codemart-comment-content">
                  {{ comment.comment }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import taskApi from '~/apps/app_codemart/services_app_codemart/task-api'
import type { Task } from '~/apps/app_codemart/types_app_codemart'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()

definePageMeta({
  layout: 'default-with-nav'
})

const loading = ref(false)
const error = ref<string | null>(null)
const task = ref<Task | null>(null)
const currentUserId = ref<number | null>(null) // TODO: Get from auth store

const taskId = computed(() => parseInt(route.params.id as string))

const fetchTask = async () => {
  loading.value = true
  error.value = null

  try {
    task.value = await taskApi.getTask(taskId.value)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error'
    console.error('Failed to fetch task:', err)
  } finally {
    loading.value = false
  }
}

const formatBudget = (amount: number | undefined) => {
  if (!amount) return 'N/A'
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY'
  }).format(amount)
}

const formatDate = (date: string | undefined) => {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('zh-CN')
}

const handleApply = () => {
  // TODO: Implement apply logic
  router.push(`/codemart/tasks/${taskId.value}/apply`)
}

const handleStartWork = () => {
  // TODO: Implement start work logic
  router.push(`/codemart/tasks/${taskId.value}/workspace`)
}

onMounted(() => {
  fetchTask()
})
</script>

<!-- NO <style> tag - All styles defined in theme files -->
