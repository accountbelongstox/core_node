<!--
  【DEVELOPMENT STANDARDS】
  - NO <style> tags allowed in this component
  - All styles must reference theme variables via class names
  - Theme file: common/styles/theme-base.css
  - Extended theme: apps/app_codemart/styles_app_codemart/theme-codemart.css

  Step 4: Reference Examples (URLs + Code Snippets)
-->
<template>
  <div class="codemart-wizard-step-content">
    <h2 class="codemart-step-title">{{ t('codemart.project.submission.step4.title') }}</h2>
    <p class="codemart-step-description">{{ t('codemart.project.submission.step4.description') }}</p>

    <div class="codemart-form-group">
      <label class="codemart-form-label">
        {{ t('codemart.project.submission.step4.referenceUrls') }}
      </label>
      <div
        v-for="(url, index) in localData.referenceUrls"
        :key="index"
        class="codemart-input-group"
      >
        <input
          v-model="localData.referenceUrls[index]"
          type="url"
          class="codemart-form-input"
          :placeholder="t('codemart.project.submission.step4.urlPlaceholder')"
        />
        <button
          type="button"
          class="codemart-btn-icon"
          @click="removeUrl(index)"
        >
          ×
        </button>
      </div>
      <button
        type="button"
        class="codemart-btn codemart-btn-outline codemart-btn-sm"
        @click="addUrl"
      >
        + {{ t('codemart.project.submission.step4.addUrl') }}
      </button>
      <div class="codemart-form-hint">
        {{ t('codemart.project.submission.step4.urlHint') }}
      </div>
    </div>

    <div class="codemart-form-group">
      <label class="codemart-form-label">
        {{ t('codemart.project.submission.step4.codeSnippets') }}
      </label>
      <div
        v-for="(snippet, index) in localData.codeSnippets"
        :key="index"
        class="codemart-snippet-group"
      >
        <textarea
          v-model="localData.codeSnippets[index]"
          class="codemart-form-textarea codemart-form-code"
          :placeholder="t('codemart.project.submission.step4.snippetPlaceholder')"
          rows="6"
        />
        <button
          type="button"
          class="codemart-btn-icon"
          @click="removeSnippet(index)"
        >
          ×
        </button>
      </div>
      <button
        type="button"
        class="codemart-btn codemart-btn-outline codemart-btn-sm"
        @click="addSnippet"
      >
        + {{ t('codemart.project.submission.step4.addSnippet') }}
      </button>
      <div class="codemart-form-hint">
        {{ t('codemart.project.submission.step4.snippetHint') }}
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
        @click="handleNext"
      >
        {{ t('codemart.common.next') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Props {
  modelValue: {
    referenceUrls: string[]
    codeSnippets: string[]
  }
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: Props['modelValue']]
  'next': []
  'back': []
}>()

const localData = reactive({
  referenceUrls: props.modelValue.referenceUrls.length > 0 ? [...props.modelValue.referenceUrls] : [''],
  codeSnippets: props.modelValue.codeSnippets.length > 0 ? [...props.modelValue.codeSnippets] : ['']
})

watch(localData, (newValue) => {
  emit('update:modelValue', {
    referenceUrls: newValue.referenceUrls.filter(url => url.trim() !== ''),
    codeSnippets: newValue.codeSnippets.filter(snippet => snippet.trim() !== '')
  })
}, { deep: true })

const addUrl = () => {
  localData.referenceUrls.push('')
}

const removeUrl = (index: number) => {
  localData.referenceUrls.splice(index, 1)
  if (localData.referenceUrls.length === 0) {
    localData.referenceUrls.push('')
  }
}

const addSnippet = () => {
  localData.codeSnippets.push('')
}

const removeSnippet = (index: number) => {
  localData.codeSnippets.splice(index, 1)
  if (localData.codeSnippets.length === 0) {
    localData.codeSnippets.push('')
  }
}

const handleNext = () => {
  emit('next')
}
</script>

<!-- NO <style> tag - All styles defined in theme files -->
