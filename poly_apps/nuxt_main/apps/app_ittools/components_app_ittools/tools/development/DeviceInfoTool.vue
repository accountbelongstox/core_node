<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-cyan-500 to-blue-500">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-desktop text-white"></i>
            <h2 class="text-2xl font-semibold text-white">Device Information</h2>
          </div>
          <p class="text-sm text-cyan-100">View device and browser details</p>
        </div>
        <button @click="$emit('close')" class="p-2 text-cyan-200 hover:text-white rounded-lg hover:bg-white/10 transition">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <!-- Browser Info -->
      <div class="bg-slate-50 rounded-xl p-4">
        <h3 class="text-sm font-semibold text-slate-700 mb-3 flex items-center">
          <i class="fas fa-globe text-blue-500 mr-2"></i>Browser
        </h3>
        <div class="space-y-2">
          <InfoRow label="User Agent" :value="info.userAgent" copyable />
          <InfoRow label="Browser" :value="info.browser" />
          <InfoRow label="Language" :value="info.language" />
          <InfoRow label="Cookies Enabled" :value="info.cookiesEnabled ? 'Yes' : 'No'" />
          <InfoRow label="Do Not Track" :value="info.doNotTrack" />
        </div>
      </div>

      <!-- Screen Info -->
      <div class="bg-slate-50 rounded-xl p-4">
        <h3 class="text-sm font-semibold text-slate-700 mb-3 flex items-center">
          <i class="fas fa-tv text-green-500 mr-2"></i>Screen
        </h3>
        <div class="space-y-2">
          <InfoRow label="Screen Resolution" :value="`${info.screenWidth} x ${info.screenHeight}`" />
          <InfoRow label="Available Screen" :value="`${info.availWidth} x ${info.availHeight}`" />
          <InfoRow label="Color Depth" :value="`${info.colorDepth} bit`" />
          <InfoRow label="Pixel Ratio" :value="info.pixelRatio" />
          <InfoRow label="Orientation" :value="info.orientation" />
        </div>
      </div>

      <!-- Window Info -->
      <div class="bg-slate-50 rounded-xl p-4">
        <h3 class="text-sm font-semibold text-slate-700 mb-3 flex items-center">
          <i class="fas fa-window-maximize text-purple-500 mr-2"></i>Window
        </h3>
        <div class="space-y-2">
          <InfoRow label="Window Size" :value="`${info.windowWidth} x ${info.windowHeight}`" />
          <InfoRow label="Viewport Size" :value="`${info.viewportWidth} x ${info.viewportHeight}`" />
        </div>
      </div>

      <!-- System Info -->
      <div class="bg-slate-50 rounded-xl p-4">
        <h3 class="text-sm font-semibold text-slate-700 mb-3 flex items-center">
          <i class="fas fa-microchip text-amber-500 mr-2"></i>System
        </h3>
        <div class="space-y-2">
          <InfoRow label="Platform" :value="info.platform" />
          <InfoRow label="CPU Cores" :value="info.cpuCores" />
          <InfoRow label="Memory" :value="info.memory" />
          <InfoRow label="Touch Support" :value="info.touchSupport ? 'Yes' : 'No'" />
          <InfoRow label="Online Status" :value="info.online ? 'Online' : 'Offline'" />
        </div>
      </div>

      <!-- Network Info -->
      <div class="bg-slate-50 rounded-xl p-4">
        <h3 class="text-sm font-semibold text-slate-700 mb-3 flex items-center">
          <i class="fas fa-wifi text-cyan-500 mr-2"></i>Network
        </h3>
        <div class="space-y-2">
          <InfoRow label="Connection Type" :value="info.connectionType" />
          <InfoRow label="Effective Type" :value="info.effectiveType" />
          <InfoRow label="Downlink" :value="info.downlink" />
        </div>
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex justify-end">
      <button @click="refresh" class="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition">
        <i class="fas fa-sync-alt mr-2"></i>Refresh
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, h } from 'vue';
import type { Tool } from '../../../types_app_ittools';

defineProps<{ tool: Tool }>();
defineEmits<{ close: []; executed: [result: any] }>();

// InfoRow component
const InfoRow = (props: { label: string; value: string; copyable?: boolean }) => {
  const copy = async () => {
    try { await navigator.clipboard.writeText(props.value); } catch {}
  };
  
  return h('div', { class: 'flex justify-between items-center' }, [
    h('span', { class: 'text-sm text-slate-600' }, props.label),
    h('div', { class: 'flex items-center space-x-2' }, [
      h('span', { class: 'text-sm font-medium text-slate-800 font-mono text-right max-w-xs truncate' }, props.value),
      props.copyable && h('button', { 
        class: 'text-slate-400 hover:text-cyan-500',
        onClick: copy
      }, [h('i', { class: 'fas fa-copy text-xs' })])
    ])
  ]);
};

const info = ref<Record<string, any>>({});

const getInfo = () => {
  const nav = navigator as any;
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
  
  info.value = {
    // Browser
    userAgent: navigator.userAgent,
    browser: getBrowserName(),
    language: navigator.language,
    cookiesEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack === '1' ? 'Enabled' : 'Disabled',
    
    // Screen
    screenWidth: screen.width,
    screenHeight: screen.height,
    availWidth: screen.availWidth,
    availHeight: screen.availHeight,
    colorDepth: screen.colorDepth,
    pixelRatio: window.devicePixelRatio?.toString() || '1',
    orientation: screen.orientation?.type || 'unknown',
    
    // Window
    windowWidth: window.outerWidth,
    windowHeight: window.outerHeight,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    
    // System
    platform: navigator.platform,
    cpuCores: navigator.hardwareConcurrency?.toString() || 'Unknown',
    memory: nav.deviceMemory ? `${nav.deviceMemory} GB` : 'Unknown',
    touchSupport: 'ontouchstart' in window,
    online: navigator.onLine,
    
    // Network
    connectionType: conn?.type || 'Unknown',
    effectiveType: conn?.effectiveType || 'Unknown',
    downlink: conn?.downlink ? `${conn.downlink} Mbps` : 'Unknown'
  };
};

const getBrowserName = (): string => {
  const ua = navigator.userAgent;
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Edge')) return 'Edge';
  if (ua.includes('Opera')) return 'Opera';
  return 'Unknown';
};

const refresh = () => getInfo();

onMounted(getInfo);
</script>

