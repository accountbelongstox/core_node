<template>
  <div class="palette-generator-tool">
    <div class="tool-header">
      <h3>Palette Generator</h3>
      <p class="tool-description">Generate harmonious color palettes</p>
    </div>

    <div class="controls">
      <div class="control-group">
        <label>Base Color</label>
        <div class="input-row">
          <input type="color" v-model="baseColor" class="color-picker" />
          <input type="text" v-model="baseColor" class="hex-input" />
        </div>
      </div>
      <div class="control-group">
        <label>Palette Type</label>
        <select v-model="paletteType" class="select-field">
          <option value="complementary">Complementary</option>
          <option value="analogous">Analogous</option>
          <option value="triadic">Triadic</option>
          <option value="split-complementary">Split Complementary</option>
          <option value="tetradic">Tetradic</option>
          <option value="monochromatic">Monochromatic</option>
        </select>
      </div>
      <button @click="generatePalette" class="btn-generate">Generate</button>
    </div>

    <div class="palette-display">
      <div 
        v-for="(color, index) in palette" 
        :key="index" 
        class="color-swatch"
        :style="{ backgroundColor: color }"
        @click="copyColor(color)"
      >
        <span class="color-label">{{ color }}</span>
      </div>
    </div>

    <div class="export-section">
      <h4>Export</h4>
      <div class="export-options">
        <button @click="exportAsCSS" class="export-btn">CSS Variables</button>
        <button @click="exportAsJSON" class="export-btn">JSON</button>
        <button @click="exportAsSCSS" class="export-btn">SCSS Variables</button>
      </div>
      <textarea v-if="exportOutput" v-model="exportOutput" readonly class="export-output"></textarea>
    </div>

    <div v-if="copied" class="copy-notification">{{ copiedText }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const baseColor = ref('#667eea');
const paletteType = ref('complementary');
const palette = ref<string[]>([]);
const exportOutput = ref('');
const copied = ref(false);
const copiedText = ref('');

const hexToHsl = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0, 0, 0];
  
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s * 100, l * 100];
};

const hslToHex = (h: number, s: number, l: number): string => {
  h = h % 360;
  if (h < 0) h += 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const generatePalette = () => {
  const [h, s, l] = hexToHsl(baseColor.value);
  const colors: string[] = [baseColor.value];

  switch (paletteType.value) {
    case 'complementary':
      colors.push(hslToHex(h + 180, s, l));
      break;
    case 'analogous':
      colors.push(hslToHex(h - 30, s, l), hslToHex(h + 30, s, l));
      break;
    case 'triadic':
      colors.push(hslToHex(h + 120, s, l), hslToHex(h + 240, s, l));
      break;
    case 'split-complementary':
      colors.push(hslToHex(h + 150, s, l), hslToHex(h + 210, s, l));
      break;
    case 'tetradic':
      colors.push(hslToHex(h + 90, s, l), hslToHex(h + 180, s, l), hslToHex(h + 270, s, l));
      break;
    case 'monochromatic':
      colors.push(hslToHex(h, s, l - 20), hslToHex(h, s, l + 20), hslToHex(h, s - 20, l));
      break;
  }
  palette.value = colors;
};

const copyColor = async (color: string) => {
  await navigator.clipboard.writeText(color);
  copiedText.value = `Copied ${color}`;
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
};

const exportAsCSS = () => {
  exportOutput.value = `:root {\n${palette.value.map((c, i) => `  --color-${i + 1}: ${c};`).join('\n')}\n}`;
};

const exportAsJSON = () => {
  exportOutput.value = JSON.stringify({ palette: palette.value }, null, 2);
};

const exportAsSCSS = () => {
  exportOutput.value = palette.value.map((c, i) => `$color-${i + 1}: ${c};`).join('\n');
};

onMounted(generatePalette);
</script>

<style scoped>
.palette-generator-tool {
  padding: 20px;
}
.controls {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  margin: 20px 0;
}
.control-group {
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
.hex-input, .select-field {
  flex: 1;
  padding: 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}
.btn-generate {
  padding: 10px 24px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.palette-display {
  display: flex;
  gap: 12px;
  margin: 30px 0;
}
.color-swatch {
  flex: 1;
  height: 120px;
  border-radius: 8px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 12px;
  cursor: pointer;
  transition: transform 0.2s;
}
.color-swatch:hover {
  transform: scale(1.05);
}
.color-label {
  background: rgba(0,0,0,0.5);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-family: monospace;
}
.export-section {
  margin-top: 30px;
}
.export-options {
  display: flex;
  gap: 12px;
  margin: 12px 0;
}
.export-btn {
  padding: 8px 16px;
  background: #1e293b;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.export-output {
  width: 100%;
  height: 150px;
  padding: 12px;
  background: #1e293b;
  color: #94a3b8;
  border: none;
  border-radius: 6px;
  font-family: monospace;
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

