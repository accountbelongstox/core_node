<template>
  <div class="contrast-checker-tool">
    <div class="tool-header">
      <h3>Contrast Checker</h3>
      <p class="tool-description">Check color contrast for WCAG accessibility</p>
    </div>

    <div class="color-inputs">
      <div class="color-input-group">
        <label>Foreground Color</label>
        <div class="input-row">
          <input type="color" v-model="foregroundColor" class="color-picker" />
          <input type="text" v-model="foregroundColor" class="hex-input" />
        </div>
      </div>
      <button @click="swapColors" class="swap-btn">Swap</button>
      <div class="color-input-group">
        <label>Background Color</label>
        <div class="input-row">
          <input type="color" v-model="backgroundColor" class="color-picker" />
          <input type="text" v-model="backgroundColor" class="hex-input" />
        </div>
      </div>
    </div>

    <div class="preview-section" :style="{ backgroundColor: backgroundColor }">
      <p class="preview-text normal" :style="{ color: foregroundColor }">Normal Text (16px)</p>
      <p class="preview-text large" :style="{ color: foregroundColor }">Large Text (24px Bold)</p>
    </div>

    <div class="results-section">
      <div class="contrast-ratio">
        <span class="label">Contrast Ratio</span>
        <span class="value">{{ contrastRatio.toFixed(2) }}:1</span>
      </div>

      <div class="wcag-results">
        <h4>WCAG 2.1 Compliance</h4>
        <div class="wcag-grid">
          <div class="wcag-item">
            <span class="wcag-label">AA Normal Text</span>
            <span :class="['wcag-status', contrastRatio >= 4.5 ? 'pass' : 'fail']">
              {{ contrastRatio >= 4.5 ? 'PASS' : 'FAIL' }}
            </span>
          </div>
          <div class="wcag-item">
            <span class="wcag-label">AA Large Text</span>
            <span :class="['wcag-status', contrastRatio >= 3 ? 'pass' : 'fail']">
              {{ contrastRatio >= 3 ? 'PASS' : 'FAIL' }}
            </span>
          </div>
          <div class="wcag-item">
            <span class="wcag-label">AAA Normal Text</span>
            <span :class="['wcag-status', contrastRatio >= 7 ? 'pass' : 'fail']">
              {{ contrastRatio >= 7 ? 'PASS' : 'FAIL' }}
            </span>
          </div>
          <div class="wcag-item">
            <span class="wcag-label">AAA Large Text</span>
            <span :class="['wcag-status', contrastRatio >= 4.5 ? 'pass' : 'fail']">
              {{ contrastRatio >= 4.5 ? 'PASS' : 'FAIL' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const foregroundColor = ref('#000000');
const backgroundColor = ref('#ffffff');

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

const getLuminance = (r: number, g: number, b: number): number => {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

const contrastRatio = computed(() => {
  const fg = hexToRgb(foregroundColor.value);
  const bg = hexToRgb(backgroundColor.value);
  if (!fg || !bg) return 1;

  const l1 = getLuminance(fg.r, fg.g, fg.b);
  const l2 = getLuminance(bg.r, bg.g, bg.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
});

const swapColors = () => {
  const temp = foregroundColor.value;
  foregroundColor.value = backgroundColor.value;
  backgroundColor.value = temp;
};
</script>

<style scoped>
.contrast-checker-tool {
  padding: 20px;
}
.color-inputs {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  margin: 20px 0;
}
.color-input-group {
  flex: 1;
}
.input-row {
  display: flex;
  gap: 8px;
}
.color-picker {
  width: 50px;
  height: 40px;
  border: none;
  cursor: pointer;
}
.hex-input {
  flex: 1;
  padding: 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-family: monospace;
}
.swap-btn {
  padding: 10px 20px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.preview-section {
  padding: 30px;
  border-radius: 8px;
  margin: 20px 0;
}
.preview-text.normal {
  font-size: 16px;
}
.preview-text.large {
  font-size: 24px;
  font-weight: bold;
}
.results-section {
  background: #f8fafc;
  padding: 20px;
  border-radius: 8px;
}
.contrast-ratio {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 24px;
  margin-bottom: 20px;
}
.wcag-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.wcag-item {
  display: flex;
  justify-content: space-between;
  padding: 12px;
  background: white;
  border-radius: 6px;
}
.wcag-status.pass {
  color: #22c55e;
  font-weight: bold;
}
.wcag-status.fail {
  color: #ef4444;
  font-weight: bold;
}
</style>

