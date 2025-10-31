<!--
  【DEVELOPMENT STANDARDS】
  - NO <style> tags allowed in this component
  - All styles must reference theme variables via class names
  - Theme file: common/styles/theme-base.css
  - Extended theme: apps/app_codemart/styles_app_codemart/theme-codemart.css
-->
<template>
  <div class="codemart-wizard-container">
    <div class="codemart-wizard-header">
      <h1 class="codemart-wizard-title">{{ t('codemart.project.submission.title') }}</h1>
      <div class="codemart-wizard-steps">
        <div
          v-for="(step, index) in steps"
          :key="index"
          class="codemart-wizard-step"
          :class="{
            'codemart-wizard-step-active': currentStep === index + 1,
            'codemart-wizard-step-completed': currentStep > index + 1
          }"
        >
          <div class="codemart-wizard-step-number">{{ index + 1 }}</div>
          <div class="codemart-wizard-step-label">{{ step.label }}</div>
        </div>
      </div>
    </div>

    <div class="codemart-wizard-content">
      <ProjectSubmissionStep1
        v-if="currentStep === 1"
        v-model="formData.step1"
        @next="handleNext"
      />
      <ProjectSubmissionStep2
        v-else-if="currentStep === 2"
        v-model="formData.step2"
        @next="handleNext"
        @back="handleBack"
      />
      <ProjectSubmissionStep3
        v-else-if="currentStep === 3"
        v-model="formData.step3"
        @next="handleNext"
        @back="handleBack"
      />
      <ProjectSubmissionStep4
        v-else-if="currentStep === 4"
        v-model="formData.step4"
        @next="handleNext"
        @back="handleBack"
      />
      <ProjectSubmissionStep5
        v-else-if="currentStep === 5"
        v-model="formData.step5"
        @submit="handleSubmit"
        @back="handleBack"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import ProjectSubmissionStep1 from './ProjectSubmissionStep1.vue'
import ProjectSubmissionStep2 from './ProjectSubmissionStep2.vue'
import ProjectSubmissionStep3 from './ProjectSubmissionStep3.vue'
import ProjectSubmissionStep4 from './ProjectSubmissionStep4.vue'
import ProjectSubmissionStep5 from './ProjectSubmissionStep5.vue'
import type { CreateProjectRequest } from '~/apps/app_codemart/services_app_codemart/project-api'
import projectApi from '~/apps/app_codemart/services_app_codemart/project-api'

const { t } = useI18n()
const router = useRouter()

const currentStep = ref(1)

const steps = [
  { label: t('codemart.project.submission.step1') },
  { label: t('codemart.project.submission.step2') },
  { label: t('codemart.project.submission.step3') },
  { label: t('codemart.project.submission.step4') },
  { label: t('codemart.project.submission.step5') }
]

interface FormData {
  step1: {
    title: string
    summary: string
  }
  step2: {
    description: string
  }
  step3: {
    documents: File[]
    images: File[]
    data: File[]
  }
  step4: {
    referenceUrls: string[]
    codeSnippets: string[]
  }
  step5: {
    budget: number
    budgetType: 'fixed' | 'hourly'
    currency: string
    startDate?: string
    endDate?: string
    complexity: 'simple' | 'medium' | 'complex' | 'enterprise'
    skills: string[]
    languages: string[]
    frameworks: string[]
    databases: string[]
  }
}

const formData = reactive<FormData>({
  step1: {
    title: '',
    summary: ''
  },
  step2: {
    description: ''
  },
  step3: {
    documents: [],
    images: [],
    data: []
  },
  step4: {
    referenceUrls: [],
    codeSnippets: []
  },
  step5: {
    budget: 0,
    budgetType: 'fixed',
    currency: 'CNY',
    complexity: 'medium',
    skills: [],
    languages: [],
    frameworks: [],
    databases: []
  }
})

const handleNext = () => {
  if (currentStep.value < 5) {
    currentStep.value++
  }
}

const handleBack = () => {
  if (currentStep.value > 1) {
    currentStep.value--
  }
}

const handleSubmit = async () => {
  try {
    const projectData: CreateProjectRequest = {
      title: formData.step1.title,
      description: formData.step2.description,
      complexity: formData.step5.complexity as any,
      budget: formData.step5.budget,
      budget_type: formData.step5.budgetType,
      currency: formData.step5.currency,
      start_date: formData.step5.startDate,
      end_date: formData.step5.endDate,
      skills: formData.step5.skills,
      languages: formData.step5.languages,
      frameworks: formData.step5.frameworks,
      databases: formData.step5.databases
    }

    const result = await projectApi.createProject(projectData)

    // Upload attachments if any
    if (formData.step3.documents.length > 0 || formData.step3.images.length > 0 || formData.step3.data.length > 0) {
      const allFiles = [...formData.step3.documents, ...formData.step3.images, ...formData.step3.data]
      for (const file of allFiles) {
        await projectApi.uploadProjectAttachment(result.id, file)
      }
    }

    // Navigate to project detail page
    router.push(`/codemart/projects/${result.id}`)
  } catch (error) {
    console.error('Failed to create project:', error)
    // TODO: Show error notification
  }
}
</script>

<!-- NO <style> tag - All styles defined in theme files -->
