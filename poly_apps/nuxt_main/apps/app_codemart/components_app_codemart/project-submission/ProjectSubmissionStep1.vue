<!--
  【DEVELOPMENT STANDARDS】
  - NO <style> tags allowed in this component
  - All styles must reference theme variables via class names
  - Theme file: common/styles/theme-base.css
  - Extended theme: apps/app_codemart/styles_app_codemart/theme-codemart.css

  Step 1: Core Information (Title + One-line Summary)
-->
<template>
  <div class="codemart-wizard-step-content">
    <h2 class="codemart-step-title">{{ t('codemart.project.submission.step1.title') }}</h2>
    <p class="codemart-step-description">{{ t('codemart.project.submission.step1.description') }}</p>

    <div class="codemart-form-group">
      <label class="codemart-form-label" for="project-title">
        {{ t('codemart.project.submission.step1.projectTitle') }}
        <span class="codemart-form-required">*</span>
      </label>
      <input
        id="project-title"
        v-model="localData.title"
        type="text"
        class="codemart-form-input"
        :placeholder="t('codemart.project.submission.step1.titlePlaceholder')"
        maxlength="100"
        required
      />
      <div class="codemart-form-hint">
        {{ localData.title.length }}/100
      </div>
    </div>

    <div class="codemart-form-group">
      <label class="codemart-form-label" for="project-summary">
        {{ t('codemart.project.submission.step1.oneLiner') }}
        <span class="codemart-form-required">*</span>
      </label>
      <textarea
        id="project-summary"
        v-model="localData.summary"
        class="codemart-form-textarea"
        :placeholder="t('codemart.project.submission.step1.summaryPlaceholder')"
        maxlength="200"
        rows="3"
        required
      />
      <div class="codemart-form-hint">
        {{ localData.summary.length }}/200
      </div>
    </div>

    <div class="codemart-wizard-actions">
      <button
        type="button"
        class="codemart-btn codemart-btn-primary"
        :disabled="!isValid"
        @click="handleNext"
      >
        {{ t('codemart.common.next') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
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

const localData = reactive({
  title: props.modelValue.title,
  summary: props.modelValue.summary
})

watch(localData, (newValue) => {
  emit('update:modelValue', { ...newValue })
})

const isValid = computed(() => {
  return localData.title.trim().length >= 5 && localData.summary.trim().length >= 10
})

const handleNext = () => {
  if (isValid.value) {
    emit('next')
  }
}
</script>

<!-- NO <style> tag - All styles defined in theme files -->
