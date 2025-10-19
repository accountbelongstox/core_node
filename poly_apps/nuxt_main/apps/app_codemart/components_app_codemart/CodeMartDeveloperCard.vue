<!--
  【DEVELOPMENT STANDARDS】
  - NO <style> tags allowed in this component
  - All styles must reference theme variables via class names
  - Theme file: common/styles/theme-base.css
  - Extended theme: apps/app_codemart/styles_app_codemart/theme-codemart.css
-->
<template>
  <div class="codemart-card codemart-developer-card">
    <div class="codemart-developer-header">
      <div class="codemart-developer-avatar">
        <img v-if="developer.avatar" :src="developer.avatar" :alt="developer.username" />
        <div v-else class="codemart-developer-avatar-placeholder">
          {{ developer.username.charAt(0).toUpperCase() }}
        </div>
      </div>

      <div class="codemart-developer-info">
        <h4 class="codemart-card-title">{{ developer.username }}</h4>
        <div class="codemart-developer-meta">
          <span class="text-tertiary">{{ developer.title || t('codemart.developer.title') }}</span>
        </div>
      </div>

      <div v-if="developer.rating" class="codemart-rating">
        <span class="codemart-rating-value">{{ developer.rating.toFixed(1) }}</span>
        <span class="codemart-rating-star">★</span>
      </div>
    </div>

    <div class="codemart-card-body">
      <p v-if="developer.bio" class="codemart-card-description">{{ developer.bio }}</p>

      <div v-if="developer.skills && developer.skills.length > 0" class="codemart-skills">
        <span
          v-for="skill in developer.skills.slice(0, 5)"
          :key="skill"
          class="codemart-skill-tag"
        >
          {{ skill }}
        </span>
        <span v-if="developer.skills.length > 5" class="text-tertiary">
          +{{ developer.skills.length - 5 }}
        </span>
      </div>

      <div class="codemart-developer-stats">
        <div class="codemart-stat-item">
          <span class="codemart-stat-value">{{ developer.completedProjects || 0 }}</span>
          <span class="codemart-stat-label">{{ t('codemart.developer.completed_projects') }}</span>
        </div>

        <div class="codemart-stat-item">
          <span class="codemart-stat-value">
            {{ formatYearsOfExperience(developer.yearsOfExperience) }}
          </span>
          <span class="codemart-stat-label">{{ t('codemart.developer.experience') }}</span>
        </div>

        <div v-if="developer.hourlyRateMin && developer.hourlyRateMax" class="codemart-stat-item">
          <span class="codemart-stat-value codemart-budget">
            ¥{{ developer.hourlyRateMin }}-{{ developer.hourlyRateMax }}
          </span>
          <span class="codemart-stat-label">{{ t('codemart.developer.hourly_rate') }}</span>
        </div>
      </div>
    </div>

    <div class="codemart-card-footer">
      <div class="codemart-developer-badges">
        <span
          v-if="developer.verified"
          class="codemart-badge codemart-badge-completed"
        >
          {{ t('codemart.developer.verified') }}
        </span>
      </div>

      <div class="codemart-card-actions">
        <slot name="actions" :developer="developer">
          <button class="codemart-btn codemart-btn-outline">
            {{ t('codemart.developer.view_profile') }}
          </button>
        </slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Developer } from '../types_app_codemart';
import { useI18n } from 'vue-i18n';

interface Props {
  developer: Developer;
}

defineProps<Props>();
const { t } = useI18n();

const formatYearsOfExperience = (years: number): string => {
  return years >= 1
    ? `${years}${t('common.years')}`
    : t('common.less_than_one_year');
};
</script>

<!-- NO <style> tag - All styles defined in theme files -->
