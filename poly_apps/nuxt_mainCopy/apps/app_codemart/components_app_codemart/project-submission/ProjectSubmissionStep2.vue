<!--
  【DEVELOPMENT STANDARDS】
  - NO <style> tags allowed in this component
  - All styles must reference theme variables via class names
  - Theme file: common/styles/theme-base.css
  - Extended theme: apps/app_codemart/styles_app_codemart/theme-codemart.css

  Step 2: Detailed Requirements (Rich Text Editor)
  Enhanced with fine-grained control features for 200+ lines
-->
<template>
  <div class="codemart-wizard-step-content">
    <h2 class="codemart-step-title">{{ t('codemart.project.submission.step2.title') }}</h2>
    <p class="codemart-step-description">{{ t('codemart.project.submission.step2.description') }}</p>

    <!-- Section Navigation Tabs -->
    <div class="codemart-section-tabs">
      <button
        v-for="section in sections"
        :key="section.id"
        type="button"
        class="codemart-section-tab"
        :class="{
          'codemart-section-tab-active': activeSection === section.id,
          'codemart-section-tab-valid': isSectionValid(section.id),
          'codemart-section-tab-invalid': !isSectionValid(section.id) && hasAttemptedSubmit
        }"
        @click="activeSection = section.id"
      >
        <span class="codemart-section-tab-icon">{{ section.icon }}</span>
        <span class="codemart-section-tab-label">{{ section.label }}</span>
        <span v-if="isSectionValid(section.id)" class="codemart-section-tab-check">✓</span>
      </button>
    </div>

    <!-- Template Suggestions Banner -->
    <div class="codemart-help-banner">
      <div class="codemart-help-banner-icon">📋</div>
      <div class="codemart-help-banner-content">
        <strong>{{ t('codemart.project.submission.step2.templateTitle') }}</strong>
        <p>{{ t('codemart.project.submission.step2.templateDescription') }}</p>
      </div>
      <button
        type="button"
        class="codemart-help-banner-toggle"
        @click="showTemplates = !showTemplates"
      >
        {{ showTemplates ? '隐藏模板' : '使用模板' }}
      </button>
    </div>

    <!-- Templates Panel (Collapsible) -->
    <div v-if="showTemplates" class="codemart-templates-panel">
      <h3 class="codemart-templates-title">{{ t('codemart.project.submission.step2.selectTemplate') }}</h3>
      <div class="codemart-templates-grid">
        <div
          v-for="template in descriptionTemplates"
          :key="template.id"
          class="codemart-template-card"
          @click="applyTemplate(template)"
        >
          <div class="codemart-template-badge" :class="`codemart-template-badge-${template.type}`">
            {{ typeLabels[template.type] }}
          </div>
          <div class="codemart-template-name">{{ template.name }}</div>
          <div class="codemart-template-preview">{{ template.preview }}</div>
          <button type="button" class="codemart-template-apply-btn">
            {{ t('codemart.common.apply') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Section 1: Project Description -->
    <div v-show="activeSection === 'description'" class="codemart-form-section">
      <div class="codemart-form-group">
        <label class="codemart-form-label" for="project-description">
          {{ t('codemart.project.submission.step2.detailedDescription') }}
          <span class="codemart-form-required">*</span>
          <button
            type="button"
            class="codemart-form-label-help"
            @click="showDescriptionHelp = !showDescriptionHelp"
            title="点击查看帮助"
          >
            ?
          </button>
        </label>

        <!-- Help Tooltip -->
        <div v-if="showDescriptionHelp" class="codemart-form-help">
          <strong>{{ t('codemart.project.submission.step2.descriptionHelpTitle') }}</strong>
          <ul class="codemart-form-help-list">
            <li>{{ t('codemart.project.submission.step2.descriptionHelpTip1') }}</li>
            <li>{{ t('codemart.project.submission.step2.descriptionHelpTip2') }}</li>
            <li>{{ t('codemart.project.submission.step2.descriptionHelpTip3') }}</li>
            <li>{{ t('codemart.project.submission.step2.descriptionHelpTip4') }}</li>
          </ul>
        </div>

        <!-- Formatting Toolbar -->
        <div class="codemart-formatting-toolbar">
          <button
            v-for="tool in formattingTools"
            :key="tool.action"
            type="button"
            class="codemart-formatting-btn"
            :title="tool.title"
            @click="applyFormatting(tool.action, 'description')"
          >
            {{ tool.icon }}
          </button>
          <div class="codemart-formatting-separator"></div>
          <button
            type="button"
            class="codemart-formatting-btn"
            :class="{ 'codemart-formatting-btn-active': showMarkdownPreview }"
            @click="showMarkdownPreview = !showMarkdownPreview"
            title="Markdown预览"
          >
            👁️
          </button>
        </div>

        <div class="codemart-editor-container">
          <textarea
            v-if="!showMarkdownPreview"
            id="project-description"
            ref="descriptionTextarea"
            v-model="localData.description"
            class="codemart-form-textarea codemart-form-textarea-large"
            :class="{
              'codemart-form-input-valid': descriptionValidation.isValid,
              'codemart-form-input-error': descriptionValidation.hasError
            }"
            :placeholder="t('codemart.project.submission.step2.descriptionPlaceholder')"
            rows="15"
            required
          />
          <div v-else class="codemart-markdown-preview">
            <div class="codemart-markdown-content" v-html="markdownPreview"></div>
          </div>
        </div>

        <!-- Stats Row -->
        <div class="codemart-form-meta">
          <div class="codemart-form-hint">
            {{ descriptionWordCount }} {{ t('codemart.common.words') }}
          </div>
          <div class="codemart-form-hint">
            {{ localData.description.length }} {{ t('codemart.common.characters') }}
          </div>
          <div class="codemart-form-hint">
            {{ t('codemart.project.submission.step2.readingTime') }}: {{ descriptionReadingTime }}s
          </div>
        </div>

        <!-- Validation Message -->
        <div v-if="descriptionValidation.message" class="codemart-form-validation">
          <div v-if="descriptionValidation.hasError" class="codemart-form-validation-error">
            <span class="codemart-icon">❌</span>
            {{ descriptionValidation.message }}
          </div>
          <div v-else class="codemart-form-validation-success">
            <span class="codemart-icon">✅</span>
            {{ descriptionValidation.message }}
          </div>
        </div>
      </div>
    </div>

    <!-- Section 2: Project Background -->
    <div v-show="activeSection === 'background'" class="codemart-form-section">
      <div class="codemart-form-group">
        <label class="codemart-form-label" for="project-background">
          {{ t('codemart.project.submission.step2.projectBackground') }}
          <span class="codemart-form-optional">(可选)</span>
        </label>
        <textarea
          id="project-background"
          ref="backgroundTextarea"
          v-model="localData.background"
          class="codemart-form-textarea"
          :placeholder="t('codemart.project.submission.step2.backgroundPlaceholder')"
          rows="8"
        />
        <div class="codemart-form-meta">
          <div class="codemart-form-hint">
            {{ backgroundWordCount }} {{ t('codemart.common.words') }}
          </div>
        </div>
        <div v-if="backgroundValidation.message" class="codemart-form-validation">
          <div class="codemart-form-validation-success">
            <span class="codemart-icon">✅</span>
            {{ backgroundValidation.message }}
          </div>
        </div>
      </div>

      <!-- Background Examples -->
      <div class="codemart-form-example">
        <div class="codemart-form-example-title">
          {{ t('codemart.project.submission.step2.backgroundExampleTitle') }}
        </div>
        <ul class="codemart-form-example-list">
          <li>{{ t('codemart.project.submission.step2.backgroundExample1') }}</li>
          <li>{{ t('codemart.project.submission.step2.backgroundExample2') }}</li>
          <li>{{ t('codemart.project.submission.step2.backgroundExample3') }}</li>
        </ul>
      </div>
    </div>

    <!-- Section 3: Project Objectives -->
    <div v-show="activeSection === 'objectives'" class="codemart-form-section">
      <div class="codemart-form-group">
        <label class="codemart-form-label" for="project-objectives">
          {{ t('codemart.project.submission.step2.projectObjectives') }}
          <span class="codemart-form-optional">(可选)</span>
        </label>
        <textarea
          id="project-objectives"
          ref="objectivesTextarea"
          v-model="localData.objectives"
          class="codemart-form-textarea"
          :placeholder="t('codemart.project.submission.step2.objectivesPlaceholder')"
          rows="8"
        />
        <div class="codemart-form-meta">
          <div class="codemart-form-hint">
            {{ objectivesWordCount }} {{ t('codemart.common.words') }}
          </div>
        </div>
      </div>

      <!-- Objectives Tips -->
      <div class="codemart-form-tip">
        <div class="codemart-form-tip-icon">💡</div>
        <div class="codemart-form-tip-content">
          <strong>{{ t('codemart.project.submission.step2.objectivesTipTitle') }}</strong>
          <p>{{ t('codemart.project.submission.step2.objectivesTipContent') }}</p>
        </div>
      </div>

      <!-- Add Objective Button -->
      <div class="codemart-objectives-list">
        <h4 class="codemart-objectives-list-title">
          {{ t('codemart.project.submission.step2.keyObjectives') }}
        </h4>
        <div
          v-for="(objective, index) in objectivesList"
          :key="index"
          class="codemart-objective-item"
        >
          <span class="codemart-objective-number">{{ index + 1 }}.</span>
          <input
            v-model="objectivesList[index]"
            type="text"
            class="codemart-objective-input"
            :placeholder="t('codemart.project.submission.step2.objectivePlaceholder')"
          />
          <button
            type="button"
            class="codemart-objective-remove"
            @click="removeObjective(index)"
          >
            ×
          </button>
        </div>
        <button
          type="button"
          class="codemart-btn codemart-btn-outline codemart-btn-sm"
          @click="addObjective"
        >
          + {{ t('codemart.project.submission.step2.addObjective') }}
        </button>
      </div>
    </div>

    <!-- Overall Completeness Score -->
    <div class="codemart-completeness-panel">
      <div class="codemart-completeness-header">
        <span class="codemart-icon">📊</span>
        {{ t('codemart.project.submission.step2.completenessScore') }}
      </div>
      <div class="codemart-completeness-bar">
        <div
          class="codemart-completeness-fill"
          :class="{
            'codemart-completeness-low': completenessScore < 50,
            'codemart-completeness-medium': completenessScore >= 50 && completenessScore < 80,
            'codemart-completeness-high': completenessScore >= 80
          }"
          :style="{ width: `${completenessScore}%` }"
        ></div>
      </div>
      <div class="codemart-completeness-details">
        <span class="codemart-completeness-label">{{ completenessScore }}/100</span>
        <span class="codemart-completeness-description">{{ completenessDescription }}</span>
      </div>
    </div>

    <!-- Navigation Actions -->
    <div class="codemart-wizard-actions">
      <button
        type="button"
        class="codemart-btn codemart-btn-secondary"
        @click="emit('back')"
      >
        ← {{ t('codemart.common.back') }}
      </button>
      <button
        type="button"
        class="codemart-btn codemart-btn-primary"
        :disabled="!isValid"
        @click="handleNext"
      >
        {{ t('codemart.common.next') }}
        <span v-if="isValid">→</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Props {
  modelValue: {
    description: string
    background?: string
    objectives?: string
  }
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: Props['modelValue']]
  'next': []
  'back': []
}>()

