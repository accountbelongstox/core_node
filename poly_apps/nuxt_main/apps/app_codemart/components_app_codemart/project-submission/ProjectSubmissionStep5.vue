<!--
  【DEVELOPMENT STANDARDS】
  - NO <style> tags allowed in this component
  - All styles must reference theme variables via class names
  - Theme file: common/styles/theme-base.css
  - Extended theme: apps/app_codemart/styles_app_codemart/theme-codemart.css

  Step 5: Budget & Timeline
-->
<template>
  <div class="codemart-wizard-step-content">
    <!-- Header with Help Toggle -->
    <div class="codemart-step-header">
      <div>
        <h2 class="codemart-step-title">{{ t('codemart.project.submission.step5.title') }}</h2>
        <p class="codemart-step-description">{{ t('codemart.project.submission.step5.description') }}</p>
      </div>
      <button
        type="button"
        class="codemart-help-toggle"
        @click="showHelp = !showHelp"
      >
        {{ showHelp ? '✕' : '?' }}
      </button>
    </div>

    <!-- Help Tips Panel -->
    <div v-if="showHelp" class="codemart-help-panel">
      <h3 class="codemart-help-title">💡 {{ t('codemart.project.submission.step5.helpTitle') }}</h3>
      <div class="codemart-help-content">
        <div class="codemart-help-section">
          <h4>📊 Budget Guidelines</h4>
          <ul>
            <li><strong>Simple Projects:</strong> $500 - $2,000 (Basic features, 1-2 weeks)</li>
            <li><strong>Medium Projects:</strong> $2,000 - $8,000 (Multiple features, 2-4 weeks)</li>
            <li><strong>Complex Projects:</strong> $8,000 - $20,000 (Advanced features, 1-3 months)</li>
            <li><strong>Enterprise Projects:</strong> $20,000+ (Full system, 3+ months)</li>
          </ul>
        </div>
        <div class="codemart-help-section">
          <h4>⏰ Timeline Tips</h4>
          <p>• Allow buffer time for revisions and testing</p>
          <p>• Complex features take longer than expected</p>
          <p>• Communication and planning add 20% more time</p>
        </div>
      </div>
    </div>

    <!-- Real-time Statistics Banner -->
    <div class="codemart-stats-banner">
      <div class="codemart-stat-item">
        <span class="codemart-stat-label">Completeness</span>
        <div class="codemart-stat-value">
          <div class="codemart-progress-bar">
            <div
              class="codemart-progress-fill"
              :style="{ width: completenessScore + '%' }"
              :class="{
                'codemart-progress-warning': completenessScore < 50,
                'codemart-progress-success': completenessScore >= 80
              }"
            ></div>
          </div>
          <span class="codemart-stat-number">{{ completenessScore }}%</span>
        </div>
      </div>
      <div class="codemart-stat-item">
        <span class="codemart-stat-label">Tech Stack</span>
        <span class="codemart-stat-number">{{ totalTechCount }} items</span>
      </div>
      <div class="codemart-stat-item">
        <span class="codemart-stat-label">Estimated Duration</span>
        <span class="codemart-stat-number">{{ estimatedDuration }}</span>
      </div>
    </div>

    <!-- Complexity Section with Details -->
    <div class="codemart-form-section">
      <h3 class="codemart-section-title">📊 Project Complexity</h3>

      <div class="codemart-complexity-grid">
        <div
          v-for="complexity in complexityOptions"
          :key="complexity.value"
          :class="[
            'codemart-complexity-card',
            { 'selected': localData.complexity === complexity.value }
          ]"
          @click="localData.complexity = complexity.value"
        >
          <div class="codemart-complexity-icon">{{ complexity.icon }}</div>
          <h4 class="codemart-complexity-name">{{ complexity.name }}</h4>
          <p class="codemart-complexity-desc">{{ complexity.description }}</p>
          <div class="codemart-complexity-meta">
            <span class="codemart-complexity-time">⏱️ {{ complexity.timeRange }}</span>
            <span class="codemart-complexity-budget">💰 {{ complexity.budgetRange }}</span>
          </div>
          <div class="codemart-complexity-features">
            <span v-for="feature in complexity.features" :key="feature" class="codemart-feature-tag">
              {{ feature }}
            </span>
          </div>
        </div>
      </div>

      <!-- Complexity Explanation -->
      <div v-if="selectedComplexity" class="codemart-complexity-detail">
        <h4>{{ selectedComplexity.icon }} {{ selectedComplexity.name }} Details</h4>
        <p>{{ selectedComplexity.fullDescription }}</p>
      </div>
    </div>

    <!-- Budget Configuration Section -->
    <div class="codemart-form-section">
      <h3 class="codemart-section-title">💰 Budget & Payment</h3>

      <div class="codemart-form-row">
        <div class="codemart-form-group">
          <label class="codemart-form-label" for="budget-type">
            {{ t('codemart.project.submission.step5.budgetType') }}
            <span class="codemart-form-required">*</span>
            <span class="codemart-help-icon" title="Choose how you want to pay developers">ℹ️</span>
          </label>
          <select
            id="budget-type"
            v-model="localData.budgetType"
            class="codemart-form-select"
            required
          >
            <option value="fixed">{{ t('codemart.project.budgetType.fixed') }} - Best for defined scope</option>
            <option value="hourly">{{ t('codemart.project.budgetType.hourly') }} - Best for ongoing work</option>
          </select>
          <p class="codemart-field-hint">
            {{ budgetTypeHint }}
          </p>
        </div>
      </div>

      <div class="codemart-form-row">
        <div class="codemart-form-group">
          <label class="codemart-form-label" for="project-budget">
            {{ t('codemart.project.submission.step5.budget') }}
            <span class="codemart-form-required">*</span>
          </label>
          <div class="codemart-input-group">
            <input
              id="project-budget"
              v-model.number="localData.budget"
              type="number"
              class="codemart-form-input"
              :class="{
                'codemart-input-warning': budgetValidation.hasWarning,
                'codemart-input-error': budgetValidation.hasError
              }"
              min="0"
              step="100"
              required
              @input="validateBudget"
            />
            <select v-model="localData.currency" class="codemart-form-select codemart-input-addon">
              <option value="CNY">CNY (¥)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="JPY">JPY (¥)</option>
            </select>
          </div>

          <!-- Budget Validation Message -->
          <div v-if="budgetValidation.message" class="codemart-validation-message">
            <span v-if="budgetValidation.hasError" class="codemart-error">✗</span>
            <span v-else-if="budgetValidation.hasWarning" class="codemart-warning">⚠️</span>
            <span v-else class="codemart-success">✓</span>
            {{ budgetValidation.message }}
          </div>

          <!-- Currency Conversion Display -->
          <div v-if="localData.budget > 0 && localData.currency !== 'USD'" class="codemart-currency-conversion">
            <span class="codemart-conversion-label">≈ {{ convertedBudgetUSD }}</span>
            <span class="codemart-conversion-note">(Estimated USD equivalent)</span>
          </div>

          <!-- Budget Range Suggestion -->
          <div v-if="budgetSuggestion" class="codemart-budget-suggestion">
            <strong>💡 Suggestion:</strong> {{ budgetSuggestion }}
          </div>
        </div>
      </div>

      <!-- Budget Calculator -->
      <div class="codemart-budget-calculator">
        <button
          type="button"
          class="codemart-calculator-toggle"
          @click="showCalculator = !showCalculator"
        >
          🧮 {{ showCalculator ? 'Hide' : 'Show' }} Budget Calculator
        </button>

        <div v-if="showCalculator" class="codemart-calculator-content">
          <h4>Estimate Your Budget</h4>
          <div class="codemart-calculator-row">
            <label>Estimated Hours:</label>
            <input
              v-model.number="calculator.hours"
              type="number"
              min="0"
              class="codemart-calculator-input"
              @input="calculateBudget"
            />
          </div>
          <div class="codemart-calculator-row">
            <label>Hourly Rate ($):</label>
            <input
              v-model.number="calculator.hourlyRate"
              type="number"
              min="0"
              class="codemart-calculator-input"
              @input="calculateBudget"
            />
          </div>
          <div class="codemart-calculator-row">
            <label>Additional Costs:</label>
            <input
              v-model.number="calculator.additionalCosts"
              type="number"
              min="0"
              class="codemart-calculator-input"
              @input="calculateBudget"
            />
          </div>
          <div class="codemart-calculator-result">
            <strong>Estimated Total:</strong>
            <span class="codemart-calculator-total">{{ calculatedBudget }}</span>
          </div>
          <button
            type="button"
            class="codemart-btn codemart-btn-sm codemart-btn-primary"
            @click="applyCalculatedBudget"
          >
            Apply to Budget
          </button>
        </div>
      </div>
    </div>

    <!-- Timeline Section -->
    <div class="codemart-form-section">
      <h3 class="codemart-section-title">📅 Project Timeline</h3>

      <div class="codemart-form-row">
        <div class="codemart-form-group">
          <label class="codemart-form-label" for="start-date">
            {{ t('codemart.project.submission.step5.startDate') }}
            <span class="codemart-help-icon" title="When do you want to start?">ℹ️</span>
          </label>
          <input
            id="start-date"
            v-model="localData.startDate"
            type="date"
            class="codemart-form-input"
            :class="{
              'codemart-input-warning': startDateValidation.hasWarning,
              'codemart-input-error': startDateValidation.hasError
            }"
            :min="minStartDate"
            @change="validateTimeline"
          />
          <div v-if="startDateValidation.message" class="codemart-validation-message">
            <span v-if="startDateValidation.hasError" class="codemart-error">✗</span>
            <span v-else-if="startDateValidation.hasWarning" class="codemart-warning">⚠️</span>
            <span v-else class="codemart-success">✓</span>
            {{ startDateValidation.message }}
          </div>
        </div>

        <div class="codemart-form-group">
          <label class="codemart-form-label" for="end-date">
            {{ t('codemart.project.submission.step5.endDate') }}
            <span class="codemart-help-icon" title="Target completion date">ℹ️</span>
          </label>
          <input
            id="end-date"
            v-model="localData.endDate"
            type="date"
            class="codemart-form-input"
            :class="{
              'codemart-input-warning': endDateValidation.hasWarning,
              'codemart-input-error': endDateValidation.hasError
            }"
            :min="localData.startDate || minStartDate"
            @change="validateTimeline"
          />
          <div v-if="endDateValidation.message" class="codemart-validation-message">
            <span v-if="endDateValidation.hasError" class="codemart-error">✗</span>
            <span v-else-if="endDateValidation.hasWarning" class="codemart-warning">⚠️</span>
            <span v-else class="codemart-success">✓</span>
            {{ endDateValidation.message }}
          </div>
        </div>
      </div>

      <!-- Timeline Summary -->
      <div v-if="timelineSummary" class="codemart-timeline-summary">
        <div class="codemart-timeline-info">
          <span class="codemart-timeline-label">📊 Project Duration:</span>
          <span class="codemart-timeline-value">{{ timelineSummary.duration }}</span>
        </div>
        <div class="codemart-timeline-info">
          <span class="codemart-timeline-label">📆 Working Days:</span>
          <span class="codemart-timeline-value">{{ timelineSummary.workingDays }} days</span>
        </div>
        <div class="codemart-timeline-info">
          <span class="codemart-timeline-label">⏰ Estimated Weeks:</span>
          <span class="codemart-timeline-value">{{ timelineSummary.weeks }} weeks</span>
        </div>
      </div>

      <!-- Timeline vs Complexity Warning -->
      <div v-if="timelineComplexityWarning" class="codemart-warning-banner">
        <span class="codemart-warning-icon">⚠️</span>
        <div class="codemart-warning-content">
          <strong>Timeline Warning:</strong>
          <p>{{ timelineComplexityWarning }}</p>
        </div>
      </div>

      <!-- Quick Timeline Presets -->
      <div class="codemart-timeline-presets">
        <span class="codemart-preset-label">Quick Select:</span>
        <button
          v-for="preset in timelinePresets"
          :key="preset.days"
          type="button"
          class="codemart-preset-btn"
          @click="applyTimelinePreset(preset.days)"
        >
          {{ preset.label }}
        </button>
      </div>
    </div>

    <!-- Technology Stack Section -->
    <div class="codemart-form-section">
      <h3 class="codemart-section-title">🛠️ Technology Stack Requirements</h3>

      <!-- Skills -->
      <div class="codemart-form-group">
        <label class="codemart-form-label">
          {{ t('codemart.project.submission.step5.skills') }}
          <span class="codemart-badge">{{ localData.skills.length }} selected</span>
        </label>
        <div class="codemart-tag-input">
          <div class="codemart-tag-list">
            <span
              v-for="(skill, index) in localData.skills"
              :key="index"
              class="codemart-tag"
            >
              {{ skill }}
              <button
                type="button"
                class="codemart-tag-remove"
                @click="removeSkill(index)"
              >
                ×
              </button>
            </span>
          </div>
          <input
            v-model="newSkill"
            type="text"
            class="codemart-form-input"
            :placeholder="t('codemart.project.submission.step5.skillsPlaceholder')"
            @keydown.enter.prevent="addSkill"
            @input="filterSkillSuggestions"
          />
        </div>

        <!-- Skill Suggestions -->
        <div v-if="filteredSkillSuggestions.length > 0" class="codemart-suggestions">
          <span class="codemart-suggestions-label">💡 Suggested Skills:</span>
          <button
            v-for="suggestion in filteredSkillSuggestions.slice(0, 10)"
            :key="suggestion"
            type="button"
            class="codemart-suggestion-btn"
            @click="addSkillFromSuggestion(suggestion)"
          >
            + {{ suggestion }}
          </button>
        </div>

        <!-- Popular Skills -->
        <div class="codemart-popular-tags">
          <span class="codemart-popular-label">🔥 Popular:</span>
          <button
            v-for="skill in popularSkills.slice(0, 8)"
            :key="skill"
            type="button"
            class="codemart-popular-btn"
            :disabled="localData.skills.includes(skill)"
            @click="addSkillFromSuggestion(skill)"
          >
            {{ skill }}
          </button>
        </div>
      </div>

      <!-- Programming Languages -->
      <div class="codemart-form-group">
        <label class="codemart-form-label">
          {{ t('codemart.project.submission.step5.languages') }}
          <span class="codemart-badge">{{ localData.languages.length }} selected</span>
        </label>
        <div class="codemart-tag-input">
          <div class="codemart-tag-list">
            <span
              v-for="(lang, index) in localData.languages"
              :key="index"
              class="codemart-tag codemart-tag-language"
            >
              {{ lang }}
              <button
                type="button"
                class="codemart-tag-remove"
                @click="removeLanguage(index)"
              >
                ×
              </button>
            </span>
          </div>
          <input
            v-model="newLanguage"
            type="text"
            class="codemart-form-input"
            :placeholder="t('codemart.project.submission.step5.languagesPlaceholder')"
            @keydown.enter.prevent="addLanguage"
          />
        </div>

        <!-- Popular Languages -->
        <div class="codemart-popular-tags">
          <span class="codemart-popular-label">🔥 Popular:</span>
          <button
            v-for="lang in popularLanguages"
            :key="lang"
            type="button"
            class="codemart-popular-btn"
            :disabled="localData.languages.includes(lang)"
            @click="addLanguageFromSuggestion(lang)"
          >
            {{ lang }}
          </button>
        </div>
      </div>

      <!-- Frameworks -->
      <div class="codemart-form-group">
        <label class="codemart-form-label">
          {{ t('codemart.project.submission.step5.frameworks') }}
          <span class="codemart-badge">{{ localData.frameworks.length }} selected</span>
        </label>
        <div class="codemart-tag-input">
          <div class="codemart-tag-list">
            <span
              v-for="(framework, index) in localData.frameworks"
              :key="index"
              class="codemart-tag codemart-tag-framework"
            >
              {{ framework }}
              <button
                type="button"
                class="codemart-tag-remove"
                @click="removeFramework(index)"
              >
                ×
              </button>
            </span>
          </div>
          <input
            v-model="newFramework"
            type="text"
            class="codemart-form-input"
            :placeholder="t('codemart.project.submission.step5.frameworksPlaceholder')"
            @keydown.enter.prevent="addFramework"
          />
        </div>

        <!-- Popular Frameworks -->
        <div class="codemart-popular-tags">
          <span class="codemart-popular-label">🔥 Popular:</span>
          <button
            v-for="framework in popularFrameworks"
            :key="framework"
            type="button"
            class="codemart-popular-btn"
            :disabled="localData.frameworks.includes(framework)"
            @click="addFrameworkFromSuggestion(framework)"
          >
            {{ framework }}
          </button>
        </div>
      </div>

      <!-- Databases -->
      <div class="codemart-form-group">
        <label class="codemart-form-label">
          {{ t('codemart.project.submission.step5.databases') }}
          <span class="codemart-badge">{{ localData.databases.length }} selected</span>
        </label>
        <div class="codemart-tag-input">
          <div class="codemart-tag-list">
            <span
              v-for="(db, index) in localData.databases"
              :key="index"
              class="codemart-tag codemart-tag-database"
            >
              {{ db }}
              <button
                type="button"
                class="codemart-tag-remove"
                @click="removeDatabase(index)"
              >
                ×
              </button>
            </span>
          </div>
          <input
            v-model="newDatabase"
            type="text"
            class="codemart-form-input"
            :placeholder="t('codemart.project.submission.step5.databasesPlaceholder')"
            @keydown.enter.prevent="addDatabase"
          />
        </div>

        <!-- Popular Databases -->
        <div class="codemart-popular-tags">
          <span class="codemart-popular-label">🔥 Popular:</span>
          <button
            v-for="db in popularDatabases"
            :key="db"
            type="button"
            class="codemart-popular-btn"
            :disabled="localData.databases.includes(db)"
            @click="addDatabaseFromSuggestion(db)"
          >
            {{ db }}
          </button>
        </div>
      </div>

      <!-- Tech Stack Compatibility Check -->
      <div v-if="techStackWarnings.length > 0" class="codemart-warning-banner">
        <span class="codemart-warning-icon">⚠️</span>
        <div class="codemart-warning-content">
          <strong>Technology Stack Compatibility:</strong>
          <ul>
            <li v-for="(warning, index) in techStackWarnings" :key="index">
              {{ warning }}
            </li>
          </ul>
        </div>
      </div>

      <!-- Tech Stack Templates -->
      <div class="codemart-tech-templates">
        <span class="codemart-templates-label">📦 Common Tech Stacks:</span>
        <button
          v-for="template in techStackTemplates"
          :key="template.name"
          type="button"
          class="codemart-template-btn"
          @click="applyTechStackTemplate(template)"
        >
          {{ template.icon }} {{ template.name }}
        </button>
      </div>
    </div>

    <div class="codemart-wizard-actions">
      <button
        type="button"
        class="codemart-btn codemart-btn-secondary"
        @click="emit('back')"
      >
        {{ t('codemart.common.back') }}
      </button>
      <button
        type="button"
        class="codemart-btn codemart-btn-primary"
        :disabled="!isValid"
        @click="handleSubmit"
      >
        {{ t('codemart.project.submission.submit') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Props {
  modelValue: {
    budget: number
    budgetType: 'fixed' | 'hourly'
    currency: string
    startDate?: string
    endDate?: string
    complexity: string
    skills: string[]
    languages: string[]
    frameworks: string[]
    databases: string[]
  }
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: Props['modelValue']]
  'submit': []
  'back': []
}>()

const localData = reactive({ ...props.modelValue })

// UI State
const showHelp = ref(false)
const showCalculator = ref(false)

// Tag inputs
const newSkill = ref('')
const newLanguage = ref('')
const newFramework = ref('')
const newDatabase = ref('')

// Calculator state
const calculator = reactive({
  hours: 0,
  hourlyRate: 50,
  additionalCosts: 0
})

// Suggestions state
const filteredSkillSuggestions = ref<string[]>([])

// Complexity Options
const complexityOptions = [
  {
    value: 'simple',
    name: 'Simple',
    icon: '🟢',
    description: 'Basic features, straightforward requirements',
    fullDescription: 'Perfect for small projects with well-defined scope, simple UI/UX, and basic functionality.',
    timeRange: '1-2 weeks',
    budgetRange: '$500-$2,000',
    features: ['Basic CRUD', 'Simple UI', 'Few integrations']
  },
  {
    value: 'medium',
    name: 'Medium',
    icon: '🟡',
    description: 'Multiple features, moderate complexity',
    fullDescription: 'Suitable for projects with multiple user roles, moderate integrations, and custom business logic.',
    timeRange: '2-4 weeks',
    budgetRange: '$2,000-$8,000',
    features: ['Multiple modules', 'Custom logic', 'API integrations']
  },
  {
    value: 'complex',
    name: 'Complex',
    icon: '🟠',
    description: 'Advanced features, high complexity',
    fullDescription: 'For projects requiring advanced architecture, real-time features, complex data models, and third-party integrations.',
    timeRange: '1-3 months',
    budgetRange: '$8,000-$20,000',
    features: ['Real-time', 'Complex data', 'Advanced security']
  },
  {
    value: 'enterprise',
    name: 'Enterprise',
    icon: '🔴',
    description: 'Full-scale system, enterprise-grade',
    fullDescription: 'Enterprise-level projects with scalability requirements, microservices, advanced security, and comprehensive features.',
    timeRange: '3+ months',
    budgetRange: '$20,000+',
    features: ['Microservices', 'High availability', 'Enterprise security']
  }
]

// Popular Technology Options
const popularSkills = [
  'Web Development', 'Mobile Development', 'API Development', 'UI/UX Design',
  'Database Design', 'DevOps', 'Testing/QA', 'Project Management',
  'Security', 'Performance Optimization', 'Cloud Architecture', 'Data Analysis'
]

const allSkillSuggestions = [
  ...popularSkills,
  'Frontend Development', 'Backend Development', 'Full Stack Development',
  'System Architecture', 'Technical Writing', 'Code Review', 'Deployment',
  'Monitoring', 'CI/CD', 'Agile/Scrum', 'Blockchain', 'Machine Learning'
]

const popularLanguages = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'Go',
  'PHP', 'C#', 'Ruby', 'Swift', 'Kotlin'
]

