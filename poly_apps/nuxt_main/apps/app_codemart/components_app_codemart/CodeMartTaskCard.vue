<!--
  【DEVELOPMENT STANDARDS】
  - NO <style> tags allowed in this component
  - All styles must reference theme variables via class names
  - Theme file: common/styles/theme-base.css
  - Extended theme: apps/app_codemart/styles_app_codemart/theme-codemart.css
-->
<template>
  <div
    class="codemart-card codemart-task-card"
    :class="{
      'codemart-card-urgent': isUrgent,
      'codemart-card-high-priority': isHighPriority,
      'codemart-card-saved': isSaved
    }"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- Quick Actions -->
    <div class="codemart-card-quick-actions">
      <button
        type="button"
        class="codemart-quick-action-btn"
        :class="{ 'active': isSaved }"
        @click.stop="toggleSave"
        :title="isSaved ? 'Unsave task' : 'Save task'"
      >
        {{ isSaved ? '💾' : '📥' }}
      </button>
      <button
        type="button"
        class="codemart-quick-action-btn"
        @click.stop="shareTask"
        title="Share task"
      >
        🔗
      </button>
    </div>

    <!-- Priority Badge -->
    <div v-if="task.priority" class="codemart-priority-badge" :class="`codemart-priority-${task.priority}`">
      {{ priorityIcon }} {{ task.priority }}
    </div>

    <div class="codemart-card-header">
      <div class="codemart-header-main">
        <h4 class="codemart-card-title" :title="task.title">{{ task.title }}</h4>
        <span :class="['codemart-badge', `codemart-badge-${task.status}`]">
          {{ t(`codemart.task.status.${task.status}`) }}
        </span>
      </div>

      <!-- Task Stats -->
      <div class="codemart-task-stats-row">
        <div v-if="task.applicants" class="codemart-stat-chip">
          <span class="codemart-stat-icon">👥</span>
          <span class="codemart-stat-value">{{ task.applicants }} applied</span>
        </div>
        <div v-if="task.viewCount" class="codemart-stat-chip">
          <span class="codemart-stat-icon">👁️</span>
          <span class="codemart-stat-value">{{ task.viewCount }}</span>
        </div>
        <div v-if="estimatedDuration" class="codemart-stat-chip">
          <span class="codemart-stat-icon">⏱️</span>
          <span class="codemart-stat-value">{{ estimatedDuration }}</span>
        </div>
      </div>
    </div>

    <div class="codemart-card-body">
      <!-- Description with expand/collapse -->
      <div class="codemart-card-description-wrapper">
        <p
          class="codemart-card-description"
          :class="{ 'codemart-description-collapsed': !isDescriptionExpanded && isLongDescription }"
        >
          {{ task.description }}
        </p>
        <button
          v-if="isLongDescription"
          type="button"
          class="codemart-expand-btn"
          @click="isDescriptionExpanded = !isDescriptionExpanded"
        >
          {{ isDescriptionExpanded ? t('common.show_less') : t('common.show_more') }}
        </button>
      </div>

      <!-- Urgency Warning Banner -->
      <div v-if="urgencyLevel !== 'normal'" class="codemart-urgency-banner" :class="`codemart-urgency-${urgencyLevel}`">
        <span class="codemart-urgency-icon">{{ urgencyIcon }}</span>
        <span class="codemart-urgency-text">{{ urgencyMessage }}</span>
      </div>

      <!-- Reward & Payment Display -->
      <div class="codemart-card-reward-section">
        <div class="codemart-reward-main">
          <span class="codemart-reward-label">{{ t('codemart.task.reward') }}:</span>
          <span class="codemart-reward-amount" :class="rewardRangeClass">
            ¥{{ formatNumber(task.reward) }}
          </span>
          <span v-if="rewardRangeLabel" class="codemart-reward-badge">
            {{ rewardRangeLabel }}
          </span>
        </div>
        <div v-if="task.paymentVerified" class="codemart-payment-verified">
          <span class="codemart-verified-icon">✓</span>
          <span class="codemart-verified-text">{{ t('codemart.task.payment_verified') }}</span>
        </div>
      </div>

      <!-- Task Requirements & Skills -->
      <div v-if="task.requiredSkills && task.requiredSkills.length > 0" class="codemart-skills-section">
        <div class="codemart-skills-header">
          <span class="codemart-skills-icon">🛠️</span>
          <span class="codemart-skills-label">{{ t('codemart.task.required_skills') }}:</span>
        </div>
        <div class="codemart-skills-tags">
          <span
            v-for="(skill, index) in displayedSkills"
            :key="index"
            class="codemart-skill-tag"
          >
            {{ skill }}
          </span>
          <button
            v-if="task.requiredSkills.length > maxDisplayedSkills && !showAllSkills"
            type="button"
            class="codemart-show-more-skills"
            @click="showAllSkills = true"
          >
            +{{ task.requiredSkills.length - maxDisplayedSkills }} {{ t('common.more') }}
          </button>
        </div>
      </div>

      <!-- Task Complexity Indicator -->
      <div v-if="task.complexity" class="codemart-complexity-indicator">
        <span class="codemart-complexity-icon">{{ complexityIcon }}</span>
        <span class="codemart-complexity-label">{{ t(`codemart.task.complexity.${task.complexity}`) }}</span>
        <div class="codemart-complexity-bar">
          <div
            class="codemart-complexity-fill"
            :class="`codemart-complexity-${task.complexity}`"
            :style="{ width: complexityPercentage }"
          ></div>
        </div>
      </div>

      <!-- Deadline Countdown -->
      <div v-if="task.deadline" class="codemart-deadline-section">
        <div class="codemart-deadline-info">
          <span class="codemart-deadline-icon">⏰</span>
          <span class="codemart-deadline-label">{{ t('codemart.task.deadline') }}:</span>
          <span class="codemart-deadline-date">{{ formatDate(task.deadline) }}</span>
        </div>
        <div v-if="timeRemaining" class="codemart-countdown" :class="countdownClass">
          <span class="codemart-countdown-icon">{{ countdownIcon }}</span>
          <span class="codemart-countdown-text">{{ timeRemaining }}</span>
        </div>
      </div>

      <!-- Task Category & Type -->
      <div class="codemart-task-meta-tags">
        <span v-if="task.category" class="codemart-meta-tag codemart-category-tag">
          {{ t(`codemart.task.category.${task.category}`) }}
        </span>
        <span v-if="task.type" class="codemart-meta-tag codemart-type-tag">
          {{ t(`codemart.task.type.${task.type}`) }}
        </span>
        <span v-if="task.remote" class="codemart-meta-tag codemart-remote-tag">
          🌐 {{ t('codemart.task.remote_ok') }}
        </span>
      </div>

      <!-- Client/Poster Information -->
      <div v-if="task.poster" class="codemart-poster-section">
        <div class="codemart-poster-avatar">
          <img
            v-if="task.poster.avatar"
            :src="task.poster.avatar"
            :alt="task.poster.name"
            class="codemart-avatar-img"
          />
          <div v-else class="codemart-avatar-placeholder">
            {{ posterInitials }}
          </div>
        </div>
        <div class="codemart-poster-info">
          <div class="codemart-poster-name">{{ task.poster.name }}</div>
          <div v-if="task.poster.rating" class="codemart-poster-rating">
            <span class="codemart-rating-stars">{{ ratingStars }}</span>
            <span class="codemart-rating-value">({{ task.poster.rating }})</span>
          </div>
          <div v-if="task.poster.completedTasks" class="codemart-poster-stats">
            {{ task.poster.completedTasks }} {{ t('codemart.task.completed_tasks') }}
          </div>
        </div>
      </div>

      <!-- Assigned Developer (if applicable) -->
      <div v-if="task.assignedTo && task.assignedTo !== 'Unassigned'" class="codemart-assigned-section">
        <span class="codemart-assigned-icon">👨‍💻</span>
        <span class="codemart-assigned-label">{{ t('codemart.task.assigned_to') }}:</span>
        <span class="codemart-assigned-name">{{ task.assignedTo }}</span>
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
import { ref, computed, onMounted } from 'vue';
import type { Task } from '../types_app_codemart';
import { useI18n } from 'vue-i18n';

