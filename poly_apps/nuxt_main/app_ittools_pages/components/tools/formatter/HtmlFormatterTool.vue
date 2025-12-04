<template>
  <div class="html-formatter-tool">
    <div class="tool-header">
      <h3>HTML Formatter</h3>
      <p class="tool-description">Format and beautify HTML code</p>
    </div>

    <div class="options-section">
      <div class="option-group">
        <label>Indent Size</label>
        <select v-model.number="indentSize" class="select-field">
          <option :value="2">2 spaces</option>
          <option :value="4">4 spaces</option>
          <option :value="1">1 tab</option>
        </select>
      </div>
      <label class="checkbox-label">
        <input type="checkbox" v-model="preserveNewlines" />
        Preserve Empty Lines
      </label>
      <label class="checkbox-label">
        <input type="checkbox" v-model="wrapAttributes" />
        Wrap Attributes
      </label>
    </div>

    <div class="editor-section">
      <div class="editor-group">
        <div class="editor-header">
          <label>Input HTML</label>
          <button @click="clearInput" class="btn-small">Clear</button>
        </div>
        <textarea 
          v-model="inputHtml" 
          placeholder="Paste your HTML code here..."
          class="code-textarea"
          @input="formatHtml"
        ></textarea>
      </div>
      <div class="editor-group">
        <div class="editor-header">
          <label>Formatted Output</label>
          <button @click="copyOutput" class="btn-small">Copy</button>
        </div>
        <textarea 
          v-model="outputHtml" 
          readonly
          class="code-textarea output"
        ></textarea>
      </div>
    </div>

    <div class="actions">
      <button @click="minifyHtml" class="btn-secondary">Minify</button>
      <button @click="formatHtml" class="btn-primary">Format</button>
    </div>

    <div v-if="error" class="error-message">{{ error }}</div>
    <div v-if="copied" class="copy-notification">Copied to clipboard!</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const inputHtml = ref('');
const outputHtml = ref('');
const indentSize = ref(2);
const preserveNewlines = ref(false);
const wrapAttributes = ref(false);
const error = ref('');
const copied = ref(false);

const formatHtml = () => {
  if (!inputHtml.value.trim()) {
    outputHtml.value = '';
    error.value = '';
    return;
  }

  try {
    error.value = '';
    let html = inputHtml.value;
    
    // Simple HTML formatter
    const indent = indentSize.value === 1 ? '\t' : ' '.repeat(indentSize.value);
    let formatted = '';
    let indentLevel = 0;
    
    // Remove existing formatting
    html = html.replace(/>\s+</g, '><').trim();
    
    // Split into tags and content
    const parts = html.split(/(<[^>]+>)/g).filter(p => p.trim());
    
    const selfClosingTags = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];
    const inlineTags = ['a', 'abbr', 'b', 'bdo', 'br', 'cite', 'code', 'dfn', 'em', 'i', 'img', 'kbd', 'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'u', 'var'];
    
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      
      if (trimmed.startsWith('</')) {
        // Closing tag
        indentLevel = Math.max(0, indentLevel - 1);
        formatted += indent.repeat(indentLevel) + trimmed + '\n';
      } else if (trimmed.startsWith('<')) {
        // Opening tag
        const tagMatch = trimmed.match(/<(\w+)/);
        const tagName = tagMatch ? tagMatch[1].toLowerCase() : '';
        
        let tagContent = trimmed;
        if (wrapAttributes.value && trimmed.includes(' ')) {
          // Wrap attributes on separate lines
          tagContent = trimmed.replace(/\s+(\w+)=/g, `\n${indent.repeat(indentLevel + 1)}$1=`);
        }
        
        formatted += indent.repeat(indentLevel) + tagContent + '\n';
        
        // Only increase indent for non-self-closing and non-void tags
        if (!trimmed.endsWith('/>') && !selfClosingTags.includes(tagName)) {
          indentLevel++;
        }
      } else {
        // Text content
        if (trimmed) {
          formatted += indent.repeat(indentLevel) + trimmed + '\n';
        }
      }
    }
    
    outputHtml.value = formatted.trim();
  } catch (err) {
    error.value = 'Error formatting HTML. Please check your input.';
  }
};

const minifyHtml = () => {
  if (!inputHtml.value.trim()) return;
  
  try {
    error.value = '';
    let html = inputHtml.value;
    
    // Remove comments
    html = html.replace(/<!--[\s\S]*?-->/g, '');
    // Remove newlines and extra spaces
    html = html.replace(/\s+/g, ' ');
    // Remove spaces between tags
    html = html.replace(/>\s+</g, '><');
    // Trim
    html = html.trim();
    
    outputHtml.value = html;
  } catch (err) {
    error.value = 'Error minifying HTML.';
  }
};

const clearInput = () => {
  inputHtml.value = '';
  outputHtml.value = '';
  error.value = '';
};

const copyOutput = async () => {
  await navigator.clipboard.writeText(outputHtml.value);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
};

watch([indentSize, preserveNewlines, wrapAttributes], () => {
  if (inputHtml.value) formatHtml();
});
</script>

<style scoped>
.html-formatter-tool {
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
  height: 400px;
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