const popularFrameworks = [
  'React', 'Vue', 'Angular', 'Node.js', 'Express',
  'Django', 'Spring Boot', 'Laravel', 'Flutter', 'React Native'
]

const popularDatabases = [
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch',
  'SQLite', 'Oracle', 'Cassandra'
]

// Tech Stack Templates
const techStackTemplates = [
  {
    name: 'MERN Stack',
    icon: '🟢',
    languages: ['JavaScript'],
    frameworks: ['React', 'Node.js', 'Express'],
    databases: ['MongoDB']
  },
  {
    name: 'MEAN Stack',
    icon: '🔴',
    languages: ['TypeScript'],
    frameworks: ['Angular', 'Node.js', 'Express'],
    databases: ['MongoDB']
  },
  {
    name: 'Django + React',
    icon: '🐍',
    languages: ['Python', 'JavaScript'],
    frameworks: ['Django', 'React'],
    databases: ['PostgreSQL']
  },
  {
    name: 'Spring Boot + Vue',
    icon: '☕',
    languages: ['Java', 'TypeScript'],
    frameworks: ['Spring Boot', 'Vue'],
    databases: ['MySQL']
  }
]

// Timeline Presets
const timelinePresets = [
  { label: '1 Week', days: 7 },
  { label: '2 Weeks', days: 14 },
  { label: '1 Month', days: 30 },
  { label: '2 Months', days: 60 },
  { label: '3 Months', days: 90 }
]

