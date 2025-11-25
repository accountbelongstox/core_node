<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50/70">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-file-code text-blue-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">Converter</span>
          <button
            @click="$emit('close')"
            class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/70 transition"
            title="Close"
          >
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid gap-6 lg:grid-cols-5">
        <div class="lg:col-span-2 space-y-6">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Mode</label>
            <div class="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                class="px-4 py-2 text-sm font-medium rounded-lg transition"
                :class="isEncodeMode ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'"
                @click="switchMode('encode')"
              >
                Encode File
              </button>
              <button
                class="px-4 py-2 text-sm font-medium rounded-lg transition"
                :class="!isEncodeMode ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'"
                @click="switchMode('decode')"
              >
                Decode Base64
              </button>
            </div>
          </div>

          <div class="space-y-3 text-xs text-slate-500 leading-relaxed">
            <p>
              Encoding turns any uploaded file into a Base64 data string, perfect for embedding assets in JSON, HTML, or API payloads.
            </p>
            <p>
              Decoding restores a Base64 string back into its original binary file. Supply a filename to download it once decoded.
            </p>
          </div>

          <div v-if="isEncodeMode" class="border border-slate-200 rounded-xl bg-white shadow-sm">
            <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-slate-700">Selected File</h3>
                <p class="text-xs text-slate-500">Drop a file or browse from your device.</p>
              </div>
              <button
                v-if="selectedFile"
                @click="clearFile"
                class="text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition"
              >
                Clear
              </button>
            </header>
            <div
              class="px-5 py-6"
              :class="[
                'transition rounded-lg border-2 border-dashed text-center space-y-3',
                dragging ? 'border-blue-400 bg-blue-50/40 text-blue-500' : 'border-slate-200 bg-slate-50/60 text-slate-500'
              ]"
              @dragover.prevent="dragging = true"
              @dragleave.prevent="dragging = false"
              @drop.prevent="onFileDrop"
            >
              <div class="text-4xl"><i class="fas fa-cloud-upload-alt"></i></div>
              <div class="text-sm">
                <p class="font-medium text-slate-700">Drag &amp; drop file here</p>
                <p class="text-xs text-slate-500">PNG, JPG, JSON, ZIP, PDF… up to 10 MB recommended.</p>
              </div>
              <div>
                <label class="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg shadow hover:bg-blue-700 cursor-pointer">
                  <i class="fas fa-folder-open mr-2"></i>
                  Browse Files
                  <input ref="fileInput" type="file" class="hidden" @change="onFileChange">
                </label>
              </div>
              <div v-if="selectedFile" class="text-left mt-4 bg-white/80 rounded-lg p-4 shadow-sm border border-slate-200">
                <p class="text-sm font-semibold text-slate-700 truncate">{{ selectedFile.name }}</p>
                <p class="text-xs text-slate-500 mt-1">{{ formatSize(selectedFile.size) }} · {{ selectedFile.type || 'application/octet-stream' }}</p>
                <p class="text-xs text-slate-400">Last modified: {{ formatDate(selectedFile.lastModified) }}</p>
              </div>
            </div>
          </div>

          <div v-else class="border border-slate-200 rounded-xl bg-white shadow-sm">
            <header class="px-5 py-4 border-b border-slate-200">
              <h3 class="text-sm font-semibold text-slate-700">Decoded File Settings</h3>
              <p class="text-xs text-slate-500">Provide a filename for the restored file.</p>
            </header>
            <div class="px-5 py-4 space-y-3">
              <label class="block text-xs font-medium text-slate-600">Download Filename</label>
              <input
                v-model="outputFileName"
                type="text"
                class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="decoded-file.bin"
              >
              <p class="text-xs text-slate-400">Extension will help your OS pick the right default app.</p>
            </div>
          </div>
        </div>

        <div class="lg:col-span-3 space-y-5">
          <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
            <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-slate-700">{{ isEncodeMode ? 'File Content (preview)' : 'Base64 Input' }}</h3>
                <p class="text-xs text-slate-500">
                  {{ isEncodeMode ? 'Optional preview of the file contents before encoding.' : 'Paste raw Base64 or data URI to decode.' }}
                </p>
              </div>
              <button
                v-if="!isEncodeMode && base64Input"
                @click="base64Input = ''"
                class="text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition"
              >
                Clear
              </button>
            </header>
            <div class="px-5 py-4 space-y-3">
              <template v-if="isEncodeMode">
                <p v-if="!selectedFile" class="text-xs text-slate-400">
                  Select a file to preview the first few bytes as a Base64 string. The full file still uploads for encoding.
                </p>
                <div v-else class="bg-slate-900/95 text-emerald-300 font-mono text-xs rounded-lg p-4 max-h-48 overflow-auto">
                  <pre>{{ filePreview }}</pre>
                </div>
              </template>
              <template v-else>
                <textarea
                  v-model="base64Input"
                  rows="10"
                  class="w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition font-mono text-xs"
                  placeholder="data:image/png;base64,iVBORw0KGgo..."
                ></textarea>
              </template>
            </div>
          </section>

          <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
            <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-slate-700">{{ isEncodeMode ? 'Base64 Output' : 'Decoded File' }}</h3>
                <p class="text-xs text-slate-500">
                  {{ isEncodeMode ? 'Copy the Base64 data or download as text.' : 'Download the reconstructed file when ready.' }}
                </p>
              </div>
              <div class="flex items-center space-x-2 text-xs text-slate-400">
                <i class="fas fa-stopwatch"></i>
                <span v-if="executionTime">{{ executionTime }} ms</span>
              </div>
            </header>
            <div class="relative px-5 py-4 space-y-3">
              <div v-if="loading" class="absolute inset-0 bg-white/70 flex items-center justify-center">
                <i class="fas fa-spinner fa-spin text-blue-600 text-xl"></i>
              </div>

              <template v-if="isEncodeMode">
                <textarea
                  v-model="output"
                  rows="10"
                  readonly
                  class="w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm bg-slate-900 text-emerald-300 font-mono text-xs"
                ></textarea>
                <div class="flex items-center justify-between text-xs text-slate-500">
                  <span>{{ output ? 'Length: ' + output.length + ' chars' : 'No output yet' }}</span>
                  <div class="flex items-center space-x-2">
                    <button
                      @click="copyOutput"
                      :disabled="!output"
                      class="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      <i class="fas fa-copy mr-1"></i>
                      Copy
                    </button>
                    <button
                      @click="downloadBase64"
                      :disabled="!output"
                      class="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      <i class="fas fa-download mr-1"></i>
                      Save .txt
                    </button>
                  </div>
                </div>
              </template>

              <template v-else>
                <div
                  class="border border-slate-200 rounded-lg p-4 bg-slate-50 text-sm text-slate-600 flex items-start justify-between"
                >
                  <div>
                    <p class="font-semibold text-slate-700">{{ outputFileName || 'decoded-file.bin' }}</p>
                    <p class="text-xs text-slate-500 mt-1">
                      {{ decodedMimeType || 'application/octet-stream' }}
                      <span v-if="decodedSize" class="ml-2">· {{ formatSize(decodedSize) }}</span>
                    </p>
                  </div>
                  <button
                    @click="downloadDecodedFile"
                    :disabled="!decodedFileUrl"
                    class="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <i class="fas fa-file-download mr-1"></i>
                    Download
                  </button>
                </div>
                <p v-if="!decodedFileUrl" class="text-xs text-slate-400">Run a decode to enable download.</p>
              </template>

              <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
            </div>
          </section>
        </div>
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex items-center justify-between">
      <button
        @click="convert"
        :disabled="!canConvert"
        class="px-5 py-2 rounded-lg bg-blue-600 text-white font-medium shadow hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
      >
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
        <i v-else class="fas mr-2" :class="isEncodeMode ? 'fa-arrow-down' : 'fa-arrow-up'"></i>
        {{ isEncodeMode ? 'Encode to Base64' : 'Decode to File' }}
      </button>
      <span class="text-xs text-slate-500">Endpoint: <code class="text-slate-700">/converter/base64/file/{{ isEncodeMode ? 'encode' : 'decode' }}</code></span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { Tool } from '../../../types';
