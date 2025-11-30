<!--
  【DEVELOPMENT STANDARDS】
  - NO <style> tags allowed in this component
  - All styles must reference theme variables via class names
  - Theme file: common/styles/theme-base.css
  - Extended theme: apps/app_codemart/styles_app_codemart/theme-codemart.css
-->
<template>
  <div
    class="codemart-card codemart-developer-card"
    :class="{
      'codemart-card-bookmarked': isBookmarked,
      'codemart-card-online': isOnline,
      'codemart-card-top-rated': isTopRated
    }"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- Quick Actions Menu -->
    <div class="codemart-card-quick-actions">
      <button
        type="button"
        class="codemart-quick-action-btn"
        :class="{ 'active': isBookmarked }"
        @click.stop="toggleBookmark"
        :title="isBookmarked ? t('common.unbookmark') : t('common.bookmark')"
      >
        {{ isBookmarked ? '⭐' : '☆' }}
      </button>
      <button
        type="button"
        class="codemart-quick-action-btn"
        @click.stop="contactDeveloper"
        :title="t('codemart.developer.contact')"
      >
        💬
      </button>
      <button
        type="button"
        class="codemart-quick-action-btn"
        @click.stop="showMoreOptions = !showMoreOptions"
        :title="t('common.more_options')"
      >
        ⋮
      </button>
    </div>

    <!-- Premium Badges Row -->
    <div v-if="premiumBadges.length > 0" class="codemart-premium-badges">
      <span
        v-for="badge in premiumBadges"
        :key="badge.type"
        :class="['codemart-premium-badge', `codemart-badge-${badge.type}`]"
        :title="badge.description"
      >
        {{ badge.icon }} {{ badge.label }}
      </span>
    </div>

    <div class="codemart-developer-header">
      <!-- Enhanced Avatar with Status -->
      <div class="codemart-developer-avatar-wrapper">
        <div class="codemart-developer-avatar" :class="{ 'codemart-avatar-verified': developer.verified }">
          <img v-if="developer.avatar" :src="developer.avatar" :alt="developer.username" />
          <div v-else class="codemart-developer-avatar-placeholder">
            {{ avatarInitials }}
          </div>
          <div v-if="isOnline" class="codemart-online-indicator" :title="t('codemart.developer.online')"></div>
          <div v-if="developer.verified" class="codemart-verified-badge" :title="t('codemart.developer.verified')">
            ✓
          </div>
        </div>
        <div v-if="developerLevel" class="codemart-developer-level-badge" :class="`codemart-level-${developerLevel.level}`">
          {{ developerLevel.icon }} {{ developerLevel.label }}
        </div>
      </div>

      <div class="codemart-developer-info">
        <h4 class="codemart-card-title">
          {{ developer.username }}
          <span v-if="developer.country" class="codemart-country-flag">{{ countryFlag }}</span>
        </h4>
        <div class="codemart-developer-meta">
          <span class="codemart-developer-title">{{ developer.title || t('codemart.developer.title') }}</span>
        </div>
        <div v-if="developer.location" class="codemart-developer-location">
          📍 {{ developer.location }}
          <span v-if="developer.timezone" class="codemart-timezone">
            ({{ developer.timezone }})
          </span>
        </div>
      </div>

      <!-- Rating & Stats Summary -->
      <div class="codemart-developer-ratings">
        <div v-if="developer.rating" class="codemart-rating-main">
          <span class="codemart-rating-value">{{ developer.rating.toFixed(1) }}</span>
          <span class="codemart-rating-stars">{{ ratingStars }}</span>
          <span v-if="developer.totalReviews" class="codemart-rating-count">
            ({{ developer.totalReviews }})
          </span>
        </div>
        <div v-if="successRate" class="codemart-success-rate">
          <span class="codemart-success-icon">✓</span>
          <span class="codemart-success-value">{{ successRate }}%</span>
          <span class="codemart-success-label">{{ t('codemart.developer.success_rate') }}</span>
        </div>
      </div>
    </div>

    <div class="codemart-card-body">
      <!-- Bio with Expand/Collapse -->
      <div v-if="developer.bio" class="codemart-bio-section">
        <p
          class="codemart-card-description"
          :class="{ 'codemart-description-collapsed': !isBioExpanded && isLongBio }"
        >
          {{ developer.bio }}
        </p>
        <button
          v-if="isLongBio"
          type="button"
          class="codemart-expand-btn"
          @click="isBioExpanded = !isBioExpanded"
        >
          {{ isBioExpanded ? t('common.show_less') : t('common.show_more') }}
        </button>
      </div>

      <!-- Availability Status -->
      <div v-if="availabilityStatus" class="codemart-availability-section">
        <div class="codemart-availability-indicator" :class="`codemart-availability-${availabilityStatus.status}`">
          <span class="codemart-availability-icon">{{ availabilityStatus.icon }}</span>
          <span class="codemart-availability-text">{{ availabilityStatus.text }}</span>
        </div>
        <div v-if="developer.availableFrom" class="codemart-available-date">
          {{ t('codemart.developer.available_from') }}: {{ formatDate(developer.availableFrom) }}
        </div>
      </div>

      <!-- Response Time Indicator -->
      <div v-if="developer.avgResponseTime" class="codemart-response-time">
        <span class="codemart-response-icon">⚡</span>
        <span class="codemart-response-label">{{ t('codemart.developer.avg_response') }}:</span>
        <span class="codemart-response-value">{{ formatResponseTime(developer.avgResponseTime) }}</span>
      </div>

      <!-- Enhanced Skills Display with Categories -->
      <div v-if="developer.skills && developer.skills.length > 0" class="codemart-skills-section">
        <div class="codemart-skills-header">
          <span class="codemart-skills-icon">🛠️</span>
          <span class="codemart-skills-title">{{ t('codemart.developer.skills') }}</span>
          <span class="codemart-skills-count">({{ developer.skills.length }})</span>
        </div>
        <div class="codemart-skills">
          <span
            v-for="(skill, index) in displayedSkills"
            :key="index"
            class="codemart-skill-tag"
            :class="{ 'codemart-skill-expert': isExpertSkill(skill) }"
          >
            {{ skill }}
          </span>
          <button
            v-if="developer.skills.length > maxDisplayedSkills && !showAllSkills"
            type="button"
            class="codemart-show-more-skills"
            @click="showAllSkills = true"
          >
            +{{ developer.skills.length - maxDisplayedSkills }} {{ t('common.more') }}
          </button>
        </div>
      </div>

      <!-- Language Proficiency -->
      <div v-if="developer.languages && developer.languages.length > 0" class="codemart-languages-section">
        <span class="codemart-languages-icon">🗣️</span>
        <span class="codemart-languages-label">{{ t('codemart.developer.languages') }}:</span>
        <div class="codemart-languages-list">
          <span
            v-for="lang in developer.languages"
            :key="lang.code"
            class="codemart-language-tag"
          >
            {{ lang.name }} ({{ lang.proficiency }})
          </span>
        </div>
      </div>

      <!-- Certifications -->
      <div v-if="developer.certifications && developer.certifications.length > 0" class="codemart-certifications">
        <div class="codemart-certifications-header">
          <span class="codemart-cert-icon">🎓</span>
          <span class="codemart-cert-title">{{ t('codemart.developer.certifications') }}</span>
        </div>
        <div class="codemart-cert-list">
          <span
            v-for="cert in developer.certifications.slice(0, 3)"
            :key="cert.id"
            class="codemart-cert-badge"
            :title="cert.issuer"
          >
            {{ cert.name }}
          </span>
        </div>
      </div>

      <!-- Comprehensive Stats Grid -->
      <div class="codemart-developer-stats-grid">
        <div class="codemart-stat-item">
          <span class="codemart-stat-icon">📦</span>
          <span class="codemart-stat-value">{{ developer.completedProjects || 0 }}</span>
          <span class="codemart-stat-label">{{ t('codemart.developer.completed_projects') }}</span>
        </div>

        <div class="codemart-stat-item">
          <span class="codemart-stat-icon">💼</span>
          <span class="codemart-stat-value">{{ formatYearsOfExperience(developer.yearsOfExperience) }}</span>
          <span class="codemart-stat-label">{{ t('codemart.developer.experience') }}</span>
        </div>

        <div v-if="developer.onTimeDeliveryRate" class="codemart-stat-item">
          <span class="codemart-stat-icon">⏰</span>
          <span class="codemart-stat-value">{{ developer.onTimeDeliveryRate }}%</span>
          <span class="codemart-stat-label">{{ t('codemart.developer.on_time') }}</span>
        </div>

        <div v-if="developer.repeatClientRate" class="codemart-stat-item">
          <span class="codemart-stat-icon">🔄</span>
          <span class="codemart-stat-value">{{ developer.repeatClientRate }}%</span>
          <span class="codemart-stat-label">{{ t('codemart.developer.repeat_clients') }}</span>
        </div>
      </div>

      <!-- Pricing Information -->
      <div class="codemart-pricing-section">
        <div class="codemart-pricing-header">
          <span class="codemart-pricing-icon">💰</span>
          <span class="codemart-pricing-label">{{ t('codemart.developer.pricing') }}</span>
        </div>
        <div class="codemart-pricing-tiers">
          <div v-if="developer.hourlyRateMin && developer.hourlyRateMax" class="codemart-pricing-tier">
            <span class="codemart-tier-label">{{ t('codemart.developer.hourly_rate') }}:</span>
            <span class="codemart-tier-value codemart-budget">
              ¥{{ formatNumber(developer.hourlyRateMin) }}-{{ formatNumber(developer.hourlyRateMax) }}
            </span>
          </div>
          <div v-if="developer.projectMinBudget" class="codemart-pricing-tier">
            <span class="codemart-tier-label">{{ t('codemart.developer.min_project_budget') }}:</span>
            <span class="codemart-tier-value">
              ¥{{ formatNumber(developer.projectMinBudget) }}
            </span>
          </div>
        </div>
        <div v-if="pricingRangeLabel" class="codemart-pricing-range">
          <span class="codemart-range-badge" :class="`codemart-range-${pricingRangeLabel.toLowerCase()}`">
            {{ pricingRangeLabel }}
          </span>
        </div>
      </div>

      <!-- Portfolio Highlights -->
      <div v-if="developer.featuredProjects && developer.featuredProjects.length > 0" class="codemart-portfolio-highlights">
        <div class="codemart-portfolio-header">
          <span class="codemart-portfolio-icon">⭐</span>
          <span class="codemart-portfolio-title">{{ t('codemart.developer.featured_work') }}</span>
        </div>
        <div class="codemart-portfolio-grid">
          <div
            v-for="project in developer.featuredProjects.slice(0, 3)"
            :key="project.id"
            class="codemart-portfolio-item"
            :title="project.title"
          >
            <div v-if="project.thumbnail" class="codemart-portfolio-thumb">
              <img :src="project.thumbnail" :alt="project.title" />
            </div>
            <div class="codemart-portfolio-info">
              <div class="codemart-portfolio-name">{{ project.title }}</div>
              <div v-if="project.rating" class="codemart-portfolio-rating">
                ⭐ {{ project.rating }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Client Testimonial Preview -->
      <div v-if="latestTestimonial" class="codemart-testimonial-preview">
        <div class="codemart-testimonial-icon">💬</div>
        <div class="codemart-testimonial-content">
          <p class="codemart-testimonial-text">"{{ latestTestimonial.text }}"</p>
          <div class="codemart-testimonial-author">
            - {{ latestTestimonial.clientName }}
            <span v-if="latestTestimonial.rating" class="codemart-testimonial-rating">
              ⭐ {{ latestTestimonial.rating }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="codemart-card-footer">
      <!-- Badge Row -->
      <div class="codemart-developer-badges">
        <span v-if="developer.verified" class="codemart-badge codemart-badge-verified">
          ✓ {{ t('codemart.developer.verified') }}
        </span>
        <span v-if="developer.topRated" class="codemart-badge codemart-badge-top-rated">
          ⭐ {{ t('codemart.developer.top_rated') }}
        </span>
        <span v-if="developer.risingStar" class="codemart-badge codemart-badge-rising">
          🌟 {{ t('codemart.developer.rising_star') }}
        </span>
      </div>

      <!-- Last Active Info -->
      <div v-if="developer.lastActive" class="codemart-last-active">
        {{ t('codemart.developer.last_active') }}: {{ formatRelativeTime(developer.lastActive) }}
      </div>

      <!-- Action Buttons -->
      <div class="codemart-card-actions">
        <slot name="actions" :developer="developer">
          <button class="codemart-btn codemart-btn-primary" @click="$emit('view', developer)">
            {{ t('codemart.developer.view_profile') }}
          </button>
          <button class="codemart-btn codemart-btn-outline" @click="contactDeveloper">
            {{ t('codemart.developer.contact') }}
          </button>
        </slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { Developer } from '../types_app_codemart';
import { useI18n } from 'vue-i18n';

// ========================================
// Props & Emits
// ========================================
interface Props {
  developer: Developer;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  bookmark: [developer: Developer];
  contact: [developer: Developer];
  view: [developer: Developer];
}>();

const { t } = useI18n();

// ========================================
// Local State
// ========================================
const isBookmarked = ref(false);
const isHovered = ref(false);
const isBioExpanded = ref(false);
const showAllSkills = ref(false);
const showMoreOptions = ref(false);
const maxDisplayedSkills = 8;

// ========================================
// Avatar & Display
// ========================================
const avatarInitials = computed(() => {
  const name = props.developer.username || 'U';
  const names = name.split(' ');
  return names.map(n => n[0]).join('').toUpperCase().slice(0, 2);
});

const countryFlag = computed(() => {
  const flagMap: Record<string, string> = {
    CN: '🇨🇳',
    US: '🇺🇸',
    UK: '🇬🇧',
    JP: '🇯🇵',
    KR: '🇰🇷',
    IN: '🇮🇳',
    CA: '🇨🇦',
    AU: '🇦🇺'
  };
  return flagMap[props.developer.country as string] || '🌐';
});

// ========================================
// Bio & Content
// ========================================
const isLongBio = computed(() => {
  return props.developer.bio && props.developer.bio.length > 120;
});

// ========================================
// Online Status
// ========================================
const isOnline = computed(() => {
  if (!props.developer.lastActive) return false;
  const lastActive = new Date(props.developer.lastActive);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastActive.getTime()) / (1000 * 60);
  return diffMinutes < 15; // Online if active within 15 minutes
});

// ========================================
// Rating & Success Metrics
// ========================================
const isTopRated = computed(() => {
  return props.developer.rating && props.developer.rating >= 4.8;
});

const ratingStars = computed(() => {
  if (!props.developer.rating) return '';
  const rating = props.developer.rating;
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;

  let stars = '★'.repeat(fullStars);
  if (hasHalfStar && fullStars < 5) stars += '★';
  stars += '☆'.repeat(5 - Math.ceil(rating));

  return stars;
});

const successRate = computed(() => {
  if (!props.developer.completedProjects || !props.developer.totalProjects) return null;
  return Math.round((props.developer.completedProjects / props.developer.totalProjects) * 100);
});

// ========================================
// Developer Level System
// ========================================
const developerLevel = computed(() => {
  const completed = props.developer.completedProjects || 0;
  const rating = props.developer.rating || 0;
  const years = props.developer.yearsOfExperience || 0;

  if (completed >= 100 && rating >= 4.8 && years >= 5) {
    return { level: 'master', label: t('codemart.level.master'), icon: '👑' };
  } else if (completed >= 50 && rating >= 4.5 && years >= 3) {
    return { level: 'expert', label: t('codemart.level.expert'), icon: '💎' };
  } else if (completed >= 20 && rating >= 4.0 && years >= 2) {
    return { level: 'professional', label: t('codemart.level.professional'), icon: '⭐' };
  } else if (completed >= 5 && rating >= 3.5) {
    return { level: 'intermediate', label: t('codemart.level.intermediate'), icon: '🟢' };
  }
  return { level: 'beginner', label: t('codemart.level.beginner'), icon: '🔵' };
});

// ========================================
// Premium Badges
// ========================================
const premiumBadges = computed(() => {
  const badges: Array<{ type: string; icon: string; label: string; description: string }> = [];

  if (props.developer.topRated) {
    badges.push({
      type: 'top-rated',
      icon: '🏆',
      label: t('codemart.badge.top_rated'),
      description: t('codemart.badge.top_rated_desc')
    });
  }

  if (props.developer.risingStar) {
    badges.push({
      type: 'rising-star',
      icon: '🌟',
      label: t('codemart.badge.rising_star'),
      description: t('codemart.badge.rising_star_desc')
    });
  }

  if (props.developer.certifications && props.developer.certifications.length >= 3) {
    badges.push({
      type: 'certified',
      icon: '🎓',
      label: t('codemart.badge.certified_pro'),
      description: t('codemart.badge.certified_pro_desc')
    });
  }

  return badges.slice(0, 2); // Maximum 2 badges
});

// ========================================
// Availability Status
// ========================================
const availabilityStatus = computed(() => {
  if (!props.developer.availability) return null;

  const statusMap: Record<string, { icon: string; text: string; status: string }> = {
    available: {
      icon: '🟢',
      text: t('codemart.availability.available_now'),
      status: 'available'
    },
    busy: {
      icon: '🟡',
      text: t('codemart.availability.limited'),
      status: 'busy'
    },
    unavailable: {
      icon: '🔴',
      text: t('codemart.availability.unavailable'),
      status: 'unavailable'
    }
  };

  return statusMap[props.developer.availability] || null;
});

// ========================================
// Skills Display
// ========================================
const displayedSkills = computed(() => {
  if (!props.developer.skills) return [];
  if (showAllSkills.value) return props.developer.skills;
  return props.developer.skills.slice(0, maxDisplayedSkills);
});

const isExpertSkill = (skill: string): boolean => {
  return props.developer.expertSkills?.includes(skill) || false;
};

// ========================================
// Pricing Classification
// ========================================
const pricingRangeLabel = computed(() => {
  if (!props.developer.hourlyRateMin && !props.developer.hourlyRateMax) return null;

  const avgRate = ((props.developer.hourlyRateMin || 0) + (props.developer.hourlyRateMax || 0)) / 2;

  if (avgRate < 100) return t('codemart.pricing.budget');
  if (avgRate < 300) return t('codemart.pricing.standard');
  if (avgRate < 500) return t('codemart.pricing.premium');
  return t('codemart.pricing.enterprise');
});

// ========================================
// Testimonials
// ========================================
const latestTestimonial = computed(() => {
  if (!props.developer.testimonials || props.developer.testimonials.length === 0) return null;
  return props.developer.testimonials[0]; // Return most recent
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
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return t('common.just_now');
  if (diffMinutes < 60) return `${diffMinutes}${t('common.minute_short')} ${t('common.ago')}`;
  if (diffHours < 24) return `${diffHours}${t('common.hour_short')} ${t('common.ago')}`;
  if (diffDays < 7) return `${diffDays}${t('common.day_short')} ${t('common.ago')}`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} ${t('common.week')} ${t('common.ago')}`;
  }
  return formatDate(date);
};

const formatYearsOfExperience = (years: number): string => {
  if (!years || years < 1) return t('common.less_than_one_year');
  return years >= 1 ? `${years}${t('common.years')}` : t('common.less_than_one_year');
};

const formatResponseTime = (minutes: number): string => {
  if (minutes < 60) return `~${minutes}${t('common.minute_short')}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `~${hours}${t('common.hour_short')}`;
  const days = Math.floor(hours / 24);
  return `~${days}${t('common.day_short')}`;
};

// ========================================
// Interaction Methods
// ========================================
const toggleBookmark = () => {
  isBookmarked.value = !isBookmarked.value;

  // Save to localStorage
  const bookmarkedDevs = JSON.parse(localStorage.getItem('codemart_bookmarked_developers') || '[]');
  if (isBookmarked.value) {
    bookmarkedDevs.push(props.developer.id);
  } else {
    const index = bookmarkedDevs.indexOf(props.developer.id);
    if (index > -1) bookmarkedDevs.splice(index, 1);
  }
  localStorage.setItem('codemart_bookmarked_developers', JSON.stringify(bookmarkedDevs));

  emit('bookmark', props.developer);
};

const contactDeveloper = () => {
  emit('contact', props.developer);
};

// ========================================
// Lifecycle Hooks
// ========================================
onMounted(() => {
  // Load bookmark state from localStorage
  const bookmarkedDevs = JSON.parse(localStorage.getItem('codemart_bookmarked_developers') || '[]');
  isBookmarked.value = bookmarkedDevs.includes(props.developer.id);

  // Track view (sessionStorage for current session only)
  if (!sessionStorage.getItem(`viewed_developer_${props.developer.id}`)) {
    sessionStorage.setItem(`viewed_developer_${props.developer.id}`, 'true');
    emit('view', props.developer);
  }
});
</script>

<!-- NO <style> tag - All styles defined in theme files -->
