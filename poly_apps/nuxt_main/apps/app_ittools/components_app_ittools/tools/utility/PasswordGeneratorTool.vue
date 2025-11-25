<template>
  <div class="password-generator-tool">
    <div class="tool-header">
      <h3>Password Generator</h3>
      <p class="tool-description">Generate secure, random passwords with customizable options</p>
    </div>

    <div class="password-display">
      <div class="password-box">
        <span class="password-text" :class="{ masked: isMasked }">
          {{ isMasked ? maskedPassword : password }}
        </span>
        <div class="password-actions">
          <button @click="isMasked = !isMasked" class="action-btn" :title="isMasked ? 'Show' : 'Hide'">
            {{ isMasked ? 'visibility' : 'visibility_off' }}
          </button>
          <button @click="copyPassword" class="action-btn" title="Copy">copy</button>
          <button @click="generatePassword" class="action-btn refresh" title="Regenerate">refresh</button>
        </div>
      </div>
      <div class="strength-meter">
        <div class="strength-bar" :style="{ width: strengthPercent + '%' }" :class="strengthClass"></div>
      </div>
      <div class="strength-label" :class="strengthClass">{{ strengthLabel }}</div>
    </div>

    <div class="options-section">
      <div class="length-control">
        <label>Password Length: {{ length }}</label>
        <input type="range" v-model.number="length" min="4" max="64" class="range-slider" />
        <div class="range-labels">
          <span>4</span>
          <span>64</span>
        </div>
      </div>

      <div class="char-options">
        <label class="option-item">
          <input type="checkbox" v-model="options.uppercase" />
          <span class="option-label">Uppercase (A-Z)</span>
          <span class="option-preview">ABCDEFGH</span>
        </label>
        <label class="option-item">
          <input type="checkbox" v-model="options.lowercase" />
          <span class="option-label">Lowercase (a-z)</span>
          <span class="option-preview">abcdefgh</span>
        </label>
        <label class="option-item">
          <input type="checkbox" v-model="options.numbers" />
          <span class="option-label">Numbers (0-9)</span>
          <span class="option-preview">0123456789</span>
        </label>
        <label class="option-item">
          <input type="checkbox" v-model="options.symbols" />
          <span class="option-label">Symbols</span>
          <span class="option-preview">!@#$%^&*</span>
        </label>
        <label class="option-item">
          <input type="checkbox" v-model="options.excludeSimilar" />
          <span class="option-label">Exclude Similar</span>
          <span class="option-preview">il1Lo0O</span>
        </label>
        <label class="option-item">
          <input type="checkbox" v-model="options.excludeAmbiguous" />
          <span class="option-label">Exclude Ambiguous</span>
          <span class="option-preview">{}[]()/\'"</span>
        </label>
      </div>
    </div>

    <div class="bulk-generate">
      <h4>Generate Multiple</h4>
      <div class="bulk-controls">
        <input type="number" v-model.number="bulkCount" min="1" max="100" class="bulk-input" />
        <button @click="generateBulk" class="btn-primary">Generate {{ bulkCount }} Passwords</button>
      </div>
      <div v-if="bulkPasswords.length > 0" class="bulk-results">
        <div v-for="(pwd, index) in bulkPasswords" :key="index" class="bulk-item" @click="copyBulk(pwd)">
          <code>{{ pwd }}</code>
          <span class="copy-hint">Click to copy</span>
        </div>
      </div>
    </div>

    <div v-if="copied" class="copy-notification">{{ copyMessage }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue';

const password = ref('');
const length = ref(16);
const isMasked = ref(false);
const copied = ref(false);
const copyMessage = ref('Copied!');
const bulkCount = ref(5);
const bulkPasswords = ref<string[]>([]);

const options = reactive({
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
  excludeSimilar: false,
  excludeAmbiguous: false
});

const charSets = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?'
};

const similarChars = 'il1Lo0O';
const ambiguousChars = '{}[]()/\\\'"`~,;:.<>';

const maskedPassword = computed(() => '*'.repeat(password.value.length));

const getCharset = (): string => {
  let charset = '';
  if (options.uppercase) charset += charSets.uppercase;
  if (options.lowercase) charset += charSets.lowercase;
  if (options.numbers) charset += charSets.numbers;
  if (options.symbols) charset += charSets.symbols;
  
  if (options.excludeSimilar) {
    charset = charset.split('').filter(c => !similarChars.includes(c)).join('');
  }
  if (options.excludeAmbiguous) {
    charset = charset.split('').filter(c => !ambiguousChars.includes(c)).join('');
  }
  
  return charset || charSets.lowercase; // Fallback to lowercase if nothing selected
};

const generatePassword = () => {
  const charset = getCharset();
  const array = new Uint32Array(length.value);
  crypto.getRandomValues(array);
  
  password.value = Array.from(array)
    .map(n => charset[n % charset.length])
    .join('');
};