import { ItToolsMainAPI } from '../../../services/ittools-main-api';

const props = defineProps<{
  tool: Tool;
  api: ItToolsMainAPI;
}>();

const emit = defineEmits<{
  close: [];
  executed: [result: any];
}>();

const mode = ref<'encode' | 'decode'>('encode');
const selectedFile = ref<File | null>(null);
const base64Input = ref('');
const filePreview = ref('');
const output = ref('');
const outputFileName = ref('decoded-file.bin');
const decodedFileUrl = ref<string | null>(null);
const decodedMimeType = ref<string | null>(null);
const decodedSize = ref<number | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);
const dragging = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const isEncodeMode = computed(() => mode.value === 'encode');

const canConvert = computed(() => {
  if (loading.value) return false;
  return isEncodeMode.value ? !!selectedFile.value : base64Input.value.trim().length > 0;
});

const switchMode = (nextMode: 'encode' | 'decode') => {
  if (mode.value === nextMode) return;
  mode.value = nextMode;
  if (nextMode === 'encode') {
    base64Input.value = '';
  } else {
    clearFile();
  }
  clearResults();
};

const clearResults = () => {
  error.value = null;
  executionTime.value = null;
  output.value = '';
  decodedMimeType.value = null;
  decodedSize.value = null;
  revokeDecodedUrl();
};

const clearFile = () => {
  selectedFile.value = null;
  filePreview.value = '';
  dragging.value = false;
  if (fileInput.value) fileInput.value.value = '';
};

const onFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement | null;
  handleFiles(target?.files ?? null);
};

const onFileDrop = (event: DragEvent) => {
  dragging.value = false;
  handleFiles(event.dataTransfer?.files ?? null);
};

