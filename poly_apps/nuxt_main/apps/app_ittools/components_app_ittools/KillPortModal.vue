<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b">
        <h2 class="text-xl font-semibold text-gray-900">Kill Process by Port</h2>
        <button
          @click="$emit('close')"
          class="text-gray-400 hover:text-gray-600 transition"
        >
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>

      <!-- Body -->
      <div class="p-6">
        <form @submit.prevent="handleSubmit">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Port Number
            </label>
            <input
              v-model.number="formData.port"
              type="number"
              placeholder="3000, 8080, 7096"
              required
              min="1"
              max="65535"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              :class="{ 'border-red-500': errors.port }"
            />
            <p v-if="errors.port" class="text-red-500 text-sm mt-1">{{ errors.port }}</p>
            <p class="text-xs text-gray-500 mt-1">Enter the port number of the process to terminate</p>
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Force Kill
            </label>
            <label class="flex items-center">
              <input
                v-model="formData.force"
                type="checkbox"
                class="mr-2"
              />
              <span class="text-gray-700">Force termination</span>
            </label>
            <p class="text-xs text-gray-500 mt-1">Use force flag to terminate unresponsive processes</p>
          </div>

          <!-- Common Ports -->
          <div class="mb-4">
            <p class="text-sm font-medium text-gray-700 mb-2">Common Development Ports:</p>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                v-for="commonPort in commonPorts"
                :key="commonPort.port"
                @click="formData.port = commonPort.port"
                class="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition"
              >
                {{ commonPort.name }} ({{ commonPort.port }})
              </button>
            </div>
          </div>

          <!-- Warning -->
          <div class="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div class="flex">
              <div class="flex-shrink-0">
                <i class="fas fa-exclamation-triangle text-yellow-400"></i>
              </div>
              <div class="ml-3">
                <h3 class="text-sm font-medium text-yellow-800">Warning</h3>
                <div class="mt-2 text-sm text-yellow-700">
                  <p>Killing a process will terminate it immediately and any unsaved work will be lost. Make sure you have selected the correct port.</p>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end p-6 border-t bg-gray-50 space-x-3">
        <button
          @click="$emit('close')"
          class="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md transition"
        >
          Cancel
        </button>
        <button
          @click="handleSubmit"
          :disabled="isSubmitting"
          class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition disabled:opacity-50"
        >
          <i v-if="isSubmitting" class="fas fa-spinner fa-spin mr-2"></i>
          <i v-else class="fas fa-skull-crossbones mr-2"></i>
          {{ isSubmitting ? 'Killing...' : 'Kill Process' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';

const emit = defineEmits<{
  close: [];
  kill: (data: { port: number; force: boolean }) => void;
}>();

const isSubmitting = ref(false);
const errors = reactive({
  port: ''
});

const formData = reactive({
  port: '',
  force: false
});

const commonPorts = [
  { name: 'Node.js', port: 3000 },
  { name: 'React Dev', port: 3001 },
  { name: 'Vue Dev', port: 8080 },
  { name: 'Angular Dev', port: 4200 },
  { name: 'Laravel', port: 8000 },
  { name: 'Django', port: 8001 },
  { name: 'Flask', port: 5000 },
  { name: 'Rails', port: 3000 },
  { name: 'PHP Dev', port: 9000 },
  { name: 'MongoDB', port: 27017 },
  { name: 'Redis', port: 6379 },
  { name: 'MySQL', port: 3306 },
  { name: 'PostgreSQL', port: 5432 },
  { name: 'Developer Hub', port: 7096 }
];

const validateForm = () => {
  errors.port = '';

  let isValid = true;

  // Validate port
  if (!formData.port) {
    errors.port = 'Port number is required';
    isValid = false;
  } else if (formData.port < 1 || formData.port > 65535) {
    errors.port = 'Port must be between 1 and 65535';
    isValid = false;
  }

  return isValid;
};

const handleSubmit = () => {
  if (!validateForm()) return;

  // Confirmation dialog
  if (!confirm(`Are you sure you want to kill the process using port ${formData.port}? This action cannot be undone.`)) {
    return;
  }

  isSubmitting.value = true;

  const data = {
    port: formData.port,
    force: formData.force
  };

  // Emit with a small delay to show loading state
  setTimeout(() => {
    emit('kill', data);
    isSubmitting.value = false;
    emit('close');
  }, 500);
};
</script>