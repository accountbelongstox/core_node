<!--
  【DEVELOPMENT STANDARDS】
  - NO <style> tags allowed in this component
  - All styles must reference theme variables via class names
  - Theme file: common/styles/theme-base.css
  - Extended theme: apps/app_codemart/styles_app_codemart/theme-codemart.css
-->
<template>
  <div
    class="codemart-card codemart-project-card"
    :class="{
      'codemart-card-featured': project.featured,
      'codemart-card-urgent': isUrgent,
      'codemart-card-bookmarked': isBookmarked
    }"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <!-- Quick Actions Menu -->
    <div class="codemart-card-quick-actions">
      <button
        type="button"
        class="codemart-quick-action-btn"
        :class="{ 'active': isBookmarked }"
        @click.stop="toggleBookmark"
        :title="isBookmarked ? 'Remove bookmark' : 'Bookmark project'"
      >
        {{ isBookmarked ? '★' : '☆' }}
      </button>
      <button
        type="button"
        class="codemart-quick-action-btn"
        @click.stop="shareProject"
        title="Share project"
      >
        🔗
      </button>
      <button
        v-if="showMoreMenu"
        type="button"
        class="codemart-quick-action-btn"
        @click.stop="toggleMoreMenu"
        title="More actions"
      >
        ⋮
      </button>
    </div>

    <!-- More Actions Dropdown -->
    <div v-if="isMoreMenuOpen" class="codemart-more-menu">
      <button class="codemart-menu-item" @click.stop="reportProject">
        🚩 Report
      </button>
      <button class="codemart-menu-item" @click.stop="compareProject">
        ⚖️ Compare
      </button>
      <button class="codemart-menu-item" @click.stop="saveForLater">
        💾 Save for later
      </button>
    </div>

    <!-- Featured Badge -->
    <div v-if="project.featured" class="codemart-featured-badge">
      ⭐ Featured
    </div>

    <!-- Urgent Badge -->
    <div v-if="isUrgent" class="codemart-urgent-badge">
      🔥 Urgent
    </div>

    <div class="codemart-card-header">
      <div class="codemart-header-main">
        <h3 class="codemart-card-title" :title="project.title">{{ project.title }}</h3>
        <span :class="['codemart-badge', `codemart-badge-${project.status}`]">
          {{ t(`codemart.project.status.${project.status}`) }}
        </span>
      </div>

      <!-- Project Stats Row -->
      <div class="codemart-project-stats-row">
        <div class="codemart-stat-chip">
          <span class="codemart-stat-icon">👁️</span>
          <span class="codemart-stat-value">{{ project.viewCount || 0 }}</span>
        </div>
        <div class="codemart-stat-chip">
          <span class="codemart-stat-icon">👥</span>
          <span class="codemart-stat-value">{{ project.bidCount || 0 }} bids</span>
        </div>
        <div v-if="averageBidAmount" class="codemart-stat-chip">
          <span class="codemart-stat-icon">💰</span>
          <span class="codemart-stat-value">Avg: {{ averageBidAmount }}</span>
        </div>
      </div>
    </div>

    <div class="codemart-card-body">
      <!-- Description with expand/collapse -->
      <div class="codemart-description-section">
        <p
          class="codemart-card-description"
          :class="{ 'codemart-description-collapsed': !isDescriptionExpanded && project.description.length > 150 }"
        >
          {{ project.description }}
        </p>
        <button
          v-if="project.description.length > 150"
          type="button"
          class="codemart-expand-btn"
          @click.stop="toggleDescription"
        >
          {{ isDescriptionExpanded ? 'Show less' : 'Show more' }}
        </button>
      </div>

      <!-- Budget Section with Visual Indicator -->
      <div class="codemart-budget-section">
        <div class="codemart-meta-item codemart-budget-item">
          <div class="codemart-budget-header">
            <span class="text-tertiary">{{ t('codemart.project.budget') }}:</span>
            <span
              class="codemart-budget"
              :class="budgetRangeClass"
            >
              ¥{{ formatNumber(project.budgetMin) }} - ¥{{ formatNumber(project.budgetMax) }}
            </span>
          </div>
          <!-- Budget Range Indicator -->
          <div class="codemart-budget-indicator">
            <div class="codemart-budget-bar" :style="{ width: budgetPercentage + '%' }"></div>
          </div>
          <div class="codemart-budget-label">
            <span class="codemart-budget-range-label">{{ budgetRangeLabel }}</span>
          </div>
        </div>
      </div>

      <!-- Timeline and Category -->
      <div class="codemart-card-meta">
        <div class="codemart-meta-item codemart-deadline-item">
          <span class="text-tertiary">{{ t('codemart.project.deadline') }}:</span>
          <span class="text-primary" :class="{ 'codemart-deadline-urgent': isUrgent }">
            {{ formatDate(project.deadline) }}
          </span>
          <span v-if="timeRemaining" class="codemart-time-remaining">
            ({{ timeRemaining }})
          </span>
        </div>

        <div v-if="project.category" class="codemart-meta-item">
          <span class="text-tertiary">{{ t('codemart.project.category') }}:</span>
          <span class="codemart-category-badge">{{ project.category }}</span>
        </div>

        <div v-if="project.location" class="codemart-meta-item">
          <span class="text-tertiary">📍 Location:</span>
          <span class="text-primary">{{ project.location }}</span>
        </div>
      </div>

      <!-- Project Complexity Badge -->
      <div v-if="project.complexity" class="codemart-complexity-badge">
        <span class="codemart-complexity-icon">{{ complexityIcon }}</span>
        <span class="codemart-complexity-label">{{ project.complexity }}</span>
      </div>

      <!-- Skills with Show More/Less -->
      <div v-if="project.skills && project.skills.length > 0" class="codemart-skills">
        <div class="codemart-skills-header">
          <span class="codemart-skills-title">Required Skills:</span>
          <span class="codemart-skills-count">({{ project.skills.length }})</span>
        </div>
        <div class="codemart-skills-list">
          <span
            v-for="(skill, index) in displayedSkills"
            :key="skill"
            class="codemart-skill-tag"
            :class="{ 'codemart-skill-highlight': index < 3 }"
          >
            {{ skill }}
          </span>
          <button
            v-if="project.skills.length > skillsDisplayLimit && !showAllSkills"
            type="button"
            class="codemart-skill-more-btn"
            @click.stop="showAllSkills = true"
          >
            +{{ project.skills.length - skillsDisplayLimit }} more
          </button>
        </div>
      </div>

      <!-- Progress Bar (if project is in progress) -->
      <div v-if="project.status === 'in_progress' && project.progress !== undefined" class="codemart-progress-section">
        <div class="codemart-progress-header">
          <span class="codemart-progress-label">Progress</span>
          <span class="codemart-progress-percent">{{ project.progress }}%</span>
        </div>
        <div class="codemart-progress-bar-container">
          <div class="codemart-progress-bar" :style="{ width: project.progress + '%' }"></div>
        </div>
      </div>

      <!-- Additional Info Chips -->
      <div class="codemart-info-chips">
        <div v-if="project.paymentVerified" class="codemart-info-chip codemart-chip-success">
          ✓ Payment Verified
        </div>
        <div v-if="project.remote" class="codemart-info-chip">
          🌐 Remote OK
        </div>
        <div v-if="project.nda" class="codemart-info-chip">
          🔒 NDA Required
        </div>
      </div>
    </div>

    <div class="codemart-card-footer">
      <!-- Client Info with Avatar -->
      <div class="codemart-author-info">
        <div class="codemart-client-avatar">
          <img
            v-if="project.clientAvatar"
            :src="project.clientAvatar"
            :alt="project.clientName"
            class="codemart-avatar-img"
          />
          <div v-else class="codemart-avatar-placeholder">
            {{ (project.clientName || 'A').charAt(0).toUpperCase() }}
          </div>
        </div>
        <div class="codemart-client-details">
          <span class="codemart-client-name">
            {{ project.clientName || t('common.anonymous') }}
            <span v-if="project.clientVerified" class="codemart-verified-badge" title="Verified Client">
              ✓
            </span>
          </span>
          <span class="codemart-post-time">{{ formatRelativeTime(project.createdAt) }}</span>
          <div v-if="project.clientRating" class="codemart-client-rating">
            ⭐ {{ project.clientRating.toFixed(1) }} ({{ project.clientReviews || 0 }} reviews)
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="codemart-card-actions">
        <slot name="actions" :project="project">
          <button
            v-if="canBid"
            class="codemart-btn codemart-btn-primary"
            @click.stop="handleBidClick"
          >
            💼 Place Bid
          </button>
          <button
            v-if="showViewButton"
            class="codemart-btn codemart-btn-outline"
            @click.stop="$emit('view', project)"
          >
            {{ t('common.view_details') }}
          </button>
        </slot>
      </div>
    </div>

    <!-- Hover Details Overlay -->
    <transition name="codemart-fade">
      <div v-if="isHovered && showHoverDetails" class="codemart-hover-details">
        <div class="codemart-hover-stat">
          <span class="codemart-hover-label">Posted:</span>
          <span class="codemart-hover-value">{{ formatDate(project.createdAt) }}</span>
        </div>
        <div class="codemart-hover-stat">
          <span class="codemart-hover-label">Last Activity:</span>
          <span class="codemart-hover-value">{{ formatRelativeTime(project.updatedAt || project.createdAt) }}</span>
        </div>
        <div v-if="project.estimatedDuration" class="codemart-hover-stat">
          <span class="codemart-hover-label">Duration:</span>
          <span class="codemart-hover-value">{{ project.estimatedDuration }}</span>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { Project } from '../types_app_codemart'
