<!--
  【DEVELOPMENT STANDARDS】
  - NO <style> tags allowed in this component
  - All styles must reference theme variables via class names
  - Theme file: common/styles/theme-base.css
  - Extended theme: apps/app_codemart/styles_app_codemart/theme-codemart.css
-->
<template>
  <div class="codemart-card codemart-task-card">
    <div class="codemart-card-header">
      <h4 class="codemart-card-title">{{ task.title }}</h4>
      <span :class="['codemart-badge', `codemart-badge-${task.status}`]">
        {{ t(`codemart.task.status.${task.status}`) }}
      </span>
    </div>

    <div class="codemart-card-body">
      <p class="codemart-card-description">{{ task.description }}</p>

      <div class="codemart-card-meta">
        <div class="codemart-meta-item">
          <span class="text-tertiary">{{ t('codemart.task.reward') }}:</span>
          <span class="codemart-budget">¥{{ formatNumber(task.reward) }}</span>
        </div>

        <div v-if="task.deadline" class="codemart-meta-item">
          <span class="text-tertiary">{{ t('codemart.task.deadline') }}:</span>
          <span class="text-primary">{{ formatDate(task.deadline) }}</span>
        </div>

        <div v-if="task.assignedTo" class="codemart-meta-item">
          <span class="text-tertiary">{{ t('codemart.task.developer') }}:</span>
          <span class="text-primary">{{ task.assignedTo }}</span>
        </div>
      </div>
    </div>

    <div class="codemart-card-footer">
      <span class="text-tertiary">{{ formatRelativeTime(task.createdAt) }}</span>

      <div class="codemart-card-actions">
        <slot name="actions" :task="task">
          <button class="codemart-btn codemart-btn-primary">
            {{ t('common.view_details') }}
          </button>
        </slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Task } from '../types_app_codemart';
import { useI18n } from 'vue-i18n';

interface Props {
  task: Task;
}

defineProps<Props>();
const { t } = useI18n();

const formatNumber = (num: number): string => {
  return num.toLocaleString('zh-CN');
};

const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('zh-CN');
};

const formatRelativeTime = (date: string): string => {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    return diffHours === 0
      ? t('common.just_now')
      : t('common.hours_ago', { count: diffHours });
  } else if (diffDays < 7) {
    return t('common.days_ago', { count: diffDays });
  }
  return formatDate(date);
};
</script>

<!-- NO <style> tag - All styles defined in theme files -->