// Refs for DOM elements
const descriptionTextarea = ref<HTMLTextAreaElement | null>(null)
const backgroundTextarea = ref<HTMLTextAreaElement | null>(null)
const objectivesTextarea = ref<HTMLTextAreaElement | null>(null)

// Local state
const localData = reactive({
  description: props.modelValue.description || '',
  background: props.modelValue.background || '',
  objectives: props.modelValue.objectives || ''
})

const activeSection = ref<string>('description')
const showTemplates = ref(false)
const showDescriptionHelp = ref(false)
const showMarkdownPreview = ref(false)
const hasAttemptedSubmit = ref(false)
const objectivesList = ref<string[]>(['', '', ''])

// Section definitions
const sections = [
  { id: 'description', icon: '📝', label: t('codemart.project.submission.step2.description') },
  { id: 'background', icon: '📚', label: t('codemart.project.submission.step2.background') },
  { id: 'objectives', icon: '🎯', label: t('codemart.project.submission.step2.objectives') }
]

// Formatting tools
const formattingTools = [
  { action: 'bold', icon: 'B', title: '粗体' },
  { action: 'italic', icon: 'I', title: '斜体' },
  { action: 'heading', icon: 'H', title: '标题' },
  { action: 'list', icon: '•', title: '列表' },
  { action: 'link', icon: '🔗', title: '链接' },
  { action: 'code', icon: '</>', title: '代码' }
]