import { useI18n } from 'vue-i18n'

interface Props {
  project: Project
  showViewButton?: boolean
  showMoreMenu?: boolean
  showHoverDetails?: boolean
}

interface Emits {
  (e: 'view', project: Project): void
  (e: 'bid', project: Project): void
  (e: 'bookmark', project: Project): void
  (e: 'share', project: Project): void
}

const props = withDefaults(defineProps<Props>(), {
  showViewButton: true,
  showMoreMenu: true,
  showHoverDetails: true
})

const emit = defineEmits<Emits>()
const { t } = useI18n()

// Local State
const isBookmarked = ref(false)
const isHovered = ref(false)
const isMoreMenuOpen = ref(false)
const isDescriptionExpanded = ref(false)
const showAllSkills = ref(false)
const skillsDisplayLimit = 5

// Lifecycle
onMounted(() => {
  // Load bookmark status from localStorage
  const bookmarks = JSON.parse(localStorage.getItem('codemart_bookmarks') || '[]')
  isBookmarked.value = bookmarks.includes(props.project.id)

  // Increment view count (would be API call in production)
  if (!sessionStorage.getItem(`viewed_project_${props.project.id}`)) {
    sessionStorage.setItem(`viewed_project_${props.project.id}`, 'true')
    // Would call API to increment view count
  }
})

