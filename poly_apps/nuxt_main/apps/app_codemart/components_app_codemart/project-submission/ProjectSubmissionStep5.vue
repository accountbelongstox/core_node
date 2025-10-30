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
    <h2 class="codemart-step-title">{{ t('codemart.project.submission.step5.title') }}</h2>
    <p class="codemart-step-description">{{ t('codemart.project.submission.step5.description') }}</p>

    <div class="codemart-form-row">
      <div class="codemart-form-group">
        <label class="codemart-form-label" for="project-complexity">
          {{ t('codemart.project.submission.step5.complexity') }}
          <span class="codemart-form-required">*</span>
        </label>
        <select
          id="project-complexity"
          v-model="localData.complexity"
          class="codemart-form-select"
          required
        >
          <option value="simple">{{ t('codemart.project.complexity.simple') }}</option>
          <option value="medium">{{ t('codemart.project.complexity.medium') }}</option>
          <option value="complex">{{ t('codemart.project.complexity.complex') }}</option>
          <option value="enterprise">{{ t('codemart.project.complexity.enterprise') }}</option>
        </select>
      </div>

      <div class="codemart-form-group">
        <label class="codemart-form-label" for="budget-type">
          {{ t('codemart.project.submission.step5.budgetType') }}
          <span class="codemart-form-required">*</span>
        </label>
        <select
          id="budget-type"
          v-model="localData.budgetType"
          class="codemart-form-select"
          required
        >
          <option value="fixed">{{ t('codemart.project.budgetType.fixed') }}</option>
          <option value="hourly">{{ t('codemart.project.budgetType.hourly') }}</option>
        </select>
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
            min="0"
            step="100"
            required
          />
          <select v-model="localData.currency" class="codemart-form-select codemart-input-addon">
            <option value="CNY">CNY (¥)</option>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
          </select>
        </div>
      </div>
    </div>

    <div class="codemart-form-row">
      <div class="codemart-form-group">
        <label class="codemart-form-label" for="start-date">
          {{ t('codemart.project.submission.step5.startDate') }}
        </label>
        <input
          id="start-date"
          v-model="localData.startDate"
          type="date"
          class="codemart-form-input"
        />
      </div>

      <div class="codemart-form-group">
        <label class="codemart-form-label" for="end-date">
          {{ t('codemart.project.submission.step5.endDate') }}
        </label>
        <input
          id="end-date"
          v-model="localData.endDate"
          type="date"
          class="codemart-form-input"
        />
      </div>
    </div>

    <div class="codemart-form-group">
      <label class="codemart-form-label">
        {{ t('codemart.project.submission.step5.skills') }}
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
        />
      </div>
    </div>

    <div class="codemart-form-group">
      <label class="codemart-form-label">
        {{ t('codemart.project.submission.step5.languages') }}
      </label>
      <div class="codemart-tag-input">
        <div class="codemart-tag-list">
          <span
            v-for="(lang, index) in localData.languages"
            :key="index"
            class="codemart-tag"
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
    </div>

    <div class="codemart-form-group">
      <label class="codemart-form-label">
        {{ t('codemart.project.submission.step5.frameworks') }}
      </label>
      <div class="codemart-tag-input">
        <div class="codemart-tag-list">
          <span
            v-for="(framework, index) in localData.frameworks"
            :key="index"
            class="codemart-tag"
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
    </div>

    <div class="codemart-form-group">
      <label class="codemart-form-label">
        {{ t('codemart.project.submission.step5.databases') }}
      </label>
      <div class="codemart-tag-input">
        <div class="codemart-tag-list">
          <span
            v-for="(db, index) in localData.databases"
            :key="index"
            class="codemart-tag"
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
import { ref, computed, reactive, watch } from 'vue'
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

const newSkill = ref('')
const newLanguage = ref('')
const newFramework = ref('')
const newDatabase = ref('')

watch(localData, (newValue) => {
  emit('update:modelValue', { ...newValue })
}, { deep: true })

const isValid = computed(() => {
  return localData.budget > 0 && localData.complexity !== ''
})

const addSkill = () => {
  if (newSkill.value.trim() && !localData.skills.includes(newSkill.value.trim())) {
    localData.skills.push(newSkill.value.trim())
    newSkill.value = ''
  }
}

const removeSkill = (index: number) => {
  localData.skills.splice(index, 1)
}

const addLanguage = () => {
  if (newLanguage.value.trim() && !localData.languages.includes(newLanguage.value.trim())) {
    localData.languages.push(newLanguage.value.trim())
    newLanguage.value = ''
  }
}

const removeLanguage = (index: number) => {
  localData.languages.splice(index, 1)
}

const addFramework = () => {
  if (newFramework.value.trim() && !localData.frameworks.includes(newFramework.value.trim())) {
    localData.frameworks.push(newFramework.value.trim())
    newFramework.value = ''
  }
}

const removeFramework = (index: number) => {
  localData.frameworks.splice(index, 1)
}

const addDatabase = () => {
  if (newDatabase.value.trim() && !localData.databases.includes(newDatabase.value.trim())) {
    localData.databases.push(newDatabase.value.trim())
    newDatabase.value = ''
  }
}

const removeDatabase = (index: number) => {
  localData.databases.splice(index, 1)
}

const handleSubmit = () => {
  if (isValid.value) {
    emit('submit')
  }
}
</script>

<!-- NO <style> tag - All styles defined in theme files -->