// ========================================
// Props & Emits
// ========================================
interface Props {
  task: Task;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  save: [task: Task];
  share: [task: Task];
  apply: [task: Task];
  view: [task: Task];
}>();

const { t } = useI18n();

// ========================================
// Local State
// ========================================
const isSaved = ref(false);
const isHovered = ref(false);
const isDescriptionExpanded = ref(false);
const showAllSkills = ref(false);
const maxDisplayedSkills = 5;

// ========================================
// Description & Content
// ========================================
const isLongDescription = computed(() => {
  return props.task.description && props.task.description.length > 150;
});

const displayedSkills = computed(() => {
  if (!props.task.requiredSkills) return [];
  if (showAllSkills.value) return props.task.requiredSkills;
  return props.task.requiredSkills.slice(0, maxDisplayedSkills);
});

// ========================================
// Priority & Urgency
// ========================================
const isHighPriority = computed(() => {
  return props.task.priority === 'high' || props.task.priority === 'urgent';
});

const priorityIcon = computed(() => {
  const icons: Record<string, string> = {
    urgent: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢'
  };
  return icons[props.task.priority as string] || '⚪';
});

const isUrgent = computed(() => {
  if (!props.task.deadline) return false;
  const deadline = new Date(props.task.deadline);
  const now = new Date();
  const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= 3 && diffDays > 0;
});

