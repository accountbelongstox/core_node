<template>
  <div class="css-formatter-tool">
    <div class="tool-header">
      <h3>CSS Formatter</h3>
      <p class="tool-description">Format, beautify, and minify CSS code</p>
    </div>

    <div class="options-section">
      <div class="option-group">
        <label>Indent Size</label>
        <select v-model.number="indentSize" class="select-field">
          <option :value="2">2 spaces</option>
          <option :value="4">4 spaces</option>
        </select>
      </div>
      <label class="checkbox-label">
        <input type="checkbox" v-model="sortProperties" />
        Sort Properties
      </label>
      <label class="checkbox-label">
        <input type="checkbox" v-model="openBraceNewline" />
        Brace on New Line
      </label>
    </div>

    <div class="editor-section">
      <div class="editor-group">
        <div class="editor-header">
          <label>Input CSS</label>
          <button @click="loadExample" class="btn-small">Example</button>
        </div>
        <textarea 
          v-model="inputCss" 
          placeholder="Paste your CSS code here..."
          class="code-textarea"
        ></textarea>
      </div>
      <div class="editor-group">
        <div class="editor-header">
          <label>Formatted Output</label>
          <button @click="copyOutput" class="btn-small">Copy</button>
        </div>
        <textarea 
          v-model="outputCss" 
          readonly
          class="code-textarea output"
        ></textarea>
      </div>
    </div>

    <div class="actions">
      <button @click="minifyCss" class="btn-secondary">Minify</button>
      <button @click="formatCss" class="btn-primary">Format</button>
    </div>

    <div class="stats-section" v-if="stats.original > 0">
      <div class="stat-item">
        <span class="stat-label">Original</span>
        <span class="stat-value">{{ stats.original }} bytes</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Formatted</span>
        <span class="stat-value">{{ stats.formatted }} bytes</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Difference</span>
        <span :class="['stat-value', stats.diff > 0 ? 'increase' : 'decrease']">
          {{ stats.diff > 0 ? '+' : '' }}{{ stats.diff }} bytes
        </span>
      </div>
    </div>

    <div v-if="error" class="error-message">{{ error }}</div>
    <div v-if="copied" class="copy-notification">Copied to clipboard!</div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';

const inputCss = ref('');
const outputCss = ref('');
const indentSize = ref(2);
const sortProperties = ref(false);
const openBraceNewline = ref(false);
const error = ref('');
const copied = ref(false);

const stats = reactive({
  original: 0,
  formatted: 0,
  diff: 0
});

const formatCss = () => {
  if (!inputCss.value.trim()) {
    outputCss.value = '';
    error.value = '';
    stats.original = 0;
    stats.formatted = 0;
    stats.diff = 0;
    return;
  }

  try {
    error.value = '';
    let css = inputCss.value;
    const indent = ' '.repeat(indentSize.value);
    
    // Remove existing formatting
    css = css.replace(/\s+/g, ' ').trim();
    
    let formatted = '';
    let indentLevel = 0;
    let inValue = false;
    let buffer = '';
    
    for (let i = 0; i < css.length; i++) {
      const char = css[i];
      
      if (char === '{') {
        if (openBraceNewline.value) {
          formatted += buffer.trim() + '\n' + indent.repeat(indentLevel) + '{\n';
        } else {
          formatted += buffer.trim() + ' {\n';
        }
        buffer = '';
        indentLevel++;
      } else if (char === '}') {
        if (buffer.trim()) {
          formatted += indent.repeat(indentLevel) + buffer.trim() + '\n';
        }
        indentLevel = Math.max(0, indentLevel - 1);
        formatted += indent.repeat(indentLevel) + '}\n\n';
        buffer = '';
      } else if (char === ';') {
        formatted += indent.repeat(indentLevel) + buffer.trim() + ';\n';
        buffer = '';
      } else if (char === ':' && !inValue) {
        buffer += ': ';
        inValue = true;
      } else if (char === ';' || char === '{' || char === '}') {
        inValue = false;
        buffer += char;
      } else {
        buffer += char;
      }
    }
    
    if (buffer.trim()) {
      formatted += buffer.trim();
    }
    
    // Clean up extra newlines
    formatted = formatted.replace(/\n{3,}/g, '\n\n').trim();
    
    outputCss.value = formatted;
    
    stats.original = inputCss.value.length;
    stats.formatted = outputCss.value.length;
    stats.diff = stats.formatted - stats.original;
  } catch (err) {
    error.value = 'Error formatting CSS. Please check your input.';
  }
};

const minifyCss = () => {
  if (!inputCss.value.trim()) return;
  
  try {
    error.value = '';
    let css = inputCss.value;
    
    // Remove comments
    css = css.replace(/\/\*[\s\S]*?\*\//g, '');
    // Remove newlines and extra spaces
    css = css.replace(/\s+/g, ' ');
    // Remove spaces around special characters
    css = css.replace(/\s*([{};:,])\s*/g, '$1');
    // Remove last semicolon before closing brace
    css = css.replace(/;}/g, '}');
    // Trim
    css = css.trim();
    
    outputCss.value = css;
    
    stats.original = inputCss.value.length;
    stats.formatted = outputCss.value.length;
    stats.diff = stats.formatted - stats.original;
  } catch (err) {
    error.value = 'Error minifying CSS.';
  }
};

const loadExample = () => {
  inputCss.value = `.container{display:flex;flex-direction:column;gap:20px;padding:16px;}.header{background:#667eea;color:white;padding:12px 24px;border-radius:8px;}.content{flex:1;min-height:200px;}.footer{text-align:center;color:#64748b;font-size:12px;}`;
  formatCss();
};

const copyOutput = async () => {
  await navigator.clipboard.writeText(outputCss.value);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
};

watch([indentSize, sortProperties, openBraceNewline], () => {
  if (inputCss.value) formatCss();
});
</script>

<style scoped>
.css-formatter-tool {
  padding: 20px;
}
.options-section {
  display: flex;
  gap: 20px;
  align-items: center;
  margin: 20px 0;
}
.option-group {
  display: flex;
  align-items: center;
  gap: 8px;
}
.select-field {
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.editor-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
.editor-group {
  display: flex;
  flex-direction: column;
}
.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.btn-small {
  padding: 4px 12px;
  background: #e2e8f0;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}
.code-textarea {
  height: 350px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
}
.code-textarea.output {
  background: #1e293b;
  color: #e2e8f0;
}
.actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}
.btn-primary, .btn-secondary {
  padding: 10px 24px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.btn-primary {
  background: #667eea;
  color: white;
}
.btn-secondary {
  background: #e2e8f0;
  color: #334155;
}
.stats-section {
  display: flex;
  gap: 24px;
  margin-top: 20px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
}
.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat-label {
  font-size: 12px;
  color: #64748b;
}
.stat-value {
  font-weight: 600;
}
.stat-value.increase {
  color: #ef4444;
}
.stat-value.decrease {
  color: #22c55e;
}
.error-message {
  margin-top: 16px;
  padding: 12px;
  background: #fef2f2;
  color: #ef4444;
  border-radius: 6px;
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

