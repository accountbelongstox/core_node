<!--
  【DEVELOPMENT STANDARDS】
  - NO <style> tags allowed in this component
  - All styles must reference theme variables via class names
  - Theme file: common/styles/theme-base.css
  - Extended theme: apps/app_codemart/styles_app_codemart/theme-codemart.css
-->
<template>
  <div class="codemart-card">
    <div class="codemart-card-header">
      <h3 class="codemart-card-title">{{ project.title }}</h3>
      <span :class="['codemart-badge', `codemart-badge-${project.status}`]">
        {{ t(`codemart.project.status.${project.status}`) }}
      </span>
    </div>

    <div class="codemart-card-body">
      <p class="codemart-card-description">{{ project.description }}</p>

      <div class="codemart-card-meta">
        <div class="codemart-meta-item">
          <span class="text-tertiary">{{ t('codemart.project.budget') }}:</span>
          <span class="codemart-budget">
            ¥{{ formatNumber(project.budgetMin) }} - ¥{{ formatNumber(project.budgetMax) }}
          </span>
        </div>

        <div class="codemart-meta-item">
          <span class="text-tertiary">{{ t('codemart.project.deadline') }}:</span>
          <span class="text-primary">{{ formatDate(project.deadline) }}</span>
        </div>

        <div v-if="project.category" class="codemart-meta-item">
          <span class="text-tertiary">{{ t('codemart.project.category') }}:</span>
          <span class="text-primary">{{ project.category }}</span>
        </div>
      </div>

      <div v-if="project.skills && project.skills.length > 0" class="codemart-skills">
        <span
          v-for="skill in project.skills"
          :key="skill"
          class="codemart-skill-tag"
        >
          {{ skill }}
        </span>
      </div>
    </div>

    <div class="codemart-card-footer">
      <div class="codemart-author-info">
        <span class="text-primary">{{ project.clientName || t('common.anonymous') }}</span>
        <span class="text-tertiary">{{ formatRelativeTime(project.createdAt) }}</span>
      </div>

      <div class="codemart-card-actions">
        <slot name="actions" :project="project">
          <button
            v-if="showViewButton"
            class="codemart-btn codemart-btn-primary"
            @click="$emit('view', project)"
          >
            {{ t('common.view_details') }}
          </button>
        </slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Project } from '../types_app_codemart';
import { useI18n } from 'vue-i18n';

interface Props {
  project: Project;
  showViewButton?: boolean;
}

interface Emits {
  (e: 'view', project: Project): void;
}

const props = withDefaults(defineProps<Props>(), {
  showViewButton: true
});

const emit = defineEmits<Emits>();
const { t } = useI18n();

// Format number with locale
const formatNumber = (num: number): string => {
  return num.toLocaleString('zh-CN');
};

// Format date to readable format
const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('zh-CN');
};

// Format relative time (e.g., "2 hours ago")
const formatRelativeTime = (date: string): string => {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return t('common.minutes_ago', { count: diffMinutes });
    }
    return t('common.hours_ago', { count: diffHours });
  } else if (diffDays === 1) {
    return t('common.yesterday');
  } else if (diffDays < 7) {
    return t('common.days_ago', { count: diffDays });
  } else {
    return formatDate(date);
  }
};
</script>

<!-- NO <style> tag - All styles defined in theme files -->
