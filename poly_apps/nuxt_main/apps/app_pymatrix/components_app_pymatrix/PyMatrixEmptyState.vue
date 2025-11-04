<template>
  <div class="pm-empty-state">
    <div class="pm-empty-state__icon">📱</div>
    <h2 class="pm-empty-state__title">No Devices Connected</h2>
    <p class="pm-empty-state__message">
      Connect an Android device via ADB to start mirroring and control
    </p>
    <button class="pm-button pm-button--rainbow" @click="$emit('connect-device')">
      <span>+</span>
      <span>Connect Device</span>
    </button>
  </div>
</template>

<script setup lang="ts">
interface Emits {
  (e: 'connect-device'): void;
}

const emit = defineEmits<Emits>();
</script>
