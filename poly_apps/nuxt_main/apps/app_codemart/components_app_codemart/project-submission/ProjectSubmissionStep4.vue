<!--
  【DEVELOPMENT STANDARDS】
  - NO <style> tags allowed in this component
  - All styles must reference theme variables via class names
  - Theme file: common/styles/theme-base.css
  - Extended theme: apps/app_codemart/styles_app_codemart/theme-codemart.css

  Step 4: Reference Examples (URLs + Code Snippets)
  Enhanced with fine-grained control features for 200+ lines
-->
<template>
  <div class="codemart-wizard-step-content">
    <h2 class="codemart-step-title">{{ t('codemart.project.submission.step4.title') }}</h2>
    <p class="codemart-step-description">{{ t('codemart.project.submission.step4.description') }}</p>

    <!-- Reference URLs Section -->
    <div class="codemart-form-group">
      <label class="codemart-form-label">
        {{ t('codemart.project.submission.step4.referenceUrls') }}
        <span class="codemart-form-optional">(可选)</span>
        <button
          type="button"
          class="codemart-form-label-help"
          @click="showUrlHelp = !showUrlHelp"
          title="点击查看帮助"
        >
          ?
        </button>
      </label>

      <!-- Help Tooltip -->
      <div v-if="showUrlHelp" class="codemart-form-help">
        <strong>{{ t('codemart.project.submission.step4.urlHelpTitle') }}</strong>
        <ul class="codemart-form-help-list">
          <li>{{ t('codemart.project.submission.step4.urlHelpTip1') }}</li>
          <li>{{ t('codemart.project.submission.step4.urlHelpTip2') }}</li>
          <li>{{ t('codemart.project.submission.step4.urlHelpTip3') }}</li>
        </ul>
      </div>

      <!-- URL Input List -->
      <div
        v-for="(url, index) in localData.referenceUrls"
        :key="index"
        class="codemart-url-group"
      >
        <div class="codemart-input-group">
          <input
            v-model="localData.referenceUrls[index]"
            type="url"
            class="codemart-form-input"
            :class="{
              'codemart-form-input-valid': urlValidation[index]?.isValid,
              'codemart-form-input-error': urlValidation[index]?.hasError
            }"
            :placeholder="t('codemart.project.submission.step4.urlPlaceholder')"
            @blur="validateUrl(index)"
          />
          <button
            v-if="urlValidation[index]?.isValid"
            type="button"
            class="codemart-btn codemart-btn-icon"
            @click="fetchUrlMetadata(index)"
            title="获取URL信息"
          >
            🔍
          </button>
          <button
            type="button"
            class="codemart-btn codemart-btn-icon"
            @click="removeUrl(index)"
            title="删除"
          >
            ×
          </button>
        </div>

        <!-- URL Validation Message -->
        <div v-if="urlValidation[index]?.message" class="codemart-form-validation">
          <div v-if="urlValidation[index]?.hasError" class="codemart-form-validation-error">
            <span class="codemart-icon">❌</span>
            {{ urlValidation[index].message }}
          </div>
          <div v-else class="codemart-form-validation-success">
            <span class="codemart-icon">✓</span>
            {{ urlValidation[index].message }}
          </div>
        </div>

        <!-- URL Metadata Card (if fetched) -->
        <div v-if="urlMetadata[index]" class="codemart-url-preview">
          <div v-if="urlMetadata[index].image" class="codemart-url-preview-image">
            <img :src="urlMetadata[index].image" :alt="urlMetadata[index].title" />
          </div>
          <div class="codemart-url-preview-content">
            <h4 class="codemart-url-preview-title">{{ urlMetadata[index].title }}</h4>
            <p class="codemart-url-preview-description">{{ urlMetadata[index].description }}</p>
            <div class="codemart-url-preview-meta">
              <span class="codemart-url-preview-domain">{{ urlMetadata[index].domain }}</span>
            </div>
          </div>
        </div>
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

    <!-- Code Snippets Section -->
    <div class="codemart-form-group">
      <label class="codemart-form-label">
        {{ t('codemart.project.submission.step4.codeSnippets') }}
        <span class="codemart-form-optional">(可选)</span>
        <button
          type="button"
          class="codemart-form-label-help"
          @click="showSnippetHelp = !showSnippetHelp"
          title="点击查看帮助"
        >
          ?
        </button>
      </label>

      <!-- Help Tooltip -->
      <div v-if="showSnippetHelp" class="codemart-form-help">
        <strong>{{ t('codemart.project.submission.step4.snippetHelpTitle') }}</strong>
        <ul class="codemart-form-help-list">
          <li>{{ t('codemart.project.submission.step4.snippetHelpTip1') }}</li>
          <li>{{ t('codemart.project.submission.step4.snippetHelpTip2') }}</li>
          <li>{{ t('codemart.project.submission.step4.snippetHelpTip3') }}</li>
        </ul>
      </div>

      <!-- Code Snippet Templates -->
      <div v-if="showTemplates" class="codemart-snippet-templates">
        <h4 class="codemart-snippet-templates-title">
          {{ t('codemart.project.submission.step4.snippetTemplates') }}
        </h4>
        <div class="codemart-snippet-templates-grid">
          <button
            v-for="template in codeTemplates"
            :key="template.id"
            type="button"
            class="codemart-snippet-template-btn"
            @click="applyCodeTemplate(template)"
          >
            <span class="codemart-snippet-template-icon">{{ template.icon }}</span>
            <span class="codemart-snippet-template-name">{{ template.name }}</span>
          </button>
        </div>
      </div>

      <button
        type="button"
        class="codemart-btn codemart-btn-outline codemart-btn-sm"
        @click="showTemplates = !showTemplates"
      >
        {{ showTemplates ? '隐藏模板' : '查看模板' }}
      </button>

      <!-- Code Snippet List -->
      <div
        v-for="(snippet, index) in localData.codeSnippets"
        :key="index"
        class="codemart-snippet-group"
      >
        <div class="codemart-snippet-header">
          <div class="codemart-snippet-controls">
            <!-- Language Selector -->
            <select
              v-model="snippetLanguages[index]"
              class="codemart-snippet-language"
              @change="updateSnippetLanguage(index)"
            >
              <option v-for="lang in programmingLanguages" :key="lang.value" :value="lang.value">
                {{ lang.label }}
              </option>
            </select>

            <!-- Copy Button -->
            <button
              type="button"
              class="codemart-btn codemart-btn-icon"
              @click="copySnippet(index)"
              :title="copiedSnippet === index ? '已复制!' : '复制代码'"
            >
              {{ copiedSnippet === index ? '✓' : '📋' }}
            </button>

            <!-- Format Button -->
            <button
              type="button"
              class="codemart-btn codemart-btn-icon"
              @click="formatSnippet(index)"
              title="格式化代码"
            >
              ✨
            </button>

            <!-- Remove Button -->
            <button
              type="button"
              class="codemart-btn codemart-btn-icon"
              @click="removeSnippet(index)"
              title="删除"
            >
              ×
            </button>
          </div>

          <!-- Line Count & Character Count -->
          <div class="codemart-snippet-meta">
            <span class="codemart-snippet-stat">
              {{ getLineCount(localData.codeSnippets[index]) }} {{ t('codemart.common.lines') }}
            </span>
            <span class="codemart-snippet-stat">
              {{ localData.codeSnippets[index].length }} {{ t('codemart.common.characters') }}
            </span>
          </div>
        </div>

        <!-- Code Textarea with Syntax Highlighting Simulation -->
        <div class="codemart-snippet-editor">
          <div class="codemart-snippet-line-numbers">
            <div
              v-for="n in getLineCount(localData.codeSnippets[index])"
              :key="n"
              class="codemart-snippet-line-number"
            >
              {{ n }}
            </div>
          </div>
          <textarea
            v-model="localData.codeSnippets[index]"
            class="codemart-form-textarea codemart-form-code"
            :class="`codemart-code-${snippetLanguages[index]}`"
            :placeholder="t('codemart.project.submission.step4.snippetPlaceholder')"
            rows="10"
            spellcheck="false"
            @input="detectLanguage(index)"
          />
        </div>

        <!-- Auto-detected Language Hint -->
        <div v-if="detectedLanguages[index]" class="codemart-snippet-detection">
          <span class="codemart-icon">🤖</span>
          {{ t('codemart.project.submission.step4.detectedLanguage') }}: {{ detectedLanguages[index] }}
        </div>
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

    <!-- Summary Stats -->
    <div class="codemart-reference-stats">
      <div class="codemart-reference-stat">
        <span class="codemart-reference-stat-icon">🔗</span>
        <span class="codemart-reference-stat-label">
          {{ validUrlCount }} {{ t('codemart.project.submission.step4.validUrls') }}
        </span>
      </div>
      <div class="codemart-reference-stat">
        <span class="codemart-reference-stat-icon">💻</span>
        <span class="codemart-reference-stat-label">
          {{ validSnippetCount }} {{ t('codemart.project.submission.step4.validSnippets') }}
        </span>
      </div>
      <div class="codemart-reference-stat">
        <span class="codemart-reference-stat-icon">📊</span>
        <span class="codemart-reference-stat-label">
          {{ totalCodeLines }} {{ t('codemart.project.submission.step4.totalLines') }}
        </span>
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
        @click="handleNext"
      >
        {{ t('codemart.common.next') }}
        →
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch, ref, computed } from 'vue'
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

