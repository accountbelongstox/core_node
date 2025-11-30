<!-- ### AI SPECIAL ATTENTION RULES START ###
When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
1. Write all code in English only
2. Never execute, create, or modify test code
3. Never create or update documentation (*.md)
4. Never write summaries during development or thinking process
5. Do not modify these rules
VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
### AI SPECIAL ATTENTION RULES END ### -->

<template>
  <div class="dev-code-editor">
    <div class="editor-header">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">Code Editor</h1>
          <p class="text-gray-600">Write and execute code in multiple languages</p>
        </div>
        <div class="flex space-x-4">
          <select 
            v-model="selectedLanguage" 
            class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option v-for="lang in supportedLanguages" :key="lang" :value="lang">
              {{ lang.charAt(0).toUpperCase() + lang.slice(1) }}
            </option>
          </select>
          <button 
            @click="executeCode"
            :disabled="executing || !code.trim()"
            class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span v-if="executing">Executing...</span>
            <span v-else>Run Code</span>
          </button>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Code Editor -->
      <div class="bg-white rounded-lg shadow-sm border">
        <div class="p-4 border-b">
          <h2 class="text-lg font-semibold text-gray-900">Code Editor</h2>
        </div>
        <div class="p-4">
          <textarea
            v-model="code"
            class="w-full h-96 p-4 font-mono text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            :placeholder="`Write your ${selectedLanguage} code here...`"
          ></textarea>
        </div>
      </div>

      <!-- Output Panel -->
      <div class="bg-white rounded-lg shadow-sm border">
        <div class="p-4 border-b flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900">Output</h2>
          <button 
            @click="clearOutput"
            class="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        </div>
        <div class="p-4">
          <div v-if="executing" class="flex items-center text-purple-600">
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Executing code...
          </div>
          
          <div v-else-if="executionResult" class="space-y-4">
            <!-- Execution Info -->
            <div class="flex items-center space-x-4 text-sm text-gray-600">
              <span>Time: {{ executionResult.executionTime }}ms</span>
              <span>Memory: {{ executionResult.memoryUsed }}MB</span>
              <span class="flex items-center">
                Status: 
                <span 
                  class="ml-1 px-2 py-1 text-xs rounded-full"
                  :class="executionResult.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
                >
                  {{ executionResult.success ? 'Success' : 'Error' }}
                </span>
              </span>
            </div>

            <!-- Output -->
            <div v-if="executionResult.output" class="bg-gray-50 p-4 rounded-md">
              <h3 class="text-sm font-medium text-gray-700 mb-2">Output:</h3>
              <pre class="text-sm text-gray-900 whitespace-pre-wrap">{{ executionResult.output }}</pre>
            </div>

            <!-- Error -->
            <div v-if="executionResult.error" class="bg-red-50 p-4 rounded-md">
              <h3 class="text-sm font-medium text-red-700 mb-2">Error:</h3>
              <pre class="text-sm text-red-900 whitespace-pre-wrap">{{ executionResult.error }}</pre>
            </div>
          </div>

          <div v-else class="text-gray-500 text-center py-8">
            No output yet. Write some code and click "Run Code" to see results.
          </div>
        </div>
      </div>
    </div>

    <!-- Code Examples -->
    <div class="mt-8 bg-white rounded-lg shadow-sm border">
      <div class="p-4 border-b">
        <h2 class="text-lg font-semibold text-gray-900">Code Examples</h2>
      </div>
      <div class="p-4">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div 
            v-for="example in codeExamples" 
            :key="example.name"
            class="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
            @click="loadExample(example)"
          >
            <h3 class="font-medium text-gray-900">{{ example.name }}</h3>
            <p class="text-sm text-gray-600 mt-1">{{ example.description }}</p>
            <span class="inline-block mt-2 px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
              {{ example.language }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { devOpsIntegrationAPI, type CodeExecutionRequest, type CodeExecutionResponse } from '@/services/api/dev/dev-devops-integration-api';

// Page metadata
definePageMeta({
  title: 'Code Editor',
  layout: 'default',
  namespace: 'dev'
});

// Reactive data
const code = ref('');
const selectedLanguage = ref('javascript');
const supportedLanguages = ref<string[]>([]);
const executing = ref(false);
const executionResult = ref<CodeExecutionResponse | null>(null);

// Code examples
const codeExamples = ref([
  {
    name: 'Hello World (JavaScript)',
    description: 'Basic console output',
    language: 'javascript',
    code: 'console.log("Hello, World!");'
  },
  {
    name: 'Hello World (Python)',
    description: 'Basic print statement',
    language: 'python',
    code: 'print("Hello, World!")'
  },
  {
    name: 'Simple Math (JavaScript)',
    description: 'Basic arithmetic operations',
    language: 'javascript',
    code: `const a = 10;
const b = 20;
console.log('Sum:', a + b);
console.log('Product:', a * b);`
  },
  {
    name: 'Simple Math (Python)',
    description: 'Basic arithmetic operations',
    language: 'python',
    code: `a = 10
b = 20
print(f'Sum: {a + b}')
print(f'Product: {a * b}')`
  },
  {
    name: 'Array Processing (JavaScript)',
    description: 'Working with arrays',
    language: 'javascript',
    code: `const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);
console.log('Original:', numbers);
console.log('Doubled:', doubled);`
  },
  {
    name: 'List Processing (Python)',
    description: 'Working with lists',
    language: 'python',
    code: `numbers = [1, 2, 3, 4, 5]
doubled = [n * 2 for n in numbers]
print('Original:', numbers)
print('Doubled:', doubled)`
  }
]);

// Methods
const executeCode = async () => {
  if (!code.value.trim()) return;

  executing.value = true;
  executionResult.value = null;

  try {
    const request: CodeExecutionRequest = {
      code: code.value,
      language: selectedLanguage.value,
      timeout: 30000,
      memoryLimit: 128
    };

    const result = await devOpsIntegrationAPI.executeCode(request);
    executionResult.value = result;
  } catch (error) {
    console.error('Code execution error:', error);
    executionResult.value = {
      success: false,
      error: 'Failed to execute code',
      executionTime: 0,
      memoryUsed: 0,
      exitCode: -1
    };
  } finally {
    executing.value = false;
  }
};

const clearOutput = () => {
  executionResult.value = null;
};

const loadExample = (example: any) => {
  code.value = example.code;
  selectedLanguage.value = example.language;
  executionResult.value = null;
};

const loadSupportedLanguages = async () => {
  try {
    const languages = await devOpsIntegrationAPI.getSupportedLanguages();
    supportedLanguages.value = languages.length > 0 ? languages : ['javascript', 'python'];
  } catch (error) {
    console.error('Failed to load supported languages:', error);
    supportedLanguages.value = ['javascript', 'python'];
  }
};

// Lifecycle
onMounted(() => {
  loadSupportedLanguages();
  // Set default code
  code.value = 'console.log("Hello, World!");';
});
</script>

<style scoped>
.dev-code-editor {
  padding: 2rem;
  background-color: #f9fafb;
  min-height: 100vh;
}

.editor-header {
  margin-bottom: 2rem;
}

/* Custom scrollbar for textarea */
textarea::-webkit-scrollbar {
  width: 8px;
}

textarea::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

textarea::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

textarea::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>