const handleFiles = (files: FileList | null) => {
  if (!files || files.length === 0) {
    clearFile();
    return;
  }
  const file = files[0];
  selectedFile.value = file;
  previewFile(file);
};

const previewFile = (file: File) => {
  filePreview.value = '';
  const reader = new FileReader();
  reader.onload = () => {
    const result = reader.result as string;
    const previewChunk = result.split(',')[1] ?? '';
    filePreview.value = previewChunk ? `${previewChunk.slice(0, 320)}${previewChunk.length > 320 ? '…' : ''}` : '';
  };
  reader.onerror = () => {
    filePreview.value = '';
  };
  reader.readAsDataURL(file);
};

const readFileAsBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      if (!base64) {
        reject(new Error('Failed to read file as Base64.'));
      } else {
        resolve(base64);
      }
    };
    reader.onerror = () => reject(reader.error || new Error('Unable to read file.'));
    reader.readAsDataURL(file);
  });
};

const convert = async () => {
  if (!canConvert.value) return;

  loading.value = true;
  error.value = null;
  executionTime.value = null;
  decodedMimeType.value = null;
  decodedSize.value = null;
  output.value = '';

  const start = performance.now();

  try {
    if (isEncodeMode.value) {
      if (!selectedFile.value) {
        throw new Error('Please select a file to encode.');
      }

      const base64Payload = await readFileAsBase64(selectedFile.value);
      const response = await props.api.base64FileEncode(base64Payload, selectedFile.value.name);
      executionTime.value = Math.round(performance.now() - start);

      if (response.success && response.data?.encoded) {
        output.value = response.data.encoded;
        decodedSize.value = response.data.size ?? selectedFile.value.size;
        emit('executed', response.data);
      } else {
        throw new Error(response.error || response.message || 'Encoding failed');
      }
    } else {
      const payload = base64Input.value.trim();
      if (!payload) {
        throw new Error('Provide Base64 content to decode.');
      }

      const response = await props.api.base64FileDecode(payload);
      executionTime.value = Math.round(performance.now() - start);

      if (response.success && response.data?.fileData) {
        const { fileData, mimeType, size } = response.data;
        const parsed = parseBase64Blob(fileData, mimeType);
        const blob = base64ToBlob(parsed.base64, parsed.mimeType);
        decodedSize.value = size ?? blob.size;
        decodedMimeType.value = parsed.mimeType;
        updateDecodedUrl(blob);
        if (!outputFileName.value) {
          outputFileName.value = `decoded-file${guessExtension(parsed.mimeType)}`;
        }
        emit('executed', response.data);
      } else {
        throw new Error(response.error || response.message || 'Decoding failed');
      }
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    error.value = err?.message || 'Base64 file service unavailable';
    revokeDecodedUrl();
  } finally {
    loading.value = false;
  }
};

const copyOutput = async () => {
  if (!output.value) return;
  try {
    await navigator.clipboard.writeText(output.value);
  } catch (err) {
    console.error('Copy failed:', err);
  }
};

const downloadBase64 = () => {
  if (!output.value) return;
  const blob = new Blob([output.value], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${selectedFile.value?.name || 'encoded-file'}.base64.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const downloadDecodedFile = () => {
  if (!decodedFileUrl.value) return;
  const link = document.createElement('a');
  link.href = decodedFileUrl.value;
  link.download = outputFileName.value || `decoded-file${guessExtension(decodedMimeType.value)}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const updateDecodedUrl = (blob: Blob) => {
  revokeDecodedUrl();
  decodedFileUrl.value = URL.createObjectURL(blob);
};

const revokeDecodedUrl = () => {
  if (decodedFileUrl.value) {
    URL.revokeObjectURL(decodedFileUrl.value);
    decodedFileUrl.value = null;
  }
};

const parseBase64Blob = (input: string, fallbackMime?: string | null) => {
  if (input.startsWith('data:')) {
    const [header, data] = input.split(',');
    const match = /^data:(.*?);base64$/i.exec(header || '');
    return {
      base64: data || '',
      mimeType: match?.[1] || fallbackMime || 'application/octet-stream'
    };
  }
  return {
    base64: input,
    mimeType: fallbackMime || 'application/octet-stream'
  };
};

const base64ToBlob = (base64: string, mimeType: string) => {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
};

const formatSize = (size: number | null | undefined) => {
  if (!size && size !== 0) return 'unknown size';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const formatDate = (timestamp: number) => {
  try {
    return new Date(timestamp).toLocaleString();
  } catch (err) {
    return 'Unknown';
  }
};

const guessExtension = (mime: string | null | undefined) => {
  if (!mime) return '.bin';
  const map: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
    'application/json': '.json',
    'application/pdf': '.pdf',
    'text/plain': '.txt',
    'application/zip': '.zip'
  };
  return map[mime] || '.bin';
};

watch(mode, (value) => {
  if (value === 'decode') {
    decodedSize.value = null;
    decodedMimeType.value = null;
  }
});

onBeforeUnmount(() => {
  revokeDecodedUrl();
});
</script>