// Local state
const localData = reactive({
  referenceUrls: props.modelValue.referenceUrls.length > 0 ? [...props.modelValue.referenceUrls] : [''],
  codeSnippets: props.modelValue.codeSnippets.length > 0 ? [...props.modelValue.codeSnippets] : ['']
})

const showUrlHelp = ref(false)
const showSnippetHelp = ref(false)
const showTemplates = ref(false)
const urlValidation = ref<Record<number, { isValid: boolean; hasError: boolean; message: string }>>({})
const urlMetadata = ref<Record<number, { title: string; description: string; image: string; domain: string }>>({})
const snippetLanguages = ref<Record<number, string>>({})
const detectedLanguages = ref<Record<number, string>>({})
const copiedSnippet = ref<number | null>(null)

// Programming languages list
const programmingLanguages = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'csharp', label: 'C#' },
  { value: 'php', label: 'PHP' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash' },
  { value: 'other', label: 'Other' }
]

// Code templates
const codeTemplates = [
  {
    id: 1,
    icon: '⚛️',
    name: 'React Component',
    language: 'javascript',
    code: `import React from 'react';\n\nfunction MyComponent() {\n  return (\n    <div>\n      {/* Your component */}\n    </div>\n  );\n}\n\nexport default MyComponent;`
  },
  {
    id: 2,
    icon: '💚',
    name: 'Vue Component',
    language: 'javascript',
    code: `<template>\n  <div>\n    <!-- Your template -->\n  </div>\n</template>\n\n<script setup>\n// Your script\n</script>`
  },
  {
    id: 3,
    icon: '🐍',
    name: 'Python Function',
    language: 'python',
    code: `def my_function(param1, param2):\n    """\n    Function description\n    """\n    result = param1 + param2\n    return result`
  },
  {
    id: 4,
    icon: '☕',
    name: 'Java Class',
    language: 'java',
    code: `public class MyClass {\n    private String name;\n    \n    public MyClass(String name) {\n        this.name = name;\n    }\n    \n    public void myMethod() {\n        // Your code\n    }\n}`
  }
]

