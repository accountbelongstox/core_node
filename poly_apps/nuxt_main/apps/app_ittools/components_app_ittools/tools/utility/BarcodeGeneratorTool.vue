<template>
  <div class="barcode-generator-tool">
    <div class="tool-header">
      <h3>Barcode Generator</h3>
      <p class="tool-description">Generate various types of barcodes</p>
    </div>

    <div class="form-section">
      <div class="form-group">
        <label>Barcode Type</label>
        <select v-model="barcodeType" class="select-field">
          <option value="CODE128">CODE128 (General)</option>
          <option value="CODE39">CODE39</option>
          <option value="EAN13">EAN-13</option>
          <option value="EAN8">EAN-8</option>
          <option value="UPC">UPC-A</option>
          <option value="ITF14">ITF-14</option>
          <option value="MSI">MSI</option>
          <option value="pharmacode">Pharmacode</option>
        </select>
      </div>

      <div class="form-group">
        <label>Content</label>
        <input 
          type="text" 
          v-model="content" 
          :placeholder="getPlaceholder"
          class="input-field"
        />
        <p v-if="validationError" class="validation-error">{{ validationError }}</p>
      </div>

      <div class="options-row">
        <div class="form-group">
          <label>Width</label>
          <input type="number" v-model.number="width" min="1" max="4" class="input-small" />
        </div>
        <div class="form-group">
          <label>Height</label>
          <input type="number" v-model.number="height" min="20" max="200" class="input-small" />
        </div>
        <div class="form-group">
          <label>Font Size</label>
          <input type="number" v-model.number="fontSize" min="0" max="40" class="input-small" />
        </div>
      </div>

      <div class="options-row">
        <div class="form-group">
          <label>Line Color</label>
          <input type="color" v-model="lineColor" class="color-picker" />
        </div>
        <div class="form-group">
          <label>Background</label>
          <input type="color" v-model="background" class="color-picker" />
        </div>
        <label class="checkbox-label">
          <input type="checkbox" v-model="displayValue" />
          Show Text
        </label>
      </div>
    </div>

    <div class="preview-section">
      <h4>Preview</h4>
      <div class="barcode-preview" :style="{ backgroundColor: background }">
        <svg ref="barcodeRef"></svg>
      </div>
    </div>

    <div class="actions">
      <button @click="downloadSVG" class="btn-primary">Download SVG</button>
      <button @click="downloadPNG" class="btn-secondary">Download PNG</button>
      <button @click="copyToClipboard" class="btn-secondary">Copy SVG</button>
    </div>

    <div class="info-section">
      <h4>Barcode Types</h4>
      <div class="info-grid">
        <div class="info-item">
          <strong>CODE128</strong>
          <span>General purpose, supports all ASCII characters</span>
        </div>
        <div class="info-item">
          <strong>EAN-13</strong>
          <span>13 digits, used for retail products worldwide</span>
        </div>
        <div class="info-item">
          <strong>UPC-A</strong>
          <span>12 digits, used in North America</span>
        </div>
        <div class="info-item">
          <strong>CODE39</strong>
          <span>Alphanumeric, used in non-retail industries</span>
        </div>
      </div>
    </div>

    <div v-if="copied" class="copy-notification">Copied to clipboard!</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';

const barcodeRef = ref<SVGElement | null>(null);
const barcodeType = ref('CODE128');
const content = ref('123456789');
const width = ref(2);
const height = ref(100);
const fontSize = ref(20);
const lineColor = ref('#000000');
const background = ref('#ffffff');
const displayValue = ref(true);
const copied = ref(false);

const getPlaceholder = computed(() => {
  switch (barcodeType.value) {
    case 'EAN13': return '1234567890123 (13 digits)';
    case 'EAN8': return '12345678 (8 digits)';
    case 'UPC': return '123456789012 (12 digits)';
    case 'ITF14': return '12345678901234 (14 digits)';
    default: return 'Enter barcode content';
  }
});