const generateBulk = () => {
  bulkPasswords.value = [];
  for (let i = 0; i < bulkCount.value; i++) {
    const charset = getCharset();
    const array = new Uint32Array(length.value);
    crypto.getRandomValues(array);
    bulkPasswords.value.push(
      Array.from(array).map(n => charset[n % charset.length]).join('')
    );
  }
};

const calculateStrength = (pwd: string): number => {
  let score = 0;
  
  // Length score
  if (pwd.length >= 8) score += 1;
  if (pwd.length >= 12) score += 1;
  if (pwd.length >= 16) score += 1;
  if (pwd.length >= 20) score += 1;
  
  // Character variety
  if (/[a-z]/.test(pwd)) score += 1;
  if (/[A-Z]/.test(pwd)) score += 1;
  if (/[0-9]/.test(pwd)) score += 1;
  if (/[^a-zA-Z0-9]/.test(pwd)) score += 1;
  
  return Math.min(score, 8);
};

const strengthPercent = computed(() => (calculateStrength(password.value) / 8) * 100);

const strengthClass = computed(() => {
  const score = calculateStrength(password.value);
  if (score <= 2) return 'weak';
  if (score <= 4) return 'fair';
  if (score <= 6) return 'good';
  return 'strong';
});

const strengthLabel = computed(() => {
  const score = calculateStrength(password.value);
  if (score <= 2) return 'Weak';
  if (score <= 4) return 'Fair';
  if (score <= 6) return 'Good';
  return 'Strong';
});

const copyPassword = async () => {
  await navigator.clipboard.writeText(password.value);
  copyMessage.value = 'Password copied!';
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
};

const copyBulk = async (pwd: string) => {
  await navigator.clipboard.writeText(pwd);
  copyMessage.value = 'Copied!';
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
};

watch([length, options], generatePassword, { deep: true });

onMounted(generatePassword);
</script>

<style scoped>
.password-generator-tool {
  padding: 20px;
}
.password-display {
  margin: 24px 0;
}
.password-box {
  display: flex;
  align-items: center;
  background: #1e293b;
  padding: 20px;
  border-radius: 12px;
}
.password-text {
  flex: 1;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 20px;
  color: #22c55e;
  word-break: break-all;
}
.password-text.masked {
  color: #64748b;
}
.password-actions {
  display: flex;
  gap: 8px;
}
.action-btn {
  padding: 8px 12px;
  background: #334155;
  color: #94a3b8;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}
.action-btn:hover {
  background: #475569;
  color: white;
}
.action-btn.refresh {
  background: #667eea;
  color: white;
}
.strength-meter {
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  margin-top: 12px;
  overflow: hidden;
}
.strength-bar {
  height: 100%;
  transition: all 0.3s;
}
.strength-bar.weak { background: #ef4444; }
.strength-bar.fair { background: #f59e0b; }
.strength-bar.good { background: #22c55e; }
.strength-bar.strong { background: #667eea; }
.strength-label {
  text-align: right;
  font-size: 12px;
  margin-top: 4px;
}
.strength-label.weak { color: #ef4444; }
.strength-label.fair { color: #f59e0b; }
.strength-label.good { color: #22c55e; }
.strength-label.strong { color: #667eea; }
.options-section {
  margin: 30px 0;
}
.length-control {
  margin-bottom: 24px;
}
.length-control label {
  font-weight: 600;
  display: block;
  margin-bottom: 12px;
}
.range-slider {
  width: 100%;
  height: 8px;
  -webkit-appearance: none;
  background: #e2e8f0;
  border-radius: 4px;
  cursor: pointer;
}
.range-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 24px;
  height: 24px;
  background: #667eea;
  border-radius: 50%;
  cursor: pointer;
}
.range-labels {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #64748b;
  margin-top: 4px;
}
.char-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.option-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
  cursor: pointer;
}
.option-item input {
  width: 18px;
  height: 18px;
}
.option-label {
  flex: 1;
  font-weight: 500;
}
.option-preview {
  font-family: monospace;
  font-size: 12px;
  color: #64748b;
}
.bulk-generate {
  margin-top: 30px;
  padding-top: 30px;
  border-top: 1px solid #e2e8f0;
}
.bulk-controls {
  display: flex;
  gap: 12px;
  margin: 16px 0;
}
.bulk-input {
  width: 80px;
  padding: 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}
.btn-primary {
  padding: 10px 24px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.bulk-results {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
}
.bulk-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #f8fafc;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}
.bulk-item:hover {
  background: #e2e8f0;
}
.bulk-item code {
  font-family: monospace;
  color: #334155;
}
.copy-hint {
  font-size: 12px;
  color: #64748b;
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