// Description templates
const descriptionTemplates = [
  {
    id: 1,
    type: 'web',
    name: 'Web应用模板',
    preview: '包含功能需求、技术栈、架构设计等完整描述...',
    content: `## 项目概述\n[简要描述项目的核心功能和目标用户]\n\n## 功能需求\n1. 用户认证与授权\n2. 数据管理（CRUD）\n3. 实时通知\n4. 响应式设计\n\n## 技术栈\n- 前端：Vue 3 / React\n- 后端：Node.js / Python\n- 数据库：PostgreSQL / MongoDB\n\n## 非功能需求\n- 性能：页面加载时间 < 2秒\n- 安全：HTTPS、数据加密\n- 可用性：99.9% uptime`
  },
  {
    id: 2,
    type: 'mobile',
    name: '移动应用模板',
    preview: '包含用户流程、界面设计、API接口等详细说明...',
    content: `## 应用简介\n[描述应用的核心价值和使用场景]\n\n## 核心功能\n1. 用户注册与登录\n2. 主要功能模块\n3. 数据同步\n4. 推送通知\n\n## 平台支持\n- iOS 13+\n- Android 8+\n\n## 技术要求\n- 跨平台框架：Flutter / React Native\n- 状态管理\n- 本地存储\n- API集成`
  },
  {
    id: 3,
    type: 'data',
    name: '数据分析模板',
    preview: '包含数据源、分析方法、可视化需求等内容...',
    content: `## 项目背景\n[描述数据分析的业务背景和目标]\n\n## 数据源\n- 数据来源1\n- 数据来源2\n\n## 分析内容\n1. 描述性统计\n2. 趋势分析\n3. 预测建模\n\n## 交付物\n- 交互式仪表板\n- 分析报告\n- 数据模型`
  }
]

