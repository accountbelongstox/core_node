<template>
  <div class="color-blindness-tool">
    <div class="tool-header">
      <h3>Color Blindness Simulator</h3>
      <p class="tool-description">Simulate how colors appear to people with color vision deficiencies</p>
    </div>

    <div class="input-section">
      <div class="control-group">
        <label>Input Color</label>
        <div class="input-row">
          <input type="color" v-model="inputColor" class="color-picker" />
          <input type="text" v-model="inputColor" class="hex-input" />
        </div>
      </div>
    </div>

    <div class="simulation-grid">
      <div class="simulation-card">
        <div class="color-preview" :style="{ backgroundColor: inputColor }"></div>
        <div class="card-label">Normal Vision</div>
        <div class="color-code">{{ inputColor }}</div>
      </div>

      <div v-for="sim in simulations" :key="sim.type" class="simulation-card">
        <div class="color-preview" :style="{ backgroundColor: sim.color }"></div>
        <div class="card-label">{{ sim.name }}</div>
        <div class="type-label">{{ sim.percentage }}</div>
        <div class="color-code">{{ sim.color }}</div>
      </div>
    </div>

    <div class="info-section">
      <h4>Types of Color Blindness</h4>
      <div class="info-grid">
        <div class="info-card">
          <h5>Protanopia (Red-Blind)</h5>
          <p>Difficulty distinguishing red and green. Red appears dark. Affects ~1% of males.</p>
        </div>
        <div class="info-card">
          <h5>Deuteranopia (Green-Blind)</h5>
          <p>Most common type. Green appears beige, red appears brownish. Affects ~6% of males.</p>
        </div>
        <div class="info-card">
          <h5>Tritanopia (Blue-Blind)</h5>
          <p>Blue appears green, yellow appears violet. Very rare, affects ~0.01% of population.</p>
        </div>
        <div class="info-card">
          <h5>Achromatopsia (Monochromacy)</h5>
          <p>Complete color blindness. Only sees shades of gray. Extremely rare.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const inputColor = ref('#667eea');

const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0, 0, 0];
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ];
};

const rgbToHex = (r: number, g: number, b: number): string => {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const simulateColorBlindness = (r: number, g: number, b: number, type: string): [number, number, number] => {
  // Color blindness simulation matrices
  const matrices: Record<string, number[][]> = {
    protanopia: [
      [0.567, 0.433, 0],
      [0.558, 0.442, 0],
      [0, 0.242, 0.758]
    ],
    deuteranopia: [
      [0.625, 0.375, 0],
      [0.7, 0.3, 0],
      [0, 0.3, 0.7]
    ],
    tritanopia: [
      [0.95, 0.05, 0],
      [0, 0.433, 0.567],
      [0, 0.475, 0.525]
    ],
    achromatopsia: [
      [0.299, 0.587, 0.114],
      [0.299, 0.587, 0.114],
      [0.299, 0.587, 0.114]
    ]
  };

  const matrix = matrices[type];
  if (!matrix) return [r, g, b];

  return [
    matrix[0][0] * r + matrix[0][1] * g + matrix[0][2] * b,
    matrix[1][0] * r + matrix[1][1] * g + matrix[1][2] * b,
    matrix[2][0] * r + matrix[2][1] * g + matrix[2][2] * b
  ];
};

const simulations = computed(() => {
  const [r, g, b] = hexToRgb(inputColor.value);
  
  return [
    {
      type: 'protanopia',
      name: 'Protanopia',
      percentage: '~1% of males',
      color: rgbToHex(...simulateColorBlindness(r, g, b, 'protanopia'))
    },
    {
      type: 'deuteranopia',
      name: 'Deuteranopia',
      percentage: '~6% of males',
      color: rgbToHex(...simulateColorBlindness(r, g, b, 'deuteranopia'))
    },
    {
      type: 'tritanopia',
      name: 'Tritanopia',
      percentage: '~0.01%',
      color: rgbToHex(...simulateColorBlindness(r, g, b, 'tritanopia'))
    },
    {
      type: 'achromatopsia',
      name: 'Achromatopsia',
      percentage: 'Very rare',
      color: rgbToHex(...simulateColorBlindness(r, g, b, 'achromatopsia'))
    }
  ];
});
</script>

<style scoped>
.color-blindness-tool {
  padding: 20px;
}
.input-section {
  margin: 20px 0;
}
.input-row {
  display: flex;
  gap: 8px;
}
.color-picker {
  width: 60px;
  height: 44px;
  border: none;
  cursor: pointer;
}
.hex-input {
  width: 120px;
  padding: 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-family: monospace;
}
.simulation-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
  margin: 30px 0;
}
.simulation-card {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
.color-preview {
  height: 100px;
}
.card-label {
  font-weight: 600;
  padding: 12px 12px 0;
}
.type-label {
  font-size: 12px;
  color: #64748b;
  padding: 0 12px;
}
.color-code {
  font-family: monospace;
  font-size: 12px;
  padding: 8px 12px 12px;
  color: #64748b;
}
.info-section {
  margin-top: 40px;
}
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-top: 16px;
}
.info-card {
  background: #f8fafc;
  padding: 16px;
  border-radius: 8px;
}
.info-card h5 {
  margin: 0 0 8px;
  color: #334155;
}
.info-card p {
  margin: 0;
  font-size: 14px;
  color: #64748b;
  line-height: 1.5;
}
</style>

