<!--
  【DEVELOPMENT STANDARDS】
  - NO <style> tags allowed in this component
  - All styles must reference theme variables via class names
  - Theme file: common/styles/theme-base.css
  - Extended theme: apps/app_codemart/styles_app_codemart/theme-codemart.css

  Step 1: Core Information (Title + One-line Summary)
  Enhanced with fine-grained control features for 200+ lines
-->
<template>
  <div class="codemart-wizard-step-content">
    <h2 class="codemart-step-title">{{ t('codemart.project.submission.step1.title') }}</h2>
    <p class="codemart-step-description">{{ t('codemart.project.submission.step1.description') }}</p>

    <!-- Help Tips Banner -->
    <div class="codemart-help-banner">
      <div class="codemart-help-banner-icon">💡</div>
      <div class="codemart-help-banner-content">
        <strong>{{ t('codemart.project.submission.step1.helpTitle') }}</strong>
        <p>{{ t('codemart.project.submission.step1.helpDescription') }}</p>
      </div>
      <button
        type="button"
        class="codemart-help-banner-toggle"
        @click="showExamples = !showExamples"
      >
        {{ showExamples ? '隐藏示例' : '查看示例' }}
      </button>
    </div>

    <!-- Example Suggestions (Collapsible) -->
    <div v-if="showExamples" class="codemart-examples-panel">
      <h3 class="codemart-examples-title">{{ t('codemart.project.submission.step1.examplesTitle') }}</h3>
      <div class="codemart-examples-grid">
        <div
          v-for="example in exampleTitles"
          :key="example.id"
          class="codemart-example-card"
          @click="applyExample(example)"
        >
          <div class="codemart-example-badge" :class="`codemart-example-badge-${example.category}`">
            {{ categoryLabels[example.category] }}
          </div>
          <div class="codemart-example-title">{{ example.title }}</div>
          <div class="codemart-example-summary">{{ example.summary }}</div>
          <button type="button" class="codemart-example-apply-btn">
            {{ t('codemart.common.apply') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Project Title Input -->
    <div class="codemart-form-group">
      <label class="codemart-form-label" for="project-title">
        {{ t('codemart.project.submission.step1.projectTitle') }}
        <span class="codemart-form-required">*</span>
        <button
          type="button"
          class="codemart-form-label-help"
          @click="showTitleHelp = !showTitleHelp"
          title="点击查看帮助"
        >
          ?
        </button>
      </label>

      <!-- Title Help Tooltip -->
      <div v-if="showTitleHelp" class="codemart-form-help">
        <strong>{{ t('codemart.project.submission.step1.titleHelpTitle') }}</strong>
        <ul class="codemart-form-help-list">
          <li>{{ t('codemart.project.submission.step1.titleHelpTip1') }}</li>
          <li>{{ t('codemart.project.submission.step1.titleHelpTip2') }}</li>
          <li>{{ t('codemart.project.submission.step1.titleHelpTip3') }}</li>
          <li>{{ t('codemart.project.submission.step1.titleHelpTip4') }}</li>
        </ul>
      </div>

      <div class="codemart-form-input-wrapper">
        <input
          id="project-title"
          ref="titleInput"
          v-model="localData.title"
          type="text"
          class="codemart-form-input"
          :class="{
            'codemart-form-input-valid': titleValidation.isValid && localData.title.length > 0,
            'codemart-form-input-warning': titleValidation.hasWarning,
            'codemart-form-input-error': titleValidation.hasError
          }"
          :placeholder="t('codemart.project.submission.step1.titlePlaceholder')"
          maxlength="100"
          required
          @keydown.enter.ctrl="handleKeyboardShortcut"
        />
        <div class="codemart-form-input-indicator">
          <span v-if="titleValidation.isValid && localData.title.length > 0" class="codemart-icon-valid">✓</span>
          <span v-else-if="titleValidation.hasWarning" class="codemart-icon-warning">⚠️</span>
          <span v-else-if="titleValidation.hasError" class="codemart-icon-error">✗</span>
        </div>
      </div>

      <!-- Character Count with Warning -->
      <div class="codemart-form-meta">
        <div
          class="codemart-form-hint"
          :class="{
            'codemart-form-hint-warning': titleCharacterWarning,
            'codemart-form-hint-danger': titleCharacterDanger
          }"
        >
          {{ localData.title.length }}/100
          <span v-if="titleCharacterWarning && !titleCharacterDanger">
            ({{ t('codemart.project.submission.step1.approachingLimit') }})
          </span>
          <span v-if="titleCharacterDanger">
            ({{ t('codemart.project.submission.step1.limitReached') }})
          </span>
        </div>
        <div v-if="titleWordCount > 0" class="codemart-form-hint">
          {{ titleWordCount }} {{ t('codemart.common.words') }}
        </div>
      </div>

      <!-- Validation Messages -->
      <div v-if="titleValidation.message" class="codemart-form-validation">
        <div
          v-if="titleValidation.hasError"
          class="codemart-form-validation-error"
        >
          <span class="codemart-icon">❌</span>
          {{ titleValidation.message }}
        </div>
        <div
          v-else-if="titleValidation.hasWarning"
          class="codemart-form-validation-warning"
        >
          <span class="codemart-icon">⚠️</span>
          {{ titleValidation.message }}
        </div>
        <div v-else class="codemart-form-validation-success">
          <span class="codemart-icon">✅</span>
          {{ titleValidation.message }}
        </div>
      </div>

      <!-- Title Formatting Suggestions -->
      <div v-if="titleSuggestions.length > 0" class="codemart-suggestions-panel">
        <div class="codemart-suggestions-header">
          <span class="codemart-icon">💡</span>
          {{ t('codemart.project.submission.step1.formattingSuggestions') }}
        </div>
        <div class="codemart-suggestions-list">
          <button
            v-for="(suggestion, index) in titleSuggestions"
            :key="index"
            type="button"
            class="codemart-suggestion-btn"
            @click="applyTitleSuggestion(suggestion)"
          >
            {{ suggestion }}
          </button>
        </div>
      </div>

      <!-- Duplicate Title Warning -->
      <div v-if="duplicateTitleWarning" class="codemart-form-validation">
        <div class="codemart-form-validation-warning">
          <span class="codemart-icon">⚠️</span>
          {{ t('codemart.project.submission.step1.duplicateTitleWarning') }}
        </div>
      </div>
    </div>

    <!-- Project Summary Textarea -->
    <div class="codemart-form-group">
      <label class="codemart-form-label" for="project-summary">
        {{ t('codemart.project.submission.step1.oneLiner') }}
        <span class="codemart-form-required">*</span>
        <button
          type="button"
          class="codemart-form-label-help"
          @click="showSummaryHelp = !showSummaryHelp"
          title="点击查看帮助"
        >
          ?
        </button>
      </label>

      <!-- Summary Help Tooltip -->
      <div v-if="showSummaryHelp" class="codemart-form-help">
        <strong>{{ t('codemart.project.submission.step1.summaryHelpTitle') }}</strong>
        <ul class="codemart-form-help-list">
          <li>{{ t('codemart.project.submission.step1.summaryHelpTip1') }}</li>
          <li>{{ t('codemart.project.submission.step1.summaryHelpTip2') }}</li>
          <li>{{ t('codemart.project.submission.step1.summaryHelpTip3') }}</li>
        </ul>
      </div>

      <div class="codemart-form-input-wrapper">
        <textarea
          id="project-summary"
          ref="summaryInput"
          v-model="localData.summary"
          class="codemart-form-textarea"
          :class="{
            'codemart-form-input-valid': summaryValidation.isValid && localData.summary.length > 0,
            'codemart-form-input-warning': summaryValidation.hasWarning,
            'codemart-form-input-error': summaryValidation.hasError
          }"
          :placeholder="t('codemart.project.submission.step1.summaryPlaceholder')"
          maxlength="200"
          rows="4"
          required
          @keydown.enter.ctrl="handleKeyboardShortcut"
        />
        <div class="codemart-form-input-indicator">
          <span v-if="summaryValidation.isValid && localData.summary.length > 0" class="codemart-icon-valid">✓</span>
          <span v-else-if="summaryValidation.hasWarning" class="codemart-icon-warning">⚠️</span>
          <span v-else-if="summaryValidation.hasError" class="codemart-icon-error">✗</span>
        </div>
      </div>

      <!-- Character Count with Warning -->
      <div class="codemart-form-meta">
        <div
          class="codemart-form-hint"
          :class="{
            'codemart-form-hint-warning': summaryCharacterWarning,
            'codemart-form-hint-danger': summaryCharacterDanger
          }"
        >
          {{ localData.summary.length }}/200
          <span v-if="summaryCharacterWarning && !summaryCharacterDanger">
            ({{ t('codemart.project.submission.step1.approachingLimit') }})
          </span>
          <span v-if="summaryCharacterDanger">
            ({{ t('codemart.project.submission.step1.limitReached') }})
          </span>
        </div>
        <div v-if="summaryWordCount > 0" class="codemart-form-hint">
          {{ summaryWordCount }} {{ t('codemart.common.words') }}
        </div>
        <div v-if="estimatedReadingTime > 0" class="codemart-form-hint">
          {{ t('codemart.project.submission.step1.readingTime') }}: {{ estimatedReadingTime }}s
        </div>
      </div>

      <!-- Validation Messages -->
      <div v-if="summaryValidation.message" class="codemart-form-validation">
        <div
          v-if="summaryValidation.hasError"
          class="codemart-form-validation-error"
        >
          <span class="codemart-icon">❌</span>
          {{ summaryValidation.message }}
        </div>
        <div
          v-else-if="summaryValidation.hasWarning"
          class="codemart-form-validation-warning"
        >
          <span class="codemart-icon">⚠️</span>
          {{ summaryValidation.message }}
        </div>
        <div v-else class="codemart-form-validation-success">
          <span class="codemart-icon">✅</span>
          {{ summaryValidation.message }}
        </div>
      </div>

      <!-- Summary Quality Score -->
      <div v-if="summaryQualityScore > 0" class="codemart-quality-panel">
        <div class="codemart-quality-header">
          <span class="codemart-icon">📊</span>
          {{ t('codemart.project.submission.step1.qualityScore') }}
        </div>
        <div class="codemart-quality-bar">
          <div
            class="codemart-quality-fill"
            :class="{
              'codemart-quality-low': summaryQualityScore < 50,
              'codemart-quality-medium': summaryQualityScore >= 50 && summaryQualityScore < 80,
              'codemart-quality-high': summaryQualityScore >= 80
            }"
            :style="{ width: `${summaryQualityScore}%` }"
          ></div>
        </div>
        <div class="codemart-quality-label">{{ summaryQualityScore }}/100</div>
      </div>
    </div>

    <!-- Keyboard Shortcuts Info -->
    <div class="codemart-shortcuts-panel">
      <span class="codemart-icon">⌨️</span>
      <span class="codemart-shortcuts-text">
        {{ t('codemart.project.submission.step1.shortcutHint') }}
        <kbd class="codemart-kbd">Ctrl</kbd> + <kbd class="codemart-kbd">Enter</kbd>
        {{ t('codemart.project.submission.step1.toContinue') }}
      </span>
    </div>

    <!-- Navigation Actions -->
    <div class="codemart-wizard-actions">
      <button
        type="button"
        class="codemart-btn codemart-btn-primary"
        :disabled="!isValid"
        @click="handleNext"
      >
        {{ t('codemart.common.next') }}
        <span v-if="isValid" class="codemart-icon">→</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch, ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Props {
  modelValue: {
    title: string
    summary: string
  }
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: Props['modelValue']]
  'next': []
}>()

