<template>
  <div class="space-y-4">
    <div
      v-for="param in params"
      :key="param.name"
      class="space-y-2"
    >
      <!-- Label -->
      <label class="block text-sm font-medium text-gray-700">
        {{ param.label }}
        <span v-if="param.required" class="text-red-500">*</span>
      </label>

      <!-- Description -->
      <p v-if="param.description" class="text-xs text-gray-500 -mt-1">
        {{ param.description }}
      </p>

      <!-- Text Input -->
      <input
        v-if="param.type === 'text'"
        v-model="formData[param.name]"
        @input="updateModel"
        type="text"
        :placeholder="param.placeholder"
        :required="param.required"
        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
      />

      <!-- Textarea -->
      <textarea
        v-else-if="param.type === 'textarea'"
        v-model="formData[param.name]"
        @input="updateModel"
        :placeholder="param.placeholder"
        :required="param.required"
        :rows="param.rows || 4"
        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition font-mono text-sm"
      ></textarea>

      <!-- Number Input -->
      <input
        v-else-if="param.type === 'number'"
        v-model.number="formData[param.name]"
        @input="updateModel"
        type="number"
        :placeholder="param.placeholder"
        :required="param.required"
        :min="param.min"
        :max="param.max"
        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
      />

      <!-- Select -->
      <select
        v-else-if="param.type === 'select'"
        v-model="formData[param.name]"
        @change="updateModel"
        :required="param.required"
        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white"
      >
        <option value="">Select an option</option>
        <option
          v-for="option in param.options"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>

      <!-- Checkbox -->
      <div v-else-if="param.type === 'checkbox'" class="flex items-center">
        <input
          v-model="formData[param.name]"
          @change="updateModel"
          type="checkbox"
          :id="`${toolId}-${param.name}`"
          class="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label :for="`${toolId}-${param.name}`" class="text-sm text-gray-700">
          {{ param.label }}
        </label>
      </div>

      <!-- File Input (for future use) -->
      <input
        v-else-if="param.type === 'file'"
        @change="handleFileChange($event, param.name)"
        type="file"
        :required="param.required"
        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
      />
    </div>

    <!-- No parameters message -->
    <div v-if="!params || params.length === 0" class="text-center py-6">
      <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <i class="fas fa-info-circle text-gray-400 text-2xl mb-2"></i>
        <p class="text-sm text-gray-600">
          This tool doesn't require any input parameters.
        </p>
        <p class="text-xs text-gray-500 mt-1">
          Click "Execute" to run the tool.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue';
import type { ToolParam } from '../../config/tool-params';

const props = defineProps<{
  toolId: string;
  params: ToolParam[];
  modelValue: Record<string, any>;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, any>];
}>();

const formData = ref<Record<string, any>>({});

// Initialize form data with default values
const initializeFormData = () => {
  const data: Record<string, any> = {};

  if (props.params) {
    props.params.forEach(param => {
      if (param.default !== undefined) {
        data[param.name] = param.default;
      } else if (param.type === 'checkbox') {
        data[param.name] = false;
      } else if (param.type === 'number') {
        data[param.name] = param.min || 0;
      } else {
        data[param.name] = '';
      }
    });
  }

  // Merge with provided modelValue
  if (props.modelValue && Object.keys(props.modelValue).length > 0) {
    Object.assign(data, props.modelValue);
  }

  formData.value = data;
  updateModel();
};

const updateModel = () => {
  emit('update:modelValue', formData.value);
};

const handleFileChange = (event: Event, paramName: string) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      formData.value[paramName] = e.target?.result;
      updateModel();
    };
    reader.readAsText(file);
  }
};

// Initialize on mount
onMounted(() => {
  initializeFormData();
});

// Watch for tool changes
watch(() => props.toolId, () => {
  initializeFormData();
});

// Watch for param changes
watch(() => props.params, () => {
  initializeFormData();
}, { deep: true });
</script>