// Currency exchange rates (mock - should come from API)
const exchangeRates: Record<string, number> = {
  CNY: 0.14,
  USD: 1,
  EUR: 1.1,
  GBP: 1.27,
  JPY: 0.0067
}

// Watch for data changes
watch(localData, (newValue) => {
  emit('update:modelValue', { ...newValue })
}, { deep: true })

// Computed Properties

const selectedComplexity = computed(() => {
  return complexityOptions.find(opt => opt.value === localData.complexity)
})

const budgetTypeHint = computed(() => {
  if (localData.budgetType === 'fixed') {
    return 'Fixed budget is best when project scope is well-defined. You pay a one-time fee regardless of time spent.'
  }
  return 'Hourly rate is best for ongoing projects or when scope may change. You pay for actual hours worked.'
})

const minStartDate = computed(() => {
  const today = new Date()
  return today.toISOString().split('T')[0]
})

// Budget Validation
const budgetValidation = computed(() => {
  if (!localData.budget || localData.budget === 0) {
    return { isValid: false, hasError: false, hasWarning: false, message: '' }
  }

  const budgetUSD = convertToUSD(localData.budget, localData.currency)

  if (budgetUSD < 100) {
    return {
      isValid: false,
      hasError: true,
      hasWarning: false,
      message: 'Budget is too low. Minimum recommended budget is $100'
    }
  }

  // Check if budget matches complexity
  if (localData.complexity) {
    const complexity = selectedComplexity.value
    if (complexity) {
      if (complexity.value === 'simple' && budgetUSD > 5000) {
        return {
          isValid: true,
          hasError: false,
          hasWarning: true,
          message: 'Budget seems high for a simple project. Consider adjusting complexity level.'
        }
      }
      if (complexity.value === 'enterprise' && budgetUSD < 15000) {
        return {
          isValid: true,
          hasError: false,
          hasWarning: true,
          message: 'Budget may be low for enterprise-level project. Recommended: $20,000+'
        }
      }
    }
  }

  return {
    isValid: true,
    hasError: false,
    hasWarning: false,
    message: 'Budget looks good ✓'
  }
})

