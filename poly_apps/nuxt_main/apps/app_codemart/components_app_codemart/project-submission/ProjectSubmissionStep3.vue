<!--
  【DEVELOPMENT STANDARDS】
  - NO <style> tags allowed in this component
  - All styles must reference theme variables via class names
  - Theme file: common/styles/theme-base.css
  - Extended theme: apps/app_codemart/styles_app_codemart/theme-codemart.css

  Step 3: Upload Attachments (Documents, Images, Data)
-->
<template>
  <div class="codemart-wizard-step-content">
    <h2 class="codemart-step-title">{{ t('codemart.project.submission.step3.title') }}</h2>
    <p class="codemart-step-description">{{ t('codemart.project.submission.step3.description') }}</p>

    <div class="codemart-form-group">
      <label class="codemart-form-label">
        {{ t('codemart.project.submission.step3.documents') }}
      </label>
      <div class="codemart-upload-area">
        <input
          ref="documentInput"
          type="file"
          multiple
          accept=".pdf,.doc,.docx"
          class="codemart-upload-input"
          @change="handleDocumentUpload"
        />
        <button
          type="button"
          class="codemart-btn codemart-btn-outline"
          @click="documentInput?.click()"
        >
          {{ t('codemart.project.submission.step3.uploadDocuments') }}
        </button>
      </div>
      <div v-if="localData.documents.length > 0" class="codemart-file-list">
        <div
          v-for="(file, index) in localData.documents"
          :key="index"
          class="codemart-file-item"
        >
          <span class="codemart-file-name">{{ file.name }}</span>
          <button
            type="button"
            class="codemart-btn-icon"
            @click="removeDocument(index)"
          >
            ×
          </button>
        </div>
      </div>
      <div class="codemart-form-hint">
        {{ t('codemart.project.submission.step3.documentsHint') }}
      </div>
    </div>

    <div class="codemart-form-group">
      <label class="codemart-form-label">
        {{ t('codemart.project.submission.step3.images') }}
      </label>
      <div class="codemart-upload-area">
        <input
          ref="imageInput"
          type="file"
          multiple
          accept="image/*"
          class="codemart-upload-input"
          @change="handleImageUpload"
        />
        <button
          type="button"
          class="codemart-btn codemart-btn-outline"
          @click="imageInput?.click()"
        >
          {{ t('codemart.project.submission.step3.uploadImages') }}
        </button>
      </div>
      <div v-if="localData.images.length > 0" class="codemart-file-list">
        <div
          v-for="(file, index) in localData.images"
          :key="index"
          class="codemart-file-item"
        >
          <span class="codemart-file-name">{{ file.name }}</span>
          <button
            type="button"
            class="codemart-btn-icon"
            @click="removeImage(index)"
          >
            ×
          </button>
        </div>
      </div>
      <div class="codemart-form-hint">
        {{ t('codemart.project.submission.step3.imagesHint') }}
      </div>
    </div>

    <div class="codemart-form-group">
      <label class="codemart-form-label">
        {{ t('codemart.project.submission.step3.data') }}
      </label>
      <div class="codemart-upload-area">
        <input
          ref="dataInput"
          type="file"
          multiple
          accept=".xls,.xlsx,.csv"
          class="codemart-upload-input"
          @change="handleDataUpload"
        />
        <button
          type="button"
          class="codemart-btn codemart-btn-outline"
          @click="dataInput?.click()"
        >
          {{ t('codemart.project.submission.step3.uploadData') }}
        </button>
      </div>
      <div v-if="localData.data.length > 0" class="codemart-file-list">
        <div
          v-for="(file, index) in localData.data"
          :key="index"
          class="codemart-file-item"
        >
          <span class="codemart-file-name">{{ file.name }}</span>
          <button
            type="button"
            class="codemart-btn-icon"
            @click="removeData(index)"
          >
            ×
          </button>
        </div>
      </div>
      <div class="codemart-form-hint">
        {{ t('codemart.project.submission.step3.dataHint') }}
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
import { ref, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Props {
  modelValue: {
    documents: File[]
    images: File[]
    data: File[]
  }
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: Props['modelValue']]
  'next': []
  'back': []
}>()

const documentInput = ref<HTMLInputElement>()
const imageInput = ref<HTMLInputElement>()
const dataInput = ref<HTMLInputElement>()

const localData = reactive({
  documents: [...props.modelValue.documents],
  images: [...props.modelValue.images],
  data: [...props.modelValue.data]
})

watch(localData, (newValue) => {
  emit('update:modelValue', {
    documents: [...newValue.documents],
    images: [...newValue.images],
    data: [...newValue.data]
  })
}, { deep: true })

const handleDocumentUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files) {
    localData.documents.push(...Array.from(target.files))
  }
}

const handleImageUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files) {
    localData.images.push(...Array.from(target.files))
  }
}

const handleDataUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files) {
    localData.data.push(...Array.from(target.files))
  }
}

const removeDocument = (index: number) => {
  localData.documents.splice(index, 1)
}

const removeImage = (index: number) => {
  localData.images.splice(index, 1)
}

const removeData = (index: number) => {
  localData.data.splice(index, 1)
}

const handleNext = () => {
  emit('next')
}
</script>

<!-- NO <style> tag - All styles defined in theme files -->