onUnmounted(() => {
  // Cleanup if needed
})

// Computed Properties

const isUrgent = computed(() => {
  if (!props.project.deadline) return false
  const deadline = new Date(props.project.deadline)
  const now = new Date()
  const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return diffDays <= 3 && diffDays > 0
})

const canBid = computed(() => {
  return props.project.status === 'open' || props.project.status === 'active'
})

const timeRemaining = computed(() => {
  if (!props.project.deadline) return ''
  const deadline = new Date(props.project.deadline)
  const now = new Date()
  const diffMs = deadline.getTime() - now.getTime()

  if (diffMs < 0) return 'Expired'

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

  if (diffDays > 0) {
    return `${diffDays}d ${diffHours}h left`
  } else if (diffHours > 0) {
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    return `${diffHours}h ${diffMinutes}m left`
  } else {
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    return `${diffMinutes}m left`
  }
})

const budgetRangeClass = computed(() => {
  const budgetAvg = (props.project.budgetMin + props.project.budgetMax) / 2
  if (budgetAvg < 2000) return 'codemart-budget-low'
  if (budgetAvg < 10000) return 'codemart-budget-medium'
  return 'codemart-budget-high'
})

const budgetRangeLabel = computed(() => {
  const budgetAvg = (props.project.budgetMin + props.project.budgetMax) / 2
  if (budgetAvg < 2000) return 'Entry Level'
  if (budgetAvg < 5000) return 'Mid Range'
  if (budgetAvg < 10000) return 'Professional'
  return 'Enterprise'
})