const validationError = computed(() => {
  if (!content.value) return '';
  
  switch (barcodeType.value) {
    case 'EAN13':
      if (!/^\d{12,13}$/.test(content.value)) return 'EAN-13 requires 12-13 digits';
      break;
    case 'EAN8':
      if (!/^\d{7,8}$/.test(content.value)) return 'EAN-8 requires 7-8 digits';
      break;
    case 'UPC':
      if (!/^\d{11,12}$/.test(content.value)) return 'UPC-A requires 11-12 digits';
      break;
  }
  return '';
});

const generateBarcode = () => {
  if (!barcodeRef.value || !content.value || validationError.value) return;
  
  // Placeholder SVG barcode rendering
  // In production, use JsBarcode library
  const svg = barcodeRef.value;
  const barWidth = width.value;
  const totalBars = content.value.length * 7;
  const svgWidth = totalBars * barWidth + 20;
  
  svg.setAttribute('width', String(svgWidth));
  svg.setAttribute('height', String(height.value + (displayValue.value ? fontSize.value + 10 : 0)));
  
  let barsHTML = `<rect width="${svgWidth}" height="${height.value}" fill="${background.value}"/>`;
  
  // Simple visual representation
  let x = 10;
  for (let i = 0; i < content.value.length; i++) {
    const charCode = content.value.charCodeAt(i);
    for (let j = 0; j < 7; j++) {
      const isBar = (charCode + j) % 2 === 0;
      if (isBar) {
        barsHTML += `<rect x="${x}" y="0" width="${barWidth}" height="${height.value}" fill="${lineColor.value}"/>`;
      }
      x += barWidth;
    }
  }
  
  if (displayValue.value) {
    barsHTML += `<text x="${svgWidth / 2}" y="${height.value + fontSize.value}" text-anchor="middle" font-size="${fontSize.value}" fill="${lineColor.value}">${content.value}</text>`;
  }
  
  svg.innerHTML = barsHTML;
};

watch([barcodeType, content, width, height, fontSize, lineColor, background, displayValue], generateBarcode);

onMounted(generateBarcode);

const downloadSVG = () => {
  if (!barcodeRef.value) return;
  const svgData = new XMLSerializer().serializeToString(barcodeRef.value);
  const blob = new Blob([svgData], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `barcode-${content.value}.svg`;
  a.click();
  URL.revokeObjectURL(url);
};

const downloadPNG = () => {
  if (!barcodeRef.value) return;
  const svgData = new XMLSerializer().serializeToString(barcodeRef.value);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  
  img.onload = () => {
    canvas.width = img.width * 2;
    canvas.height = img.height * 2;
    if (ctx) {
      ctx.fillStyle = background.value;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `barcode-${content.value}.png`;
          a.click();
          URL.revokeObjectURL(url);
        }
      });
    }
  };
  
  img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
};

const copyToClipboard = async () => {
  if (!barcodeRef.value) return;
  const svgData = new XMLSerializer().serializeToString(barcodeRef.value);
  await navigator.clipboard.writeText(svgData);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
};
</script>

<style scoped>
.barcode-generator-tool {
  padding: 20px;
}
.form-section {
  margin: 20px 0;
}
.form-group {
  margin-bottom: 16px;
}
.form-group label {
  display: block;
  margin-bottom: 4px;
  font-weight: 500;
}
.select-field, .input-field {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}
.input-small {
  width: 80px;
  padding: 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}
.options-row {
  display: flex;
  gap: 20px;
  align-items: flex-end;
  margin-bottom: 16px;
}
.color-picker {
  width: 60px;
  height: 40px;
  border: none;
  cursor: pointer;
}
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.validation-error {
  color: #ef4444;
  font-size: 12px;
  margin-top: 4px;
}
.preview-section {
  margin: 30px 0;
}
.barcode-preview {
  padding: 30px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  display: flex;
  justify-content: center;
  overflow-x: auto;
}
.actions {
  display: flex;
  gap: 12px;
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
.info-section {
  margin-top: 40px;
}
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-top: 12px;
}
.info-item {
  padding: 12px;
  background: #f8fafc;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.info-item span {
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