const typeLabels: Record<string, string> = {
  web: 'Web',
  mobile: 'Mobile',
  data: 'Data'
}

// Watch for changes and emit
watch(localData, (newValue) => {
  emit('update:modelValue', { ...newValue })
}, { deep: true })

// Computed - Description validation
const descriptionValidation = computed(() => {
  const description = localData.description.trim()

  if (description.length === 0) {
    return { isValid: false, hasError: false, message: '' }
  }

  if (description.length < 50) {
    return {
      isValid: false,
      hasError: true,
      message: t('codemart.project.submission.step2.descriptionTooShort')
    }
  }

  if (description.length < 100) {
    return {
      isValid: true,
      hasError: false,
      message: t('codemart.project.submission.step2.descriptionCouldBeMoreDetailed')
    }
  }

  return {
    isValid: true,
    hasError: false,
    message: t('codemart.project.submission.step2.descriptionLooksGood')
  }
})

// Computed - Background validation (optional field)
const backgroundValidation = computed(() => {
  const background = localData.background.trim()

  if (background.length > 30) {
    return {
      isValid: true,
      message: t('codemart.project.submission.step2.backgroundProvided')
    }
  }

  return { isValid: true, message: '' }
})

// Computed - Word counts
const descriptionWordCount = computed(() => {
  const words = localData.description.trim().split(/\s+/)
  return words[0] === '' ? 0 : words.length
})