// Initialize snippet languages
localData.codeSnippets.forEach((_, index) => {
  if (!snippetLanguages.value[index]) {
    snippetLanguages.value[index] = 'javascript'
  }
})

// Watch for changes and emit
watch(localData, (newValue) => {
  emit('update:modelValue', {
    referenceUrls: newValue.referenceUrls.filter(url => url.trim() !== ''),
    codeSnippets: newValue.codeSnippets.filter(snippet => snippet.trim() !== '')
  })
}, { deep: true })

// Computed
const validUrlCount = computed(() => {
  return Object.values(urlValidation.value).filter(v => v.isValid).length
})

const validSnippetCount = computed(() => {
  return localData.codeSnippets.filter(s => s.trim().length > 10).length
})

const totalCodeLines = computed(() => {
  return localData.codeSnippets.reduce((total, snippet) => {
    return total + getLineCount(snippet)
  }, 0)
})

// Helper functions
const getLineCount = (text: string): number => {
  if (!text) return 1
  return text.split('\n').length
}

const validateUrl = (index: number) => {
  const url = localData.referenceUrls[index].trim()

  if (!url) {
    urlValidation.value[index] = { isValid: false, hasError: false, message: '' }
    return
  }

  try {
    const urlObj = new URL(url)
    if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
      urlValidation.value[index] = {
        isValid: true,
        hasError: false,
        message: t('codemart.project.submission.step4.urlValid')
      }
    } else {
      urlValidation.value[index] = {
        isValid: false,
        hasError: true,
        message: t('codemart.project.submission.step4.urlInvalidProtocol')
      }
    }
  } catch (error) {
    urlValidation.value[index] = {
      isValid: false,
      hasError: true,
      message: t('codemart.project.submission.step4.urlInvalid')
    }
  }
}