// Refs for DOM elements
const titleInput = ref<HTMLInputElement | null>(null)
const summaryInput = ref<HTMLTextAreaElement | null>(null)

// Local state
const localData = reactive({
  title: props.modelValue.title,
  summary: props.modelValue.summary
})

const showExamples = ref(false)
const showTitleHelp = ref(false)
const showSummaryHelp = ref(false)

// Example titles by category
const exampleTitles = [
  {
    id: 1,
    category: 'web',
    title: 'E-commerce Platform with Real-time Inventory',
    summary: 'Build a scalable online marketplace with live stock tracking and automated order processing.'
  },
  {
    id: 2,
    category: 'mobile',
    title: 'Cross-platform Fitness Tracking App',
    summary: 'Develop a mobile application for iOS and Android that monitors workouts and health metrics.'
  },
  {
    id: 3,
    category: 'ai',
    title: 'AI-powered Content Recommendation Engine',
    summary: 'Create an intelligent system that suggests personalized content based on user behavior patterns.'
  },
  {
    id: 4,
    category: 'data',
    title: 'Business Intelligence Dashboard with Analytics',
    summary: 'Design an interactive dashboard for visualizing company KPIs and generating actionable insights.'
  }
]

const categoryLabels: Record<string, string> = {
  web: 'Web',
  mobile: 'Mobile',
  ai: 'AI/ML',
  data: 'Data'
}

