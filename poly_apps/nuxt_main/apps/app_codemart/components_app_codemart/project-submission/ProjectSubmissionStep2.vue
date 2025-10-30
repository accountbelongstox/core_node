<!--
  【DEVELOPMENT STANDARDS】
  - NO <style> tags allowed in this component
  - All styles must reference theme variables via class names
  - Theme file: common/styles/theme-base.css
  - Extended theme: apps/app_codemart/styles_app_codemart/theme-codemart.css

  Step 2: Detailed Requirements (Rich Text Editor)
-->
<template>
  <div class="codemart-wizard-step-content">
    <h2 class="codemart-step-title">{{ t('codemart.project.submission.step2.title') }}</h2>
    <p class="codemart-step-description">{{ t('codemart.project.submission.step2.description') }}</p>

    <div class="codemart-form-group">
      <label class="codemart-form-label" for="project-description">
        {{ t('codemart.project.submission.step2.detailedDescription') }}
        <span class="codemart-form-required">*</span>
      </label>
      <textarea
        id="project-description"
        v-model="localData.description"
        class="codemart-form-textarea codemart-form-textarea-large"
        :placeholder="t('codemart.project.submission.step2.descriptionPlaceholder')"
        rows="15"
        required
      />
      <div class="codemart-form-hint">
        {{ t('codemart.project.submission.step2.hint') }}
      </div>
    </div>

    <div class="codemart-form-example">
      <div class="codemart-form-example-title">
        {{ t('codemart.project.submission.step2.exampleTitle') }}
      </div>
      <ul class="codemart-form-example-list">
        <li>{{ t('codemart.project.submission.step2.example1') }}</li>
        <li>{{ t('codemart.project.submission.step2.example2') }}</li>
        <li>{{ t('codemart.project.submission.step2.example3') }}</li>
        <li>{{ t('codemart.project.submission.step2.example4') }}</li>
        <li>{{ t('codemart.project.submission.step2.example5') }}</li>
      </ul>
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
    description: string
  }
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: Props['modelValue']]
  'next': []
  'back': []
}>()

const localData = reactive({
  description: props.modelValue.description
})

watch(localData, (newValue) => {
  emit('update:modelValue', { ...newValue })
})

const isValid = computed(() => {
  return localData.description.trim().length >= 50
})

const handleNext = () => {
  if (isValid.value) {
    emit('next')
  }
}
</script>

<!-- NO <style> tag - All styles defined in theme files -->