const fetchUrlMetadata = async (index: number) => {
  // Simulated metadata fetch (in real scenario, this would call an API)
  const url = localData.referenceUrls[index]
  const domain = new URL(url).hostname

  // Simulate metadata
  urlMetadata.value[index] = {
    title: 'Example Website Title',
    description: 'This is a simulated description of the referenced website. In production, this would be fetched from the actual URL.',
    image: 'https://via.placeholder.com/300x200',
    domain: domain
  }
}

const detectLanguage = (index: number) => {
  const code = localData.codeSnippets[index]

  // Simple language detection based on keywords
  if (code.includes('function') || code.includes('const') || code.includes('let')) {
    detectedLanguages.value[index] = 'JavaScript'
  } else if (code.includes('def ') || code.includes('import ')) {
    detectedLanguages.value[index] = 'Python'
  } else if (code.includes('public class') || code.includes('private ')) {
    detectedLanguages.value[index] = 'Java'
  } else if (code.includes('<template>') || code.includes('<script>')) {
    detectedLanguages.value[index] = 'Vue'
  } else if (code.includes('SELECT') || code.includes('FROM')) {
    detectedLanguages.value[index] = 'SQL'
  }
}

const copySnippet = async (index: number) => {
  try {
    await navigator.clipboard.writeText(localData.codeSnippets[index])
    copiedSnippet.value = index
    setTimeout(() => {
      copiedSnippet.value = null
    }, 2000)
  } catch (error) {
    console.error('Failed to copy:', error)
  }
}

const formatSnippet = (index: number) => {
  // Simple code formatting (add proper indentation)
  const code = localData.codeSnippets[index]
  const lines = code.split('\n')
  let indentLevel = 0
  const formattedLines = lines.map(line => {
    const trimmed = line.trim()
    if (trimmed.endsWith('{') || trimmed.endsWith(':')) {
      const formatted = '  '.repeat(indentLevel) + trimmed
      indentLevel++
      return formatted
    } else if (trimmed.startsWith('}')) {
      indentLevel = Math.max(0, indentLevel - 1)
      return '  '.repeat(indentLevel) + trimmed
    } else {
      return '  '.repeat(indentLevel) + trimmed
    }
  })
  localData.codeSnippets[index] = formattedLines.join('\n')
}

const updateSnippetLanguage = (index: number) => {
  // Language updated, could trigger syntax highlighting update
}

const applyCodeTemplate = (template: typeof codeTemplates[0]) => {
  const emptyIndex = localData.codeSnippets.findIndex(s => s.trim() === '')
  if (emptyIndex !== -1) {
    localData.codeSnippets[emptyIndex] = template.code
    snippetLanguages.value[emptyIndex] = template.language
  } else {
    localData.codeSnippets.push(template.code)
    snippetLanguages.value[localData.codeSnippets.length - 1] = template.language
  }
  showTemplates.value = false
}

// URL handlers
const addUrl = () => {
  localData.referenceUrls.push('')
}

const removeUrl = (index: number) => {
  localData.referenceUrls.splice(index, 1)
  delete urlValidation.value[index]
  delete urlMetadata.value[index]
  if (localData.referenceUrls.length === 0) {
    localData.referenceUrls.push('')
  }
}

// Snippet handlers
const addSnippet = () => {
  localData.codeSnippets.push('')
  snippetLanguages.value[localData.codeSnippets.length - 1] = 'javascript'
}

const removeSnippet = (index: number) => {
  localData.codeSnippets.splice(index, 1)
  delete snippetLanguages.value[index]
  delete detectedLanguages.value[index]
  if (localData.codeSnippets.length === 0) {
    localData.codeSnippets.push('')
  }
}

const handleNext = () => {
  emit('next')
}
</script>

<!-- NO <style> tag - All styles defined in theme files -->
