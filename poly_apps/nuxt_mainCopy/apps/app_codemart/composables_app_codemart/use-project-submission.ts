/**
 * Project Submission Composable
 *
 * Centralizes all business logic for project submission wizard:
 * - Form data state management (5 steps)
 * - Multi-step navigation with validation
 * - Draft auto-save and persistence
 * - File upload handling with progress
 * - Project creation with error handling
 * - Integration with Pinia store
 */

import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { watchDebounced } from '@vueuse/core'
import projectApi from '~/apps/app_codemart/services_app_codemart/project-api'
import attachmentApi from '~/apps/app_codemart/services_app_codemart/attachment-api'
import type {
  Project,
  ProjectComplexity,
  Attachment,
  AttachmentType
} from '~/apps/app_codemart/types_app_codemart'

interface Step1Data {
  title: string
  summary: string
}

interface Step2Data {
  description: string
  background: string
  objectives: string[]
}

interface Step3Data {
  documents: File[]
  images: File[]
  data: File[]
}

interface Step4Data {
  referenceUrls: string[]
  codeSnippets: Array<{
    language: string
    code: string
    description: string
  }>
}

interface Step5Data {
  budget: number
  budgetType: 'fixed' | 'hourly' | 'milestone'
  estimatedDuration: number
  durationType: 'days' | 'weeks' | 'months'
  complexity: ProjectComplexity
  skills: string[]
  languages: string[]
  frameworks: string[]
  databases: string[]
  additionalRequirements: string
}

interface FormData {
  step1: Step1Data
  step2: Step2Data
  step3: Step3Data
  step4: Step4Data
  step5: Step5Data
}

interface UploadProgress {
  [key: string]: {
    progress: number
    total: number
    uploaded: number
  }
}

const DRAFT_STORAGE_KEY = 'codemart_project_draft'
const AUTO_SAVE_INTERVAL = 30000 // 30 seconds