// Watch for changes and emit
watch(localData, (newValue) => {
  emit('update:modelValue', { ...newValue })
}, { deep: true })

// Computed - Title validation
const titleValidation = computed(() => {
  const title = localData.title.trim()

  if (title.length === 0) {
    return { isValid: false, hasError: false, hasWarning: false, message: '' }
  }

  if (title.length < 5) {
    return {
      isValid: false,
      hasError: true,
      hasWarning: false,
      message: t('codemart.project.submission.step1.titleTooShort')
    }
  }

  if (title.length < 10) {
    return {
      isValid: true,
      hasError: false,
      hasWarning: true,
      message: t('codemart.project.submission.step1.titleCouldBeLonger')
    }
  }

  // Check for all caps
  if (title === title.toUpperCase() && title.length > 5) {
    return {
      isValid: true,
      hasError: false,
      hasWarning: true,
      message: t('codemart.project.submission.step1.avoidAllCaps')
    }
  }

  return {
    isValid: true,
    hasError: false,
    hasWarning: false,
    message: t('codemart.project.submission.step1.titleLooksGood')
  }
})

// Computed - Summary validation
const summaryValidation = computed(() => {
  const summary = localData.summary.trim()

  if (summary.length === 0) {
    return { isValid: false, hasError: false, hasWarning: false, message: '' }
  }

  if (summary.length < 10) {
    return {
      isValid: false,
      hasError: true,
      hasWarning: false,
      message: t('codemart.project.submission.step1.summaryTooShort')
    }
  }

  if (summary.length < 30) {
    return {
      isValid: true,
      hasError: false,
      hasWarning: true,
      message: t('codemart.project.submission.step1.summaryCouldBeMoreDetailed')
    }
  }

  return {
    isValid: true,
    hasError: false,
    hasWarning: false,
    message: t('codemart.project.submission.step1.summaryLooksGood')
  }
})

