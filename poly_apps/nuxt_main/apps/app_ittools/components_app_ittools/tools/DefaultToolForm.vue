<template>
  <div class="space-y-4">
    <!-- Hash Text Tool Example -->
    <div v-if="isHashTool">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        Text to hash <span class="text-red-500">*</span>
      </label>
      <textarea
        v-model="formData.text"
        @input="updateModel"
        placeholder="Enter text to generate hash..."
        rows="4"
        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      ></textarea>

      <label class="block text-sm font-medium text-gray-700 mb-2 mt-4">
        Algorithm <span class="text-red-500">*</span>
      </label>
      <select
        v-model="formData.algorithm"
        @change="updateModel"
        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value="md5">MD5</option>
        <option value="sha1">SHA-1</option>
        <option value="sha256">SHA-256</option>
        <option value="sha512">SHA-512</option>
      </select>
    </div>

    <!-- Base64 Encode Tool -->
    <div v-else-if="isBase64Encode">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        Text to encode <span class="text-red-500">*</span>
      </label>
      <textarea
        v-model="formData.text"
        @input="updateModel"
        placeholder="Enter text to encode to Base64..."
        rows="6"
        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
      ></textarea>
    </div>

    <!-- Base64 Decode Tool -->
    <div v-else-if="isBase64Decode">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        Base64 text to decode <span class="text-red-500">*</span>
      </label>
      <textarea
        v-model="formData.text"
        @input="updateModel"
        placeholder="Enter Base64 text to decode..."
        rows="6"
        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
      ></textarea>
    </div>

    <!-- UUID Generator Tool -->
    <div v-else-if="isUUIDGenerator">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        Number of UUIDs
      </label>
      <input
        v-model.number="formData.count"
        @input="updateModel"
        type="number"
        min="1"
        max="100"
        placeholder="1"
        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />

      <div class="flex items-center mt-4">
        <input
          v-model="formData.uppercase"
          @change="updateModel"
          type="checkbox"
          id="uppercase"
          class="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label for="uppercase" class="text-sm text-gray-700">
          Uppercase
        </label>
      </div>
    </div>

    <!-- JSON Prettify Tool -->
    <div v-else-if="isJSONPrettify">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        JSON to prettify <span class="text-red-500">*</span>
      </label>
      <textarea
        v-model="formData.json"
        @input="updateModel"
        placeholder='{"key":"value","array":[1,2,3]}'
        rows="8"
        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
      ></textarea>

      <label class="block text-sm font-medium text-gray-700 mb-2 mt-4">
        Indent spaces
      </label>
      <input
        v-model.number="formData.indent"
        @input="updateModel"
        type="number"
        min="1"
        max="8"
        placeholder="2"
        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>

    <!-- URL Encoder Tool -->
    <div v-else-if="isURLEncode">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        Text to encode <span class="text-red-500">*</span>
      </label>
      <textarea
        v-model="formData.text"
        @input="updateModel"
        placeholder="Enter text to URL encode..."
        rows="6"
        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      ></textarea>
    </div>

    <!-- URL Decoder Tool -->
    <div v-else-if="isURLDecode">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        URL encoded text to decode <span class="text-red-500">*</span>
      </label>
      <textarea
        v-model="formData.text"
        @input="updateModel"
        placeholder="Enter URL encoded text to decode..."
        rows="6"
        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      ></textarea>
    </div>

    <!-- Generic fallback -->
    <div v-else>
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p class="text-sm text-blue-800">
          <i class="fas fa-info-circle mr-2"></i>
          This tool's interface is being developed. Please check back soon!
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';

const props = defineProps<{
  modelValue: Record<string, any>;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, any>];
  'execute': [];
}>();

const route = useRoute();
const formData = ref<Record<string, any>>({
  text: '',
  algorithm: 'md5',
  json: '',
  indent: 2,
  count: 1,
  uppercase: false
});

// Detect tool type from URL or parent component
const currentToolId = computed(() => {
  // Try to get from route query or use a default
  return route.query.tool as string || '';
});

const isHashTool = computed(() => currentToolId.value === 'hash_text');
const isBase64Encode = computed(() => currentToolId.value === 'base64_string_converter' || currentToolId.value.includes('base64') && currentToolId.value.includes('encode'));
const isBase64Decode = computed(() => currentToolId.value.includes('base64') && currentToolId.value.includes('decode'));
const isUUIDGenerator = computed(() => currentToolId.value === 'uuid_generator');
const isJSONPrettify = computed(() => currentToolId.value === 'json_prettify');
const isURLEncode = computed(() => currentToolId.value === 'url_encoder' || (currentToolId.value.includes('url') && !currentToolId.value.includes('decode')));
const isURLDecode = computed(() => currentToolId.value === 'url_decoder' || (currentToolId.value.includes('url') && currentToolId.value.includes('decode')));

const updateModel = () => {
  emit('update:modelValue', formData.value);
};

// Initialize with props value
onMounted(() => {
  if (props.modelValue && Object.keys(props.modelValue).length > 0) {
    formData.value = { ...formData.value, ...props.modelValue };
  }
});

// Watch for changes from parent
watch(() => props.modelValue, (newValue) => {
  if (newValue && Object.keys(newValue).length > 0) {
    formData.value = { ...formData.value, ...newValue };
  }
}, { deep: true });
</script>