const urgencyLevel = computed(() => {
  if (!props.task.deadline) return 'normal';
  const deadline = new Date(props.task.deadline);
  const now = new Date();
  const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'expired';
  if (diffDays <= 1) return 'critical';
  if (diffDays <= 3) return 'urgent';
  if (diffDays <= 7) return 'warning';
  return 'normal';
});

const urgencyIcon = computed(() => {
  const icons: Record<string, string> = {
    expired: '⛔',
    critical: '🚨',
    urgent: '⚠️',
    warning: '⏰'
  };
  return icons[urgencyLevel.value] || '';
});

const urgencyMessage = computed(() => {
  const level = urgencyLevel.value;
  if (level === 'expired') return t('codemart.task.urgency.expired');
  if (level === 'critical') return t('codemart.task.urgency.critical');
  if (level === 'urgent') return t('codemart.task.urgency.urgent');
  if (level === 'warning') return t('codemart.task.urgency.warning');
  return '';
});

// ========================================
// Reward & Budget Classification
// ========================================
const rewardRangeLabel = computed(() => {
  const reward = props.task.reward;
  if (reward < 500) return t('codemart.task.reward_range.entry');
  if (reward < 2000) return t('codemart.task.reward_range.basic');
  if (reward < 5000) return t('codemart.task.reward_range.professional');
  if (reward < 10000) return t('codemart.task.reward_range.advanced');
  return t('codemart.task.reward_range.premium');
});

const rewardRangeClass = computed(() => {
  const reward = props.task.reward;
  if (reward < 500) return 'codemart-reward-entry';
  if (reward < 2000) return 'codemart-reward-basic';
  if (reward < 5000) return 'codemart-reward-professional';
  if (reward < 10000) return 'codemart-reward-advanced';
  return 'codemart-reward-premium';
});

// ========================================
// Complexity Indicator
// ========================================
const complexityIcon = computed(() => {
  const icons: Record<string, string> = {
    simple: '🟢',
    medium: '🟡',
    complex: '🟠',
    expert: '🔴'
  };
  return icons[props.task.complexity as string] || '⚪';
});

const complexityPercentage = computed(() => {
  const percentages: Record<string, string> = {
    simple: '25%',
    medium: '50%',
    complex: '75%',
    expert: '100%'
  };
  return percentages[props.task.complexity as string] || '0%';
});

// ========================================
// Deadline & Time Remaining
// ========================================
const timeRemaining = computed(() => {
  if (!props.task.deadline) return '';
  const deadline = new Date(props.task.deadline);
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();

  if (diffMs < 0) return t('codemart.task.deadline_expired');

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffDays > 7) {
    return `${diffDays} ${t('common.days')}`;
  } else if (diffDays > 0) {
    return `${diffDays}${t('common.day_short')} ${diffHours}${t('common.hour_short')} ${t('common.left')}`;
  } else if (diffHours > 0) {
    return `${diffHours}${t('common.hour_short')} ${diffMinutes}${t('common.minute_short')} ${t('common.left')}`;
  } else {
    return `${diffMinutes}${t('common.minute_short')} ${t('common.left')}`;
  }
});