export function useProjectSubmission() {
  const router = useRouter()

  // State
  const currentStep = ref(1)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const submitSuccess = ref(false)
  const createdProjectId = ref<number | null>(null)

  const uploadProgress = reactive<UploadProgress>({})
  const isUploading = ref(false)

  const formData = reactive<FormData>({
    step1: {
      title: '',
      summary: ''
    },
    step2: {
      description: '',
      background: '',
      objectives: []
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
      estimatedDuration: 0,
      durationType: 'weeks',
      complexity: 'medium',
      skills: [],
      languages: [],
      frameworks: [],
      databases: [],
      additionalRequirements: ''
    }
  })

  // Computed - Step Validations
  const step1Valid = computed(() => {
    return (
      formData.step1.title.trim().length >= 5 &&
      formData.step1.title.trim().length <= 100 &&
      formData.step1.summary.trim().length >= 10 &&
      formData.step1.summary.trim().length <= 500
    )
  })

  const step2Valid = computed(() => {
    return (
      formData.step2.description.trim().length >= 50 &&
      formData.step2.background.trim().length >= 20 &&
      formData.step2.objectives.length >= 1
    )
  })

  const step3Valid = computed(() => {
    // At least one file type should be provided (optional step)
    return true
  })

  const step4Valid = computed(() => {
    // Optional step - always valid
    return true
  })

  const step5Valid = computed(() => {
    return (
      formData.step5.budget > 0 &&
      formData.step5.estimatedDuration > 0 &&
      formData.step5.skills.length >= 1 &&
      formData.step5.languages.length >= 1
    )
  })

  const currentStepValid = computed(() => {
    switch (currentStep.value) {
      case 1: return step1Valid.value
      case 2: return step2Valid.value
      case 3: return step3Valid.value
      case 4: return step4Valid.value
      case 5: return step5Valid.value
      default: return false
    }
  })

  const allStepsValid = computed(() => {
    return (
      step1Valid.value &&
      step2Valid.value &&
      step3Valid.value &&
      step4Valid.value &&
      step5Valid.value
    )
  })

  const completionPercentage = computed(() => {
    let completed = 0
    if (step1Valid.value) completed += 20
    if (step2Valid.value) completed += 20
    if (formData.step3.documents.length > 0 ||
        formData.step3.images.length > 0 ||
        formData.step3.data.length > 0) completed += 20
    if (formData.step4.referenceUrls.length > 0 ||
        formData.step4.codeSnippets.length > 0) completed += 20
    if (step5Valid.value) completed += 20
    return completed
  })

  const totalFiles = computed(() => {
    return (
      formData.step3.documents.length +
      formData.step3.images.length +
      formData.step3.data.length
    )
  })

  // Navigation Methods
  const handleNext = () => {
    if (currentStepValid.value && currentStep.value < 5) {
      currentStep.value++
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleBack = () => {
    if (currentStep.value > 1) {
      currentStep.value--
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const goToStep = (step: number) => {
    if (step >= 1 && step <= 5) {
      currentStep.value = step
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Draft Management
  const saveDraft = () => {
    try {
      const draft = {
        formData: {
          step1: formData.step1,
          step2: formData.step2,
          // Don't save files - they can't be serialized
          step3: {
            documents: formData.step3.documents.map(f => ({ name: f.name, size: f.size })),
            images: formData.step3.images.map(f => ({ name: f.name, size: f.size })),
            data: formData.step3.data.map(f => ({ name: f.name, size: f.size }))
          },
          step4: formData.step4,
          step5: formData.step5
        },
        currentStep: currentStep.value,
        savedAt: new Date().toISOString()
      }
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
      console.log('Draft saved successfully')
    } catch (err) {
      console.error('Failed to save draft:', err)
    }
  }

  const loadDraft = () => {
    try {
      const draftStr = localStorage.getItem(DRAFT_STORAGE_KEY)
      if (!draftStr) return false

      const draft = JSON.parse(draftStr)

      // Restore form data (except files)
      if (draft.formData) {
        Object.assign(formData.step1, draft.formData.step1 || {})
        Object.assign(formData.step2, draft.formData.step2 || {})
        Object.assign(formData.step4, draft.formData.step4 || {})
        Object.assign(formData.step5, draft.formData.step5 || {})
      }

      if (draft.currentStep) {
        currentStep.value = draft.currentStep
      }

      console.log('Draft loaded successfully')
      return true
    } catch (err) {
      console.error('Failed to load draft:', err)
      return false
    }
  }

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY)
      console.log('Draft cleared successfully')
    } catch (err) {
      console.error('Failed to clear draft:', err)
    }
  }

  const hasDraft = computed(() => {
    return !!localStorage.getItem(DRAFT_STORAGE_KEY)
  })

  // File Upload Methods
  const uploadFile = async (
    file: File,
    projectId: number,
    type: AttachmentType
  ): Promise<Attachment> => {
    const fileKey = `${file.name}-${file.size}`

    uploadProgress[fileKey] = {
      progress: 0,
      total: file.size,
      uploaded: 0
    }

    try {
      const attachment = await attachmentApi.uploadAttachment(
        file,
        projectId,
        type,
        (progressEvent) => {
          if (progressEvent.total) {
            uploadProgress[fileKey] = {
              progress: Math.round((progressEvent.loaded * 100) / progressEvent.total),
              total: progressEvent.total,
              uploaded: progressEvent.loaded
            }
          }
        }
      )

      return attachment
    } catch (err) {
      delete uploadProgress[fileKey]
      throw err
    }
  }

  const uploadAllFiles = async (projectId: number): Promise<void> => {
    isUploading.value = true
    const uploadPromises: Promise<Attachment>[] = []

    // Upload documents
    for (const file of formData.step3.documents) {
      uploadPromises.push(uploadFile(file, projectId, 'document'))
    }

    // Upload images
    for (const file of formData.step3.images) {
      uploadPromises.push(uploadFile(file, projectId, 'image'))
    }

    // Upload data files
    for (const file of formData.step3.data) {
      uploadPromises.push(uploadFile(file, projectId, 'data'))
    }

    try {
      await Promise.all(uploadPromises)
    } finally {
      isUploading.value = false
    }
  }

  // Project Submission
  const submitProject = async (): Promise<Project | null> => {
    if (!allStepsValid.value) {
      error.value = 'Please complete all required fields'
      return null
    }

    loading.value = true
    error.value = null

    try {
      // Prepare project data
      const projectData = {
        title: formData.step1.title.trim(),
        description: formData.step2.description.trim(),
        budget: formData.step5.budget,
        complexity: formData.step5.complexity,
        metadata: {
          summary: formData.step1.summary.trim(),
          background: formData.step2.background.trim(),
          objectives: formData.step2.objectives,
          referenceUrls: formData.step4.referenceUrls,
          codeSnippets: formData.step4.codeSnippets,
          budgetType: formData.step5.budgetType,
          estimatedDuration: formData.step5.estimatedDuration,
          durationType: formData.step5.durationType,
          skills: formData.step5.skills,
          languages: formData.step5.languages,
          frameworks: formData.step5.frameworks,
          databases: formData.step5.databases,
          additionalRequirements: formData.step5.additionalRequirements
        }
      }

      // Create project
      const project = await projectApi.createProject(projectData)
      createdProjectId.value = project.id as number

      // Upload files if any
      if (totalFiles.value > 0) {
        await uploadAllFiles(project.id as number)
      }

      // Clear draft on success
      clearDraft()

      submitSuccess.value = true

      return project
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to submit project'
      console.error('Project submission failed:', err)
      return null
    } finally {
      loading.value = false
    }
  }

  // Reset form
  const resetForm = () => {
    currentStep.value = 1
    formData.step1.title = ''
    formData.step1.summary = ''
    formData.step2.description = ''
    formData.step2.background = ''
    formData.step2.objectives = []
    formData.step3.documents = []
    formData.step3.images = []
    formData.step3.data = []
    formData.step4.referenceUrls = []
    formData.step4.codeSnippets = []
    formData.step5.budget = 0
    formData.step5.budgetType = 'fixed'
    formData.step5.estimatedDuration = 0
    formData.step5.durationType = 'weeks'
    formData.step5.complexity = 'medium'
    formData.step5.skills = []
    formData.step5.languages = []
    formData.step5.frameworks = []
    formData.step5.databases = []
    formData.step5.additionalRequirements = ''
    error.value = null
    submitSuccess.value = false
    createdProjectId.value = null
  }

  // Auto-save with debounce
  watchDebounced(
    formData,
    () => {
      if (!submitSuccess.value) {
        saveDraft()
      }
    },
    { debounce: AUTO_SAVE_INTERVAL, deep: true }
  )

  // Lifecycle
  onMounted(() => {
    // Attempt to load draft on mount
    loadDraft()
  })

  // Warn before leaving if form is dirty
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (!submitSuccess.value && (
      formData.step1.title ||
      formData.step1.summary ||
      formData.step2.description
    )) {
      e.preventDefault()
      e.returnValue = ''
    }
  }

  onMounted(() => {
    window.addEventListener('beforeunload', handleBeforeUnload)
  })

  onUnmounted(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload)
  })

  return {
    // State
    currentStep,
    loading,
    error,
    submitSuccess,
    createdProjectId,
    formData,
    uploadProgress,
    isUploading,

    // Computed
    step1Valid,
    step2Valid,
    step3Valid,
    step4Valid,
    step5Valid,
    currentStepValid,
    allStepsValid,
    completionPercentage,
    totalFiles,
    hasDraft,

    // Methods - Navigation
    handleNext,
    handleBack,
    goToStep,

    // Methods - Draft
    saveDraft,
    loadDraft,
    clearDraft,

    // Methods - Submission
    submitProject,
    resetForm
  }
}
