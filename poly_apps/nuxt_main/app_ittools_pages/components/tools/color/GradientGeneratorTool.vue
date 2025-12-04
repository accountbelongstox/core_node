<template>
  <div class="gradient-generator-tool">
    <div class="tool-header">
      <h3>Gradient Generator</h3>
      <p class="tool-description">Create beautiful CSS gradients</p>
    </div>

    <div class="gradient-preview" :style="{ background: gradientCss }">
      <span class="preview-label">Preview</span>
    </div>

    <div class="controls-section">
      <div class="control-group">
        <label>Gradient Type</label>
        <select v-model="gradientType" class="input-field">
          <option value="linear">Linear</option>
          <option value="radial">Radial</option>
          <option value="conic">Conic</option>
        </select>
      </div>

      <div v-if="gradientType === 'linear'" class="control-group">
        <label>Angle: {{ angle }}deg</label>
        <input type="range" v-model.number="angle" min="0" max="360" class="range-slider" />
      </div>

      <div class="colors-section">
        <h4>Color Stops</h4>
        <div v-for="(stop, index) in colorStops" :key="index" class="color-stop">
          <input type="color" v-model="stop.color" class="color-picker" />
          <input type="number" v-model.number="stop.position" min="0" max="100" class="position-input" />
          <span>%</span>
          <button v-if="colorStops.length > 2" @click="removeStop(index)" class="btn-remove">x</button>
        </div>
        <button @click="addStop" class="btn-add">+ Add Color Stop</button>
      </div>
    </div>

    <div class="output-section">
      <label>CSS Code</label>
      <div class="code-output">
        <code>{{ cssCode }}</code>
        <button @click="copyToClipboard" class="btn-copy">Copy</button>
      </div>
    </div>

    <div v-if="copied" class="copy-notification">Copied to clipboard!</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

interface ColorStop {
  color: string;
  position: number;
}

const gradientType = ref('linear');
const angle = ref(90);
const colorStops = ref<ColorStop[]>([
  { color: '#667eea', position: 0 },
  { color: '#764ba2', position: 100 }
]);
const copied = ref(false);

const gradientCss = computed(() => {
  const stops = colorStops.value
    .map(s => `${s.color} ${s.position}%`)
    .join(', ');

  switch (gradientType.value) {
    case 'radial':
      return `radial-gradient(circle, ${stops})`;
    case 'conic':
      return `conic-gradient(${stops})`;
    default:
      return `linear-gradient(${angle.value}deg, ${stops})`;
  }
});

const cssCode = computed(() => `background: ${gradientCss.value};`);

const addStop = () => {
  const lastPos = colorStops.value[colorStops.value.length - 1]?.position || 0;
  colorStops.value.push({
    color: '#ffffff',
    position: Math.min(lastPos + 25, 100)
  });
};

const removeStop = (index: number) => {
  colorStops.value.splice(index, 1);
};

const copyToClipboard = async () => {
  await navigator.clipboard.writeText(cssCode.value);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
};
</script>

<style scoped>
.gradient-generator-tool {
  padding: 20px;
}
.gradient-preview {
  height: 200px;
  border-radius: 8px;
  margin: 20px 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview-label {
  color: white;
  text-shadow: 0 1px 3px rgba(0,0,0,0.5);
  font-size: 24px;
}
.controls-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.control-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.input-field {
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}
.range-slider {
  width: 100%;
}
.color-stop {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0;
}
.color-picker {
  width: 50px;
  height: 36px;
  border: none;
  cursor: pointer;
}
.position-input {
  width: 60px;
  padding: 6px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
}
.btn-add, .btn-copy {
  padding: 8px 16px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.btn-remove {
  padding: 4px 8px;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.code-output {
  display: flex;
  gap: 12px;
  background: #1e293b;
  padding: 12px;
  border-radius: 6px;
  margin-top: 8px;
}
.code-output code {
  flex: 1;
  color: #94a3b8;
  word-break: break-all;
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

