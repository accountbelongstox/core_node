<!--
  【DEVELOPMENT STANDARDS】
  - NO <style> tags allowed in this component
  - All styles must reference theme variables via class names
  - Theme file: common/styles/theme-base.css
  - Extended theme: apps/app_codemart/styles_app_codemart/theme-codemart.css

  Project Submission Wizard - Refactored with Composable
  Now uses useProjectSubmission for centralized business logic
-->
<template>
  <div class="codemart-wizard-container">
    <!-- Header with Progress Bar -->
    <div class="codemart-wizard-header">
      <div class="codemart-wizard-header-top">
        <h1 class="codemart-wizard-title">{{ t('codemart.project.submission.title') }}</h1>
        <div class="codemart-wizard-actions">
          <!-- Draft Management -->
          <button
            v-if="hasDraft"
            type="button"
            class="codemart-btn codemart-btn-outline codemart-btn-sm"
            @click="handleLoadDraft"
          >
            <span class="codemart-icon">📄</span>
            {{ t('codemart.project.submission.loadDraft') }}
          </button>
          <button
            v-if="!submitSuccess"
            type="button"
            class="codemart-btn codemart-btn-outline codemart-btn-sm"
            @click="handleSaveDraft"
          >
            <span class="codemart-icon">💾</span>
            {{ t('codemart.project.submission.saveDraft') }}
          </button>
          <button
            v-if="!submitSuccess"
            type="button"
            class="codemart-btn codemart-btn-outline codemart-btn-sm"
            @click="handleClearForm"
          >
            <span class="codemart-icon">🗑️</span>
            {{ t('codemart.common.clear') }}
          </button>
        </div>
      </div>

      <!-- Progress Indicator -->
      <div class="codemart-wizard-progress">
        <div class="codemart-wizard-progress-bar">
          <div
            class="codemart-wizard-progress-fill"
            :style="{ width: `${completionPercentage}%` }"
          ></div>
        </div>
        <div class="codemart-wizard-progress-text">
          {{ completionPercentage }}% {{ t('codemart.common.complete') }}
        </div>
      </div>

      <!-- Step Indicators -->
      <div class="codemart-wizard-steps">
        <div
          v-for="(step, index) in steps"
          :key="index"
          class="codemart-wizard-step"
          :class="{
            'codemart-wizard-step-active': currentStep === index + 1,
            'codemart-wizard-step-completed': currentStep > index + 1,
            'codemart-wizard-step-valid': isStepValid(index + 1),
            'codemart-wizard-step-invalid': !isStepValid(index + 1) && currentStep > index + 1
          }"
          @click="handleStepClick(index + 1)"
        >
          <div class="codemart-wizard-step-indicator">
            <div class="codemart-wizard-step-number">
              <span v-if="currentStep > index + 1 && isStepValid(index + 1)">✓</span>
              <span v-else>{{ index + 1 }}</span>
            </div>
            <div class="codemart-wizard-step-label">{{ step.label }}</div>
          </div>
          <div v-if="step.description" class="codemart-wizard-step-description">
            {{ step.description }}
          </div>
        </div>
      </div>
    </div>

    <!-- Auto-save Indicator -->
    <div v-if="showAutoSaveIndicator" class="codemart-wizard-autosave">
      <span class="codemart-icon">💾</span>
      {{ t('codemart.project.submission.autoSaved') }}
    </div>

    <!-- Validation Messages -->
    <div v-if="!currentStepValid && currentStep > 1" class="codemart-wizard-validation">
      <div class="codemart-alert codemart-alert-warning">
        <span class="codemart-icon">⚠️</span>
        {{ t('codemart.project.submission.pleaseCompleteRequiredFields') }}
      </div>
    </div>

    <!-- Error Display -->
    <div v-if="error" class="codemart-wizard-error">
      <div class="codemart-alert codemart-alert-error">
        <span class="codemart-icon">❌</span>
        {{ error }}
        <button type="button" class="codemart-alert-close" @click="error = null">×</button>
      </div>
    </div>

    <!-- Loading Overlay -->
    <div v-if="loading" class="codemart-wizard-loading">
      <div class="codemart-spinner-large"></div>
      <p class="codemart-wizard-loading-text">
        {{ isUploading ? t('codemart.project.submission.uploading') : t('codemart.common.processing') }}
      </p>
      <div v-if="isUploading && totalFiles > 0" class="codemart-wizard-upload-progress">
        <p>{{ t('codemart.project.submission.uploadingFiles', { current: uploadedFiles, total: totalFiles }) }}</p>
      </div>
    </div>

    <!-- Step Content -->
    <div class="codemart-wizard-content">
      <ProjectSubmissionStep1
        v-if="currentStep === 1"
        v-model="formData.step1"
        :is-valid="step1Valid"
        @next="handleNext"
      />
      <ProjectSubmissionStep2
        v-else-if="currentStep === 2"
        v-model="formData.step2"
        :is-valid="step2Valid"
        @next="handleNext"
        @back="handleBack"
      />
      <ProjectSubmissionStep3
        v-else-if="currentStep === 3"
        v-model="formData.step3"
        :is-valid="step3Valid"
        :upload-progress="uploadProgress"
        @next="handleNext"
        @back="handleBack"
      />
      <ProjectSubmissionStep4
        v-else-if="currentStep === 4"
        v-model="formData.step4"
        :is-valid="step4Valid"
        @next="handleNext"
        @back="handleBack"
      />
      <ProjectSubmissionStep5
        v-else-if="currentStep === 5"
        v-model="formData.step5"
        :is-valid="step5Valid"
        @submit="handleSubmit"
        @back="handleBack"
      />
    </div>

    <!-- Success Message -->
    <div v-if="submitSuccess" class="codemart-wizard-success">
      <div class="codemart-success-content">
        <div class="codemart-success-icon">✓</div>
        <h2 class="codemart-success-title">{{ t('codemart.project.submission.successTitle') }}</h2>
        <p class="codemart-success-message">{{ t('codemart.project.submission.successMessage') }}</p>
        <div class="codemart-success-actions">
          <button
            type="button"
            class="codemart-btn codemart-btn-primary"
            @click="handleViewProject"
          >
            {{ t('codemart.project.submission.viewProject') }}
          </button>
          <button
            type="button"
            class="codemart-btn codemart-btn-outline"
            @click="handleCreateAnother"
          >
            {{ t('codemart.project.submission.createAnother') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Confirmation Dialog -->
    <div v-if="showClearConfirmation" class="codemart-modal-overlay" @click.self="showClearConfirmation = false">
      <div class="codemart-modal codemart-modal-sm">
        <div class="codemart-modal-header">
          <h3 class="codemart-modal-title">{{ t('codemart.common.confirm') }}</h3>
          <button type="button" class="codemart-modal-close" @click="showClearConfirmation = false">×</button>
        </div>
        <div class="codemart-modal-body">
          <p>{{ t('codemart.project.submission.confirmClear') }}</p>
        </div>
        <div class="codemart-modal-footer">
          <button
            type="button"
            class="codemart-btn codemart-btn-secondary"
            @click="showClearConfirmation = false"
          >
            {{ t('codemart.common.cancel') }}
          </button>
          <button
            type="button"
            class="codemart-btn codemart-btn-danger"
            @click="confirmClear"
          >
            {{ t('codemart.common.clear') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useProjectSubmission } from '~/apps/app_codemart/composables_app_codemart/use-project-submission'
import { useProjectStore } from '~/apps/app_codemart/stores/codemart/project'
import ProjectSubmissionStep1 from './ProjectSubmissionStep1.vue'
import ProjectSubmissionStep2 from './ProjectSubmissionStep2.vue'
import ProjectSubmissionStep3 from './ProjectSubmissionStep3.vue'
import ProjectSubmissionStep4 from './ProjectSubmissionStep4.vue'
import ProjectSubmissionStep5 from './ProjectSubmissionStep5.vue'

const { t } = useI18n()
const router = useRouter()
const projectStore = useProjectStore()

// Use composable for business logic
const {
  currentStep,
  loading,
  error,
  submitSuccess,
  createdProjectId,
  formData,
  uploadProgress,
  isUploading,
  step1Valid,
  step2Valid,
  step3Valid,
  step4Valid,
  step5Valid,
  currentStepValid,
  completionPercentage,
  totalFiles,
  hasDraft,
  handleNext,
  handleBack,
  goToStep,
  saveDraft,
  loadDraft,
  clearDraft,
  submitProject,
  resetForm
} = useProjectSubmission()

// Local UI state
const showAutoSaveIndicator = ref(false)
const showClearConfirmation = ref(false)

// Step definitions with descriptions
const steps = computed(() => [
  {
    label: t('codemart.project.submission.step1'),
    description: t('codemart.project.submission.step1Description')
  },
  {
    label: t('codemart.project.submission.step2'),
    description: t('codemart.project.submission.step2Description')
  },
  {
    label: t('codemart.project.submission.step3'),
    description: t('codemart.project.submission.step3Description')
  },
  {
    label: t('codemart.project.submission.step4'),
    description: t('codemart.project.submission.step4Description')
  },
  {
    label: t('codemart.project.submission.step5'),
    description: t('codemart.project.submission.step5Description')
  }
])

// Computed
const uploadedFiles = computed(() => {
  return Object.values(uploadProgress).filter(p => p.progress === 100).length
})

// Methods
const isStepValid = (step: number): boolean => {
  switch (step) {
    case 1: return step1Valid.value
    case 2: return step2Valid.value
    case 3: return step3Valid.value
    case 4: return step4Valid.value
    case 5: return step5Valid.value
    default: return false
  }
}

const handleStepClick = (step: number) => {
  // Allow navigation to previous steps or next step if current is valid
  if (step < currentStep.value || (step === currentStep.value + 1 && currentStepValid.value)) {
    goToStep(step)
  }
}

const handleSaveDraft = () => {
  saveDraft()
  showAutoSaveIndicator.value = true
  setTimeout(() => {
    showAutoSaveIndicator.value = false
  }, 2000)
}

const handleLoadDraft = () => {
  const loaded = loadDraft()
  if (loaded) {
    showAutoSaveIndicator.value = true
    setTimeout(() => {
      showAutoSaveIndicator.value = false
    }, 2000)
  }
}

const handleClearForm = () => {
  showClearConfirmation.value = true
}

const confirmClear = () => {
  resetForm()
  clearDraft()
  showClearConfirmation.value = false
}

const handleSubmit = async () => {
  const project = await submitProject()

  if (project) {
    // Add to store
    projectStore.addProject(project)
  }
}

const handleViewProject = () => {
  if (createdProjectId.value) {
    router.push(`/codemart/projects/${createdProjectId.value}`)
  }
}

const handleCreateAnother = () => {
  resetForm()
}

// Watch for form changes to show auto-save indicator periodically
let autoSaveTimeout: NodeJS.Timeout | null = null
watch(formData, () => {
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout)
  }
  autoSaveTimeout = setTimeout(() => {
    if (!submitSuccess.value && !loading.value) {
      showAutoSaveIndicator.value = true
      setTimeout(() => {
        showAutoSaveIndicator.value = false
      }, 1500)
    }
  }, 30000) // Show indicator every 30 seconds when auto-saving
}, { deep: true })
</script>

<!-- NO <style> tag - All styles defined in theme files -->
