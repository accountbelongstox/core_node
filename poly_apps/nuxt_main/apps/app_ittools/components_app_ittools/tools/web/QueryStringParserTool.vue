<template>
  <div class="query-string-parser-tool">
    <div class="tool-header">
      <h3>Query String Parser</h3>
      <p class="tool-description">Parse and manipulate URL query strings</p>
    </div>

    <div class="mode-tabs">
      <button 
        :class="['tab-btn', { active: mode === 'parse' }]"
        @click="mode = 'parse'"
      >
        Parse
      </button>
      <button 
        :class="['tab-btn', { active: mode === 'build' }]"
        @click="mode = 'build'"
      >
        Build
      </button>
    </div>

    <div v-if="mode === 'parse'" class="parse-section">
      <div class="input-group">
        <label>Query String or URL</label>
        <textarea 
          v-model="inputQuery" 
          placeholder="Enter query string or full URL (e.g., ?name=John&age=30 or https://example.com?id=123)"
          class="input-textarea"
        ></textarea>
      </div>

      <div v-if="parsedParams.length > 0" class="results-section">
        <h4>Parsed Parameters ({{ parsedParams.length }})</h4>
        <div class="params-table">
          <div class="param-row header">
            <span>Key</span>
            <span>Value</span>
            <span>Decoded Value</span>
          </div>
          <div v-for="(param, index) in parsedParams" :key="index" class="param-row">
            <span class="param-key">{{ param.key }}</span>
            <span class="param-value">{{ param.rawValue }}</span>
            <span class="param-decoded">{{ param.decodedValue }}</span>
          </div>
        </div>

        <div class="export-options">
          <button @click="exportAsJson" class="btn-secondary">Export JSON</button>
          <button @click="copyAsObject" class="btn-secondary">Copy as Object</button>
        </div>
      </div>
    </div>

    <div v-if="mode === 'build'" class="build-section">
      <div class="params-editor">
        <h4>Parameters</h4>
        <div v-for="(param, index) in buildParams" :key="index" class="param-edit-row">
          <input 
            type="text" 
            v-model="param.key" 
            placeholder="Key"
            class="input-field"
          />
          <input 
            type="text" 
            v-model="param.value" 
            placeholder="Value"
            class="input-field"
          />
          <button @click="removeParam(index)" class="btn-remove">x</button>
        </div>
        <button @click="addParam" class="btn-add">+ Add Parameter</button>
      </div>

      <div class="options-section">
        <label class="checkbox-label">
          <input type="checkbox" v-model="encodeValues" />
          URL Encode Values
        </label>
        <label class="checkbox-label">
          <input type="checkbox" v-model="includeEmpty" />
          Include Empty Values
        </label>
      </div>

      <div class="output-section">
        <label>Generated Query String</label>
        <div class="output-box">
          <code>{{ generatedQueryString }}</code>
          <button @click="copyGenerated" class="btn-copy">Copy</button>
        </div>
      </div>
    </div>

    <div v-if="copied" class="copy-notification">{{ copyMessage }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

const mode = ref('parse');
const inputQuery = ref('');
const copied = ref(false);
const copyMessage = ref('Copied!');

interface ParsedParam {
  key: string;
  rawValue: string;
  decodedValue: string;
}

interface BuildParam {
  key: string;
  value: string;
}

const buildParams = ref<BuildParam[]>([
  { key: '', value: '' }
]);
const encodeValues = ref(true);
const includeEmpty = ref(false);

const parsedParams = computed((): ParsedParam[] => {
  if (!inputQuery.value.trim()) return [];

  try {
    let queryString = inputQuery.value.trim();
    
    // Extract query string from URL if full URL provided
    if (queryString.includes('?')) {
      queryString = queryString.split('?')[1];
    }
    
    // Remove leading ? if present
    if (queryString.startsWith('?')) {
      queryString = queryString.substring(1);
    }
    
    // Remove hash fragment if present
    if (queryString.includes('#')) {
      queryString = queryString.split('#')[0];
    }

    const params: ParsedParam[] = [];
    const pairs = queryString.split('&');
    
    for (const pair of pairs) {
      if (!pair) continue;
      
      const [key, ...valueParts] = pair.split('=');
      const rawValue = valueParts.join('=') || '';
      
      let decodedValue = rawValue;
      try {
        decodedValue = decodeURIComponent(rawValue);
      } catch {
        // Keep raw value if decoding fails
      }
      
      params.push({
        key: decodeURIComponent(key),
        rawValue,
        decodedValue
      });
    }
    
    return params;
  } catch {
    return [];
  }
});

const generatedQueryString = computed(() => {
  const params = buildParams.value.filter(p => {
    if (!p.key) return false;
    if (!includeEmpty.value && !p.value) return false;
    return true;
  });

  if (params.length === 0) return '';

  const pairs = params.map(p => {
    const key = encodeURIComponent(p.key);
    const value = encodeValues.value ? encodeURIComponent(p.value) : p.value;
    return `${key}=${value}`;
  });

  return '?' + pairs.join('&');
});

const addParam = () => {
  buildParams.value.push({ key: '', value: '' });
};

const removeParam = (index: number) => {
  if (buildParams.value.length > 1) {
    buildParams.value.splice(index, 1);
  }
};

const exportAsJson = async () => {
  const obj: Record<string, string> = {};
  parsedParams.value.forEach(p => {
    obj[p.key] = p.decodedValue;
  });
  await navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
  copyMessage.value = 'JSON copied!';
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
};

const copyAsObject = async () => {
  const obj: Record<string, string> = {};
  parsedParams.value.forEach(p => {
    obj[p.key] = p.decodedValue;
  });
  const objStr = '{\n' + 
    Object.entries(obj).map(([k, v]) => `  "${k}": "${v}"`).join(',\n') + 
    '\n}';
  await navigator.clipboard.writeText(objStr);
  copyMessage.value = 'Object copied!';
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
};

const copyGenerated = async () => {
  await navigator.clipboard.writeText(generatedQueryString.value);
  copyMessage.value = 'Query string copied!';
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
};

// When parsing a query, offer to switch to build mode with params
watch(parsedParams, (params) => {
  if (params.length > 0 && mode.value === 'parse') {
    buildParams.value = params.map(p => ({
      key: p.key,
      value: p.decodedValue
    }));
  }
});
</script>

<style scoped>
.query-string-parser-tool {
  padding: 20px;
}
.mode-tabs {
  display: flex;
  gap: 8px;
  margin: 20px 0;
}
.tab-btn {
  flex: 1;
  padding: 12px;
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}
.tab-btn.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}
.input-group {
  margin-bottom: 20px;
}
.input-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}
.input-textarea {
  width: 100%;
  height: 100px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-family: monospace;
  resize: vertical;
}
.results-section {
  margin-top: 24px;
}
.params-table {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}
.param-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
}
.param-row:last-child {
  border-bottom: none;
}
.param-row.header {
  background: #f1f5f9;
  font-weight: 600;
}
.param-key {
  color: #667eea;
  font-weight: 500;
}
.param-value, .param-decoded {
  font-family: monospace;
  word-break: break-all;
}
.export-options {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}
.params-editor {
  margin-bottom: 20px;
}
.param-edit-row {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}
.input-field {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}
.btn-remove {
  padding: 10px 16px;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.btn-add {
  padding: 10px 20px;
  background: #f1f5f9;
  border: 1px dashed #cbd5e1;
  border-radius: 6px;
  cursor: pointer;
  width: 100%;
}
.options-section {
  display: flex;
  gap: 20px;
  margin: 20px 0;
}
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.output-section {
  margin-top: 24px;
}
.output-section label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}
.output-box {
  display: flex;
  gap: 12px;
  background: #1e293b;
  padding: 16px;
  border-radius: 8px;
}
.output-box code {
  flex: 1;
  color: #94a3b8;
  word-break: break-all;
  font-family: monospace;
}
.btn-copy, .btn-secondary {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.btn-copy {
  background: #667eea;
  color: white;
}
.btn-secondary {
  background: #e2e8f0;
  color: #334155;
}
.copy-notification {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: #22c55e;
  color: white;
  padding: 12px 20px;
  border-radius: 6px;
}
</style>

