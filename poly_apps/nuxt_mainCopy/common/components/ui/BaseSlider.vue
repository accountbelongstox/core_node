<template>
  <div class="base-slider" :class="{ 'slider-disabled': disabled }">
    <div v-if="label || $slots.label" class="slider-label-wrapper">
      <label v-if="label" class="slider-label">
        <slot name="label">{{ label }}</slot>
      </label>
      <span v-if="showValue" class="slider-value" :style="{ color: color }">
        <slot name="value" :value="modelValue" :formatted="formattedValue">
          {{ formattedValue }}
        </slot>
      </span>
    </div>

    <div class="slider-container">
      <input
        type="range"
        :value="modelValue"
        :min="min"
        :max="max"
        :step="step"
        :disabled="disabled"
        class="slider-input"
        :class="[`slider-${variant}`, { 'slider-vertical': vertical }]"
        :style="sliderStyle"
        @input="handleInput"
        @change="handleChange"
      />

      <div v-if="showTrack" class="slider-track" :style="trackStyle">
        <div class="slider-fill" :style="fillStyle"></div>
      </div>
    </div>

    <div v-if="showMinMax" class="slider-limits">
      <span class="slider-min">{{ formatValue(min) }}</span>
      <span class="slider-max">{{ formatValue(max) }}</span>
    </div>

    <div v-if="marks && marks.length > 0" class="slider-marks">
      <div
        v-for="mark in marks"
        :key="mark.value"
        class="slider-mark"
        :style="{ left: `${((mark.value - min) / (max - min)) * 100}%` }"
      >
        <div class="slider-mark-dot"></div>
        <div v-if="mark.label" class="slider-mark-label">{{ mark.label }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

type SliderVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

interface Mark {
  value: number;
  label?: string;
}

interface Props {
  modelValue: number;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  disabled?: boolean;
  showValue?: boolean;
  showMinMax?: boolean;
  showTrack?: boolean;
  vertical?: boolean;
  variant?: SliderVariant;
  color?: string;
  formatter?: (value: number) => string;
  marks?: Mark[];
}

interface Emits {
  (e: 'update:modelValue', value: number): void;
  (e: 'change', value: number): void;
  (e: 'input', value: number): void;
}

const props = withDefaults(defineProps<Props>(), {
  min: 0,
  max: 100,
  step: 1,
  disabled: false,
  showValue: true,
  showMinMax: false,
  showTrack: false,
  vertical: false,
  variant: 'default',
  marks: () => []
});

const emit = defineEmits<Emits>();

const formattedValue = computed(() => {
  return formatValue(props.modelValue);
});

const fillPercentage = computed(() => {
  return ((props.modelValue - props.min) / (props.max - props.min)) * 100;
});

const sliderStyle = computed(() => {
  const styles: Record<string, string> = {};
  if (props.color) {
    styles['--slider-color'] = props.color;
  }
  return styles;
});

const trackStyle = computed(() => ({}));

const fillStyle = computed(() => ({
  width: `${fillPercentage.value}%`
}));

function formatValue(value: number): string {
  if (props.formatter) {
    return props.formatter(value);
  }
  return value.toString();
}

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement;
  const value = Number(target.value);
  emit('update:modelValue', value);
  emit('input', value);
}

function handleChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const value = Number(target.value);
  emit('change', value);
}
</script>

<style scoped>
.base-slider {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.slider-disabled {
  opacity: 0.5;
  pointer-events: none;
}

.slider-label-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.slider-label {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  cursor: default;
}

.slider-value {
  font-size: 16px;
  font-weight: 700;
  color: #1f2937;
  font-variant-numeric: tabular-nums;
  min-width: 60px;
  text-align: right;
}

.slider-container {
  position: relative;
  width: 100%;
  padding: 8px 0;
}

.slider-input {
  width: 100%;
  height: 8px;
  border-radius: 4px;
  outline: none;
  appearance: none;
  cursor: pointer;
  position: relative;
  z-index: 2;
  background: transparent;
}

/* Track */
.slider-input::-webkit-slider-runnable-track {
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: linear-gradient(to right, var(--slider-color, #3b82f6) 0%, var(--slider-color, #3b82f6) var(--fill-percent, 50%), #e5e7eb var(--fill-percent, 50%), #e5e7eb 100%);
}

.slider-input::-moz-range-track {
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: linear-gradient(to right, var(--slider-color, #3b82f6) 0%, var(--slider-color, #3b82f6) var(--fill-percent, 50%), #e5e7eb var(--fill-percent, 50%), #e5e7eb 100%);
}

/* Thumb */
.slider-input::-webkit-slider-thumb {
  appearance: none;
  width: 20px;
  height: 20px;
  background: white;
  border: 3px solid var(--slider-color, #3b82f6);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}

.slider-input::-moz-range-thumb {
  width: 20px;
  height: 20px;
  background: white;
  border: 3px solid var(--slider-color, #3b82f6);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}

.slider-input:hover::-webkit-slider-thumb {
  transform: scale(1.1);
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
}

.slider-input:hover::-moz-range-thumb {
  transform: scale(1.1);
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
}

.slider-input:active::-webkit-slider-thumb {
  transform: scale(1.15);
}

.slider-input:active::-moz-range-thumb {
  transform: scale(1.15);
}

/* Variant Colors */
.slider-default {
  --slider-color: #3b82f6;
}

.slider-primary {
  --slider-color: #3b82f6;
}

.slider-success {
  --slider-color: #10b981;
}

.slider-warning {
  --slider-color: #f59e0b;
}

.slider-danger {
  --slider-color: #ef4444;
}

.slider-info {
  --slider-color: #06b6d4;
}

/* Min/Max Labels */
.slider-limits {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #6b7280;
  font-weight: 500;
}

/* Custom Track (alternative to native) */
.slider-track {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  transform: translateY(-50%);
  pointer-events: none;
  z-index: 1;
}

.slider-fill {
  height: 100%;
  background: var(--slider-color, #3b82f6);
  border-radius: 4px;
  transition: width 0.2s ease;
}

/* Marks */
.slider-marks {
  position: relative;
  height: 24px;
  margin-top: 4px;
}

.slider-mark {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.slider-mark-dot {
  width: 8px;
  height: 8px;
  background: var(--slider-color, #3b82f6);
  border: 2px solid white;
  border-radius: 50%;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.slider-mark-label {
  font-size: 11px;
  color: #6b7280;
  font-weight: 500;
  white-space: nowrap;
}

/* Vertical Orientation */
.slider-vertical {
  writing-mode: bt-lr;
  -webkit-appearance: slider-vertical;
  height: 200px;
  width: 8px;
}
</style>