const convertToUSD = (amount: number, currency: string): number => {
  return amount * (exchangeRates[currency] || 1)
}

const convertedBudgetUSD = computed(() => {
  const usd = convertToUSD(localData.budget, localData.currency)
  return `$${usd.toFixed(2)}`
})

const budgetSuggestion = computed(() => {
  if (!localData.complexity || !localData.budget) return ''

  const budgetUSD = convertToUSD(localData.budget, localData.currency)
  const complexity = selectedComplexity.value

  if (!complexity) return ''

  if (complexity.value === 'simple' && budgetUSD >= 500 && budgetUSD <= 2000) {
    return 'Budget is appropriate for a simple project'
  }
  if (complexity.value === 'medium' && budgetUSD >= 2000 && budgetUSD <= 8000) {
    return 'Budget is appropriate for a medium complexity project'
  }
  if (complexity.value === 'complex' && budgetUSD >= 8000 && budgetUSD <= 20000) {
    return 'Budget is appropriate for a complex project'
  }
  if (complexity.value === 'enterprise' && budgetUSD >= 20000) {
    return 'Budget is appropriate for an enterprise project'
  }

  return ''
})

// Timeline Validation
const startDateValidation = computed(() => {
  if (!localData.startDate) {
    return { isValid: false, hasError: false, hasWarning: false, message: '' }
  }

  const start = new Date(localData.startDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (start < today) {
    return {
      isValid: false,
      hasError: true,
      hasWarning: false,
      message: 'Start date cannot be in the past'
    }
  }

  const daysFromNow = Math.floor((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (daysFromNow < 3) {
    return {
      isValid: true,
      hasError: false,
      hasWarning: true,
      message: 'Very soon! Make sure you\'re ready to start'
    }
  }

  return {
    isValid: true,
    hasError: false,
    hasWarning: false,
    message: 'Start date is valid ✓'
  }
})

const endDateValidation = computed(() => {
  if (!localData.endDate) {
    return { isValid: false, hasError: false, hasWarning: false, message: '' }
  }

  if (!localData.startDate) {
    return {
      isValid: true,
      hasError: false,
      hasWarning: true,
      message: 'Please set a start date first'
    }
  }

  const start = new Date(localData.startDate)
  const end = new Date(localData.endDate)

  if (end <= start) {
    return {
      isValid: false,
      hasError: true,
      hasWarning: false,
      message: 'End date must be after start date'
    }
  }

  return {
    isValid: true,
    hasError: false,
    hasWarning: false,
    message: 'End date is valid ✓'
  }
})

const timelineSummary = computed(() => {
  if (!localData.startDate || !localData.endDate) return null

  const start = new Date(localData.startDate)
  const end = new Date(localData.endDate)
  const diffTime = end.getTime() - start.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  const workingDays = Math.floor(diffDays * 0.71) // Exclude weekends roughly
  const weeks = Math.ceil(diffDays / 7)

  return {
    duration: `${diffDays} days`,
    workingDays,
    weeks
  }
})

const timelineComplexityWarning = computed(() => {
  if (!timelineSummary.value || !localData.complexity) return ''

  const weeks = timelineSummary.value.weeks
  const complexity = localData.complexity

  if (complexity === 'simple' && weeks > 4) {
    return 'Timeline seems long for a simple project. Consider increasing complexity level or reducing timeline.'
  }
  if (complexity === 'medium' && weeks < 2) {
    return 'Timeline may be too short for a medium complexity project. Recommended: 2-4 weeks minimum.'
  }
  if (complexity === 'complex' && weeks < 4) {
    return 'Timeline may be too short for a complex project. Recommended: 4-12 weeks minimum.'
  }
  if (complexity === 'enterprise' && weeks < 12) {
    return 'Timeline may be too short for an enterprise project. Recommended: 12+ weeks minimum.'
  }

  return ''
})

const estimatedDuration = computed(() => {
  if (timelineSummary.value) {
    return `${timelineSummary.value.weeks} weeks`
  }
  if (localData.complexity) {
    const complexity = selectedComplexity.value
    return complexity ? complexity.timeRange : 'Not set'
  }
  return 'Not set'
})

// Tech Stack
const totalTechCount = computed(() => {
  return localData.skills.length + localData.languages.length +
         localData.frameworks.length + localData.databases.length
})

const techStackWarnings = computed(() => {
  const warnings: string[] = []

  // Check for database without backend language
  if (localData.databases.length > 0 && localData.languages.length === 0) {
    warnings.push('You selected databases but no programming languages. Add backend languages.')
  }

  // Check for framework without matching language
  const hasReact = localData.frameworks.some(f => f.toLowerCase().includes('react'))
  const hasVue = localData.frameworks.some(f => f.toLowerCase().includes('vue'))
  const hasAngular = localData.frameworks.some(f => f.toLowerCase().includes('angular'))
  const hasJS = localData.languages.some(l => l.toLowerCase().includes('javascript') || l.toLowerCase().includes('typescript'))

  if ((hasReact || hasVue || hasAngular) && !hasJS) {
    warnings.push('Frontend frameworks selected but JavaScript/TypeScript not in languages.')
  }

  return warnings
})

// Completeness Score
const completenessScore = computed(() => {
  let score = 0

  // Budget (25 points)
  if (localData.budget > 0) score += 15
  if (budgetValidation.value.isValid && !budgetValidation.value.hasWarning) score += 10

  // Complexity (15 points)
  if (localData.complexity) score += 15

  // Timeline (20 points)
  if (localData.startDate) score += 10
  if (localData.endDate) score += 10

  // Tech stack (40 points)
  if (localData.skills.length > 0) score += 10
  if (localData.skills.length >= 3) score += 5
  if (localData.languages.length > 0) score += 10
  if (localData.frameworks.length > 0) score += 10
  if (localData.databases.length > 0) score += 5

  return Math.min(score, 100)
})

// Calculator
const calculatedBudget = computed(() => {
  const total = (calculator.hours * calculator.hourlyRate) + calculator.additionalCosts
  return `$${total.toFixed(2)}`
})

// Functions

const validateBudget = () => {
  // Trigger recomputation
}

const validateTimeline = () => {
  // Trigger recomputation
}

const calculateBudget = () => {
  // Trigger recomputation
}

const applyCalculatedBudget = () => {
  const total = (calculator.hours * calculator.hourlyRate) + calculator.additionalCosts
  localData.budget = Math.round(total)
  localData.currency = 'USD'
  showCalculator.value = false
}

const applyTimelinePreset = (days: number) => {
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(today.getDate() + 3) // Start 3 days from now

  const endDate = new Date(startDate)
  endDate.setDate(startDate.getDate() + days)

  localData.startDate = startDate.toISOString().split('T')[0]
  localData.endDate = endDate.toISOString().split('T')[0]
}

// Skills Management
const addSkill = () => {
  if (newSkill.value.trim() && !localData.skills.includes(newSkill.value.trim())) {
    localData.skills.push(newSkill.value.trim())
    newSkill.value = ''
    filteredSkillSuggestions.value = []
  }
}

const removeSkill = (index: number) => {
  localData.skills.splice(index, 1)
}

const addSkillFromSuggestion = (skill: string) => {
  if (!localData.skills.includes(skill)) {
    localData.skills.push(skill)
  }
}

const filterSkillSuggestions = () => {
  const input = newSkill.value.toLowerCase().trim()
  if (input.length < 2) {
    filteredSkillSuggestions.value = []
    return
  }

  filteredSkillSuggestions.value = allSkillSuggestions.filter(skill =>
    skill.toLowerCase().includes(input) && !localData.skills.includes(skill)
  )
}

// Languages Management
const addLanguage = () => {
  if (newLanguage.value.trim() && !localData.languages.includes(newLanguage.value.trim())) {
    localData.languages.push(newLanguage.value.trim())
    newLanguage.value = ''
  }
}

const removeLanguage = (index: number) => {
  localData.languages.splice(index, 1)
}

const addLanguageFromSuggestion = (lang: string) => {
  if (!localData.languages.includes(lang)) {
    localData.languages.push(lang)
  }
}

// Frameworks Management
const addFramework = () => {
  if (newFramework.value.trim() && !localData.frameworks.includes(newFramework.value.trim())) {
    localData.frameworks.push(newFramework.value.trim())
    newFramework.value = ''
  }
}

const removeFramework = (index: number) => {
  localData.frameworks.splice(index, 1)
}

const addFrameworkFromSuggestion = (framework: string) => {
  if (!localData.frameworks.includes(framework)) {
    localData.frameworks.push(framework)
  }
}

// Databases Management
const addDatabase = () => {
  if (newDatabase.value.trim() && !localData.databases.includes(newDatabase.value.trim())) {
    localData.databases.push(newDatabase.value.trim())
    newDatabase.value = ''
  }
}

const removeDatabase = (index: number) => {
  localData.databases.splice(index, 1)
}

const addDatabaseFromSuggestion = (db: string) => {
  if (!localData.databases.includes(db)) {
    localData.databases.push(db)
  }
}

// Tech Stack Templates
const applyTechStackTemplate = (template: any) => {
  localData.languages = [...new Set([...localData.languages, ...template.languages])]
  localData.frameworks = [...new Set([...localData.frameworks, ...template.frameworks])]
  localData.databases = [...new Set([...localData.databases, ...template.databases])]
}

// Validation
const isValid = computed(() => {
  return localData.budget > 0 && localData.complexity !== '' && completenessScore.value >= 60
})

const handleSubmit = () => {
  if (isValid.value) {
    emit('submit')
  }
}
</script>

<!-- NO <style> tag - All styles defined in theme files -->