const backgroundWordCount = computed(() => {
  const words = localData.background.trim().split(/\s+/)
  return words[0] === '' ? 0 : words.length
})

const objectivesWordCount = computed(() => {
  const words = localData.objectives.trim().split(/\s+/)
  return words[0] === '' ? 0 : words.length
})

// Computed - Reading time
const descriptionReadingTime = computed(() => {
  if (descriptionWordCount.value === 0) return 0
  return Math.ceil((descriptionWordCount.value / 200) * 60)
})

// Computed - Section validity
const isSectionValid = (sectionId: string): boolean => {
  switch (sectionId) {
    case 'description':
      return descriptionValidation.value.isValid
    case 'background':
      return true // Optional field
    case 'objectives':
      return true // Optional field
    default:
      return false
  }
}

// Computed - Overall validity
const isValid = computed(() => {
  return descriptionValidation.value.isValid
})

// Computed - Completeness score
const completenessScore = computed(() => {
  let score = 0

  // Description score (60 points)
  if (localData.description.length >= 100) score += 30
  if (localData.description.length >= 300) score += 15
  if (descriptionWordCount.value >= 50) score += 15

  // Background score (20 points)
  if (localData.background.length >= 50) score += 10
  if (backgroundWordCount.value >= 20) score += 10

  // Objectives score (20 points)
  if (localData.objectives.length >= 30) score += 10
  const filledObjectives = objectivesList.value.filter(obj => obj.trim().length > 5).length
  score += Math.min(filledObjectives * 3, 10)

  return Math.min(score, 100)
})

const completenessDescription = computed(() => {
  if (completenessScore.value < 50) {
    return t('codemart.project.submission.step2.completenessLow')
  } else if (completenessScore.value < 80) {
    return t('codemart.project.submission.step2.completenessMedium')
  } else {
    return t('codemart.project.submission.step2.completenessHigh')
  }
})

// Computed - Markdown preview (simple conversion)
const markdownPreview = computed(() => {
  let html = localData.description
  // Convert headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>')
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>')
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>')
  // Convert bold
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
  // Convert italic
  html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>')
  // Convert lists
  html = html.replace(/^\- (.*$)/gim, '<li>$1</li>')
  // Convert line breaks
  html = html.replace(/\n/gim, '<br>')
  return html
})

// Methods
const applyTemplate = (template: typeof descriptionTemplates[0]) => {
  localData.description = template.content
  showTemplates.value = false
  activeSection.value = 'description'
}

const applyFormatting = (action: string, field: string) => {
  const textarea = field === 'description' ? descriptionTextarea.value : null
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selectedText = localData.description.substring(start, end)

  let replacement = selectedText
  switch (action) {
    case 'bold':
      replacement = `**${selectedText}**`
      break
    case 'italic':
      replacement = `*${selectedText}*`
      break
    case 'heading':
      replacement = `## ${selectedText}`
      break
    case 'list':
      replacement = `- ${selectedText}`
      break
    case 'link':
      replacement = `[${selectedText}](url)`
      break
    case 'code':
      replacement = `\`${selectedText}\``
      break
  }

  localData.description =
    localData.description.substring(0, start) +
    replacement +
    localData.description.substring(end)
}

const addObjective = () => {
  objectivesList.value.push('')
}

const removeObjective = (index: number) => {
  objectivesList.value.splice(index, 1)
}

const handleNext = () => {
  hasAttemptedSubmit.value = true
  if (isValid.value) {
    emit('next')
  }
}
</script>

<!-- NO <style> tag - All styles defined in theme files -->
