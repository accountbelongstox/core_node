<template>
  <div class="unit-converter-tool">
    <div class="tool-header">
      <h3>Unit Converter</h3>
      <p class="tool-description">Convert between different units of measurement</p>
    </div>

    <div class="category-tabs">
      <button 
        v-for="cat in categories" 
        :key="cat.id"
        :class="['tab-btn', { active: activeCategory === cat.id }]"
        @click="selectCategory(cat.id)"
      >
        <span class="tab-icon">{{ cat.icon }}</span>
        {{ cat.name }}
      </button>
    </div>

    <div class="converter-section">
      <div class="conversion-row">
        <div class="input-group">
          <label>From</label>
          <input 
            type="number" 
            v-model.number="fromValue" 
            class="value-input"
            @input="convert('from')"
          />
          <select v-model="fromUnit" class="unit-select" @change="convert('from')">
            <option v-for="unit in currentUnits" :key="unit.id" :value="unit.id">
              {{ unit.name }} ({{ unit.symbol }})
            </option>
          </select>
        </div>

        <button @click="swapUnits" class="swap-btn">swap</button>

        <div class="input-group">
          <label>To</label>
          <input 
            type="number" 
            v-model.number="toValue" 
            class="value-input"
            @input="convert('to')"
          />
          <select v-model="toUnit" class="unit-select" @change="convert('from')">
            <option v-for="unit in currentUnits" :key="unit.id" :value="unit.id">
              {{ unit.name }} ({{ unit.symbol }})
            </option>
          </select>
        </div>
      </div>

      <div class="formula-display">
        <span class="formula">
          {{ fromValue || 0 }} {{ getUnitSymbol(fromUnit) }} = {{ toValue || 0 }} {{ getUnitSymbol(toUnit) }}
        </span>
      </div>
    </div>

    <div class="quick-conversions">
      <h4>Quick Reference</h4>
      <div class="quick-grid">
        <div v-for="ref in quickReferences" :key="ref.label" class="quick-item">
          <span class="quick-value">{{ ref.value }}</span>
          <span class="quick-label">{{ ref.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

const activeCategory = ref('length');
const fromValue = ref<number>(1);
const toValue = ref<number>(0);
const fromUnit = ref('meter');
const toUnit = ref('foot');

interface Unit {
  id: string;
  name: string;
  symbol: string;
  toBase: number; // Conversion factor to base unit
}

interface Category {
  id: string;
  name: string;
  icon: string;
  baseUnit: string;
  units: Unit[];
}

const categories: Category[] = [
  {
    id: 'length',
    name: 'Length',
    icon: 'ruler',
    baseUnit: 'meter',
    units: [
      { id: 'meter', name: 'Meter', symbol: 'm', toBase: 1 },
      { id: 'kilometer', name: 'Kilometer', symbol: 'km', toBase: 1000 },
      { id: 'centimeter', name: 'Centimeter', symbol: 'cm', toBase: 0.01 },
      { id: 'millimeter', name: 'Millimeter', symbol: 'mm', toBase: 0.001 },
      { id: 'mile', name: 'Mile', symbol: 'mi', toBase: 1609.344 },
      { id: 'yard', name: 'Yard', symbol: 'yd', toBase: 0.9144 },
      { id: 'foot', name: 'Foot', symbol: 'ft', toBase: 0.3048 },
      { id: 'inch', name: 'Inch', symbol: 'in', toBase: 0.0254 }
    ]
  },
  {
    id: 'weight',
    name: 'Weight',
    icon: 'weight',
    baseUnit: 'kilogram',
    units: [
      { id: 'kilogram', name: 'Kilogram', symbol: 'kg', toBase: 1 },
      { id: 'gram', name: 'Gram', symbol: 'g', toBase: 0.001 },
      { id: 'milligram', name: 'Milligram', symbol: 'mg', toBase: 0.000001 },
      { id: 'pound', name: 'Pound', symbol: 'lb', toBase: 0.453592 },
      { id: 'ounce', name: 'Ounce', symbol: 'oz', toBase: 0.0283495 },
      { id: 'ton', name: 'Metric Ton', symbol: 't', toBase: 1000 }
    ]
  },
  {
    id: 'temperature',
    name: 'Temperature',
    icon: 'thermometer',
    baseUnit: 'celsius',
    units: [
      { id: 'celsius', name: 'Celsius', symbol: 'C', toBase: 1 },
      { id: 'fahrenheit', name: 'Fahrenheit', symbol: 'F', toBase: 1 },
      { id: 'kelvin', name: 'Kelvin', symbol: 'K', toBase: 1 }
    ]
  },
  {
    id: 'area',
    name: 'Area',
    icon: 'square',
    baseUnit: 'sqmeter',
    units: [
      { id: 'sqmeter', name: 'Square Meter', symbol: 'm2', toBase: 1 },
      { id: 'sqkilometer', name: 'Square Kilometer', symbol: 'km2', toBase: 1000000 },
      { id: 'sqfoot', name: 'Square Foot', symbol: 'ft2', toBase: 0.092903 },
      { id: 'acre', name: 'Acre', symbol: 'ac', toBase: 4046.86 },
      { id: 'hectare', name: 'Hectare', symbol: 'ha', toBase: 10000 }
    ]
  },
  {
    id: 'volume',
    name: 'Volume',
    icon: 'cube',
    baseUnit: 'liter',
    units: [
      { id: 'liter', name: 'Liter', symbol: 'L', toBase: 1 },
      { id: 'milliliter', name: 'Milliliter', symbol: 'mL', toBase: 0.001 },
      { id: 'gallon', name: 'Gallon (US)', symbol: 'gal', toBase: 3.78541 },
      { id: 'quart', name: 'Quart', symbol: 'qt', toBase: 0.946353 },
      { id: 'pint', name: 'Pint', symbol: 'pt', toBase: 0.473176 },
      { id: 'cup', name: 'Cup', symbol: 'cup', toBase: 0.236588 }
    ]
  },
  {
    id: 'data',
    name: 'Data',
    icon: 'database',
    baseUnit: 'byte',
    units: [
      { id: 'byte', name: 'Byte', symbol: 'B', toBase: 1 },
      { id: 'kilobyte', name: 'Kilobyte', symbol: 'KB', toBase: 1024 },
      { id: 'megabyte', name: 'Megabyte', symbol: 'MB', toBase: 1048576 },
      { id: 'gigabyte', name: 'Gigabyte', symbol: 'GB', toBase: 1073741824 },
      { id: 'terabyte', name: 'Terabyte', symbol: 'TB', toBase: 1099511627776 }
    ]
  }
];

const currentCategory = computed(() => categories.find(c => c.id === activeCategory.value));
const currentUnits = computed(() => currentCategory.value?.units || []);

const selectCategory = (catId: string) => {
  activeCategory.value = catId;
  const units = categories.find(c => c.id === catId)?.units;
  if (units && units.length >= 2) {
    fromUnit.value = units[0].id;
    toUnit.value = units[1].id;
    fromValue.value = 1;
    convert('from');
  }
};

const getUnitSymbol = (unitId: string): string => {
  const unit = currentUnits.value.find(u => u.id === unitId);
  return unit?.symbol || '';
};

const convert = (direction: 'from' | 'to') => {
  const fromU = currentUnits.value.find(u => u.id === fromUnit.value);
  const toU = currentUnits.value.find(u => u.id === toUnit.value);
  
  if (!fromU || !toU) return;

  // Special handling for temperature
  if (activeCategory.value === 'temperature') {
    if (direction === 'from') {
      toValue.value = convertTemperature(fromValue.value, fromUnit.value, toUnit.value);
    } else {
      fromValue.value = convertTemperature(toValue.value, toUnit.value, fromUnit.value);
    }
    return;
  }

  if (direction === 'from') {
    const baseValue = (fromValue.value || 0) * fromU.toBase;
    toValue.value = Number((baseValue / toU.toBase).toPrecision(10));
  } else {
    const baseValue = (toValue.value || 0) * toU.toBase;
    fromValue.value = Number((baseValue / fromU.toBase).toPrecision(10));
  }
};

const convertTemperature = (value: number, from: string, to: string): number => {
  // Convert to Celsius first
  let celsius = value;
  if (from === 'fahrenheit') {
    celsius = (value - 32) * 5 / 9;
  } else if (from === 'kelvin') {
    celsius = value - 273.15;
  }

  // Convert from Celsius to target
  if (to === 'fahrenheit') {
    return Number((celsius * 9 / 5 + 32).toFixed(2));
  } else if (to === 'kelvin') {
    return Number((celsius + 273.15).toFixed(2));
  }
  return Number(celsius.toFixed(2));
};

const swapUnits = () => {
  const tempUnit = fromUnit.value;
  fromUnit.value = toUnit.value;
  toUnit.value = tempUnit;
  
  const tempValue = fromValue.value;
  fromValue.value = toValue.value;
  toValue.value = tempValue;
};

const quickReferences = computed(() => {
  const refs: { value: string; label: string }[] = [];
  
  if (activeCategory.value === 'length') {
    refs.push(
      { value: '1 mi', label: '= 1.609 km' },
      { value: '1 ft', label: '= 0.305 m' },
      { value: '1 in', label: '= 2.54 cm' }
    );
  } else if (activeCategory.value === 'weight') {
    refs.push(
      { value: '1 lb', label: '= 0.454 kg' },
      { value: '1 oz', label: '= 28.35 g' },
      { value: '1 ton', label: '= 1000 kg' }
    );
  } else if (activeCategory.value === 'temperature') {
    refs.push(
      { value: '0 C', label: '= 32 F = 273.15 K' },
      { value: '100 C', label: '= 212 F = 373.15 K' },
      { value: '-40 C', label: '= -40 F' }
    );
  }
  
  return refs;
});

// Initialize
selectCategory('length');
</script>

<style scoped>
.unit-converter-tool {
  padding: 20px;
}
.category-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 20px 0;
}
.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.tab-btn.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}
.tab-icon {
  font-size: 16px;
}
.converter-section {
  background: #f8fafc;
  padding: 30px;
  border-radius: 12px;
  margin: 20px 0;
}
.conversion-row {
  display: flex;
  gap: 20px;
  align-items: flex-end;
}
.input-group {
  flex: 1;
}
.input-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #64748b;
}
.value-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 8px;
}
.unit-select {
  width: 100%;
  padding: 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: white;
}
.swap-btn {
  padding: 12px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  font-size: 18px;
}
.formula-display {
  text-align: center;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #e2e8f0;
}
.formula {
  font-size: 18px;
  color: #334155;
  font-weight: 500;
}
.quick-conversions {
  margin-top: 30px;
}
.quick-grid {
  display: flex;
  gap: 16px;
  margin-top: 12px;
}
.quick-item {
  background: #f1f5f9;
  padding: 16px 24px;
  border-radius: 8px;
}
.quick-value {
  font-weight: 600;
  color: #667eea;
}
.quick-label {
  color: #64748b;
}
</style>