const countdownClass = computed(() => {
  const level = urgencyLevel.value;
  return {
    'codemart-countdown-expired': level === 'expired',
    'codemart-countdown-critical': level === 'critical',
    'codemart-countdown-urgent': level === 'urgent',
    'codemart-countdown-warning': level === 'warning'
  };
});

const countdownIcon = computed(() => {
  const level = urgencyLevel.value;
  if (level === 'expired') return '⛔';
  if (level === 'critical') return '🚨';
  if (level === 'urgent') return '⚠️';
  if (level === 'warning') return '⏰';
  return '⏱️';
});

// ========================================
// Duration Estimation
// ========================================
const estimatedDuration = computed(() => {
  if (props.task.estimatedDuration) {
    return props.task.estimatedDuration;
  }

  // Auto-calculate based on complexity and reward
  const reward = props.task.reward;
  const complexity = props.task.complexity;

  if (complexity === 'simple') {
    return reward < 1000 ? '1-3 days' : '3-5 days';
  } else if (complexity === 'medium') {
    return reward < 3000 ? '1-2 weeks' : '2-3 weeks';
  } else if (complexity === 'complex') {
    return reward < 5000 ? '3-4 weeks' : '1-2 months';
  } else if (complexity === 'expert') {
    return '2-3 months';
  }

  // Default fallback based on reward
  if (reward < 1000) return '1-5 days';
  if (reward < 3000) return '1-2 weeks';
  if (reward < 5000) return '2-4 weeks';
  return '1-3 months';
});

// ========================================
// Poster Information
// ========================================
const posterInitials = computed(() => {
  if (!props.task.poster?.name) return '?';
  const names = props.task.poster.name.split(' ');
  return names.map(n => n[0]).join('').toUpperCase().slice(0, 2);
});

const ratingStars = computed(() => {
  if (!props.task.poster?.rating) return '';
  const rating = props.task.poster.rating;
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;

  let stars = '⭐'.repeat(fullStars);
  if (hasHalfStar && fullStars < 5) stars += '⭐';

  return stars;
});

// ========================================
// Formatting Utilities
// ========================================
const formatNumber = (num: number): string => {
  return num.toLocaleString('zh-CN');
};

const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const formatRelativeTime = (date: string): string => {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return diffMinutes <= 1 ? t('common.just_now') : `${diffMinutes}${t('common.minute_short')} ${t('common.ago')}`;
    }
    return `${diffHours}${t('common.hour_short')} ${t('common.ago')}`;
  } else if (diffDays < 7) {
    return `${diffDays}${t('common.day_short')} ${t('common.ago')}`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} ${t('common.week')} ${t('common.ago')}`;
  }
  return formatDate(date);
};

// ========================================
// Interaction Methods
// ========================================
const toggleSave = () => {
  isSaved.value = !isSaved.value;

  // Save to localStorage
  const savedTasks = JSON.parse(localStorage.getItem('codemart_saved_tasks') || '[]');
  if (isSaved.value) {
    savedTasks.push(props.task.id);
  } else {
    const index = savedTasks.indexOf(props.task.id);
    if (index > -1) savedTasks.splice(index, 1);
  }
  localStorage.setItem('codemart_saved_tasks', JSON.stringify(savedTasks));

  emit('save', props.task);
};

const shareTask = async () => {
  const shareUrl = `${window.location.origin}/tasks/${props.task.id}`;
  const shareText = `${props.task.title} - ${t('codemart.task.reward')}: ¥${formatNumber(props.task.reward)}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: props.task.title,
        text: shareText,
        url: shareUrl
      });
    } catch (err) {
      console.log('Share cancelled or failed:', err);
    }
  } else {
    // Fallback: Copy to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert(t('common.link_copied'));
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  emit('share', props.task);
};

// ========================================
// Lifecycle Hooks
// ========================================
onMounted(() => {
  // Load saved state from localStorage
  const savedTasks = JSON.parse(localStorage.getItem('codemart_saved_tasks') || '[]');
  isSaved.value = savedTasks.includes(props.task.id);

  // Track view (sessionStorage to avoid duplicate counting in same session)
  if (!sessionStorage.getItem(`viewed_task_${props.task.id}`)) {
    sessionStorage.setItem(`viewed_task_${props.task.id}`, 'true');
    // Emit view event for analytics
    emit('view', props.task);
  }
});
</script>

<!-- NO <style> tag - All styles defined in theme files -->
