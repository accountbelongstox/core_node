<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-slate-700 to-slate-800">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-lock text-amber-400"></i>
            <h2 class="text-2xl font-semibold text-white">PDF Password</h2>
          </div>
          <p class="text-sm text-slate-300">Add or remove PDF password protection</p>
        </div>
        <button @click="$emit('close')" class="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid gap-6 lg:grid-cols-2">
        <div class="space-y-4">
          <div 
            class="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-amber-400 transition cursor-pointer"
            @click="triggerFileInput"
          >
            <input ref="fileInput" type="file" accept=".pdf" class="hidden" @change="handleFileChange" />
            <div v-if="!pdfFile">
              <i class="fas fa-file-pdf text-4xl text-slate-400 mb-3"></i>
              <p class="text-slate-600">Click to upload PDF</p>
            </div>
            <div v-else class="text-center">
              <i class="fas fa-file-pdf text-4xl text-red-500 mb-2"></i>
              <p class="font-medium text-slate-700">{{ pdfFile.name }}</p>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Action</label>
            <div class="grid grid-cols-2 gap-3">
              <button @click="action = 'add'"
                :class="action === 'add' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700'"
                class="px-4 py-3 rounded-lg transition">
                <i class="fas fa-lock mr-2"></i>Add Password
              </button>
              <button @click="action = 'remove'"
                :class="action === 'remove' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700'"
                class="px-4 py-3 rounded-lg transition">
                <i class="fas fa-unlock mr-2"></i>Remove Password
              </button>
            </div>
          </div>

          <div v-if="action === 'add'">
            <label class="block text-sm font-medium text-slate-700 mb-2">New Password</label>
            <div class="relative">
              <input :type="showPassword ? 'text' : 'password'" v-model="newPassword"
                class="w-full px-4 py-3 pr-12 border border-slate-200 rounded-lg" placeholder="Enter password" />
              <button @click="showPassword = !showPassword" 
                class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <i :class="showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
              </button>
            </div>
          </div>

          <div v-if="action === 'remove'">
            <label class="block text-sm font-medium text-slate-700 mb-2">Current Password</label>
            <div class="relative">
              <input :type="showPassword ? 'text' : 'password'" v-model="currentPassword"
                class="w-full px-4 py-3 pr-12 border border-slate-200 rounded-lg" placeholder="Enter current password" />
              <button @click="showPassword = !showPassword"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <i :class="showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
              </button>
            </div>
          </div>

          <div v-if="action === 'add'" class="bg-amber-50 rounded-lg p-4">
            <h4 class="text-sm font-medium text-amber-800 mb-2">Permissions</h4>
            <div class="space-y-2">
              <label class="flex items-center space-x-2">
                <input type="checkbox" v-model="permissions.print" class="rounded text-amber-600" />
                <span class="text-sm text-slate-700">Allow Printing</span>
              </label>
              <label class="flex items-center space-x-2">
                <input type="checkbox" v-model="permissions.copy" class="rounded text-amber-600" />
                <span class="text-sm text-slate-700">Allow Copying</span>
              </label>
              <label class="flex items-center space-x-2">
                <input type="checkbox" v-model="permissions.modify" class="rounded text-amber-600" />
                <span class="text-sm text-slate-700">Allow Modification</span>
              </label>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <h3 class="text-sm font-semibold text-slate-700">Result</h3>

          <div v-if="loading" class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center">
            <i class="fas fa-spinner fa-spin text-amber-600 text-2xl"></i>
          </div>

          <div v-else-if="result" class="space-y-4">
            <div class="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-3">
              <i class="fas fa-check-circle text-green-600 text-2xl"></i>
              <span class="text-green-700 font-medium">
                {{ action === 'add' ? 'Password Added' : 'Password Removed' }}
              </span>
            </div>

            <button @click="downloadResult" class="w-full px-4 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700">
              <i class="fas fa-download mr-2"></i>Download PDF
            </button>
          </div>

          <div v-else class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center text-slate-400">
            <i class="fas fa-lock text-4xl mb-2"></i>
            <p>Upload PDF and configure password</p>
          </div>
        </div>
      </div>

      <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <i class="fas fa-exclamation-circle mr-2"></i>{{ error }}
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex justify-end space-x-3">
      <button @click="reset" class="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-white">Reset</button>
      <button @click="processPassword" :disabled="!pdfFile || loading || (action === 'add' && !newPassword)"
        class="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
        {{ action === 'add' ? 'Add Password' : 'Remove Password' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import type { Tool } from '../../../types_app_ittools';

defineProps<{ tool: Tool }>();
defineEmits<{ close: []; executed: [result: any] }>();

const fileInput = ref<HTMLInputElement>();
const pdfFile = ref<File | null>(null);
const action = ref<'add' | 'remove'>('add');
const newPassword = ref('');
const currentPassword = ref('');
const showPassword = ref(false);
const permissions = reactive({ print: true, copy: true, modify: false });
const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<any>(null);

const triggerFileInput = () => fileInput.value?.click();

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files?.[0]) {
    pdfFile.value = target.files[0];
  }
};

const processPassword = async () => {
  if (!pdfFile.value) return;
  loading.value = true;
  error.value = null;

  try {
    const formData = new FormData();
    formData.append('pdf', pdfFile.value);
    formData.append('action', action.value);
    
    if (action.value === 'add') {
      formData.append('password', newPassword.value);
      formData.append('allow_print', permissions.print.toString());
      formData.append('allow_copy', permissions.copy.toString());
      formData.append('allow_modify', permissions.modify.toString());
    } else {
      formData.append('current_password', currentPassword.value);
    }

    const response = await fetch('/api/ittools/v1/advanced/pdf/add-password', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (data.success && data.data) {
      result.value = data.data;
    } else {
      error.value = data.error || 'Failed to process PDF';
    }
  } catch (err: any) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

const downloadResult = () => {
  if (!result.value?.data) return;
  const blob = new Blob([Uint8Array.from(atob(result.value.data), c => c.charCodeAt(0))], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = action.value === 'add' ? 'protected.pdf' : 'unprotected.pdf';
  a.click();
  URL.revokeObjectURL(url);
};

const reset = () => {
  pdfFile.value = null;
  newPassword.value = '';
  currentPassword.value = '';
  result.value = null;
  error.value = null;
};
</script>