const budgetPercentage = computed(() => {
  const budgetAvg = (props.project.budgetMin + props.project.budgetMax) / 2
  const maxBudget = 50000 // Reference max for percentage calculation
  return Math.min((budgetAvg / maxBudget) * 100, 100)
})

const complexityIcon = computed(() => {
  const complexity = props.project.complexity?.toLowerCase()
  if (complexity === 'simple') return '🟢'
  if (complexity === 'medium') return '🟡'
  if (complexity === 'complex') return '🟠'
  if (complexity === 'enterprise') return '🔴'
  return '⚪'
})

const displayedSkills = computed(() => {
  if (!props.project.skills) return []
  if (showAllSkills.value) {
    return props.project.skills
  }
  return props.project.skills.slice(0, skillsDisplayLimit)
})

const averageBidAmount = computed(() => {
  if (!props.project.bidCount || props.project.bidCount === 0) return null
  // Mock calculation - would come from actual bid data
  const avgBid = (props.project.budgetMin + props.project.budgetMax) / 2
  return `¥${formatNumber(Math.round(avgBid))}`
})

// Methods

const formatNumber = (num: number): string => {
  return num.toLocaleString('zh-CN')
}

const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('zh-CN')
}

const formatRelativeTime = (date: string): string => {
  const now = new Date()
  const past = new Date(date)
  const diffMs = now.getTime() - past.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60))
      return t('common.minutes_ago', { count: diffMinutes })
    }
    return t('common.hours_ago', { count: diffHours })
  } else if (diffDays === 1) {
    return t('common.yesterday')
  } else if (diffDays < 7) {
    return t('common.days_ago', { count: diffDays })
  } else {
    return formatDate(date)
  }
}

const handleMouseEnter = () => {
  isHovered.value = true
}

const handleMouseLeave = () => {
  isHovered.value = false
  isMoreMenuOpen.value = false
}

const toggleBookmark = () => {
  isBookmarked.value = !isBookmarked.value

  // Update localStorage
  const bookmarks = JSON.parse(localStorage.getItem('codemart_bookmarks') || '[]')
  if (isBookmarked.value) {
    bookmarks.push(props.project.id)
  } else {
    const index = bookmarks.indexOf(props.project.id)
    if (index > -1) bookmarks.splice(index, 1)
  }
  localStorage.setItem('codemart_bookmarks', JSON.stringify(bookmarks))

  emit('bookmark', props.project)
}

const shareProject = async () => {
  const shareUrl = `${window.location.origin}/projects/${props.project.id}`

  if (navigator.share) {
    try {
      await navigator.share({
        title: props.project.title,
        text: props.project.description,
        url: shareUrl
      })
    } catch (err) {
      console.log('Share failed:', err)
    }
  } else {
    // Fallback: copy to clipboard
    await navigator.clipboard.writeText(shareUrl)
    alert('Link copied to clipboard!')
  }

  emit('share', props.project)
}

const toggleMoreMenu = () => {
  isMoreMenuOpen.value = !isMoreMenuOpen.value
}

const reportProject = () => {
  alert('Report functionality would be implemented here')
  isMoreMenuOpen.value = false
}

const compareProject = () => {
  alert('Compare functionality would be implemented here')
  isMoreMenuOpen.value = false
}

const saveForLater = () => {
  alert('Save for later functionality would be implemented here')
  isMoreMenuOpen.value = false
}

const toggleDescription = () => {
  isDescriptionExpanded.value = !isDescriptionExpanded.value
}

const handleBidClick = () => {
  emit('bid', props.project)
}
</script>

<!-- NO <style> tag - All styles defined in theme files -->