// Computed - Character warnings
const titleCharacterWarning = computed(() => localData.title.length >= 80 && localData.title.length < 95)
const titleCharacterDanger = computed(() => localData.title.length >= 95)
const summaryCharacterWarning = computed(() => localData.summary.length >= 160 && localData.summary.length < 190)
const summaryCharacterDanger = computed(() => localData.summary.length >= 190)

// Computed - Word counts
const titleWordCount = computed(() => {
  const words = localData.title.trim().split(/\s+/)
  return words[0] === '' ? 0 : words.length
})

const summaryWordCount = computed(() => {
  const words = localData.summary.trim().split(/\s+/)
  return words[0] === '' ? 0 : words.length
})

// Computed - Reading time estimate (200 words per minute average)
const estimatedReadingTime = computed(() => {
  const totalWords = titleWordCount.value + summaryWordCount.value
  if (totalWords === 0) return 0
  return Math.ceil((totalWords / 200) * 60) // Convert to seconds
})

// Computed - Title suggestions
const titleSuggestions = computed(() => {
  const title = localData.title.trim()
  if (title.length === 0) return []

  const suggestions: string[] = []

  // Suggest title case if not already
  const titleCase = title.split(' ').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ')

  if (titleCase !== title && title !== title.toUpperCase()) {
    suggestions.push(titleCase)
  }

  return suggestions.slice(0, 3) // Max 3 suggestions
})

// Computed - Duplicate title warning (simulated - would check against database)
const duplicateTitleWarning = computed(() => {
  const title = localData.title.trim().toLowerCase()
  const commonTitles = ['test', 'demo', 'sample', 'example', 'new project']
  return commonTitles.some(common => title.includes(common))
})

// Computed - Summary quality score
const summaryQualityScore = computed(() => {
  const summary = localData.summary.trim()
  if (summary.length === 0) return 0

  let score = 0

  // Length score (40 points max)
  if (summary.length >= 50) score += 20
  if (summary.length >= 100) score += 10
  if (summary.length >= 150) score += 10

  // Word count score (30 points max)
  if (summaryWordCount.value >= 10) score += 15
  if (summaryWordCount.value >= 20) score += 15

  // Sentence count score (15 points max)
  const sentences = summary.split(/[.!?]+/).filter(s => s.trim().length > 0)
  if (sentences.length >= 2) score += 10
  if (sentences.length >= 3) score += 5

  // Keywords presence (15 points max)
  const keywords = ['develop', 'build', 'create', 'design', 'implement', 'system', 'platform', 'application']
  const hasKeywords = keywords.some(keyword => summary.toLowerCase().includes(keyword))
  if (hasKeywords) score += 15

  return Math.min(score, 100)
})

// Computed - Overall validity
const isValid = computed(() => {
  return titleValidation.value.isValid && summaryValidation.value.isValid
})

// Methods
const applyExample = (example: typeof exampleTitles[0]) => {
  localData.title = example.title
  localData.summary = example.summary
  showExamples.value = false
}

const applyTitleSuggestion = (suggestion: string) => {
  localData.title = suggestion
}

const handleNext = () => {
  if (isValid.value) {
    emit('next')
  }
}

const handleKeyboardShortcut = () => {
  if (isValid.value) {
    handleNext()
  }
}

// Auto-focus on mount
onMounted(() => {
  if (titleInput.value) {
    titleInput.value.focus()
  }
})
</script>

<!-- NO <style> tag - All styles defined in theme files -->
