<!--
  PYMATRIX LAYOUT WRAPPER

  This is a wrapper that imports the actual PyMatrix layout from the app directory.
  Nuxt requires layouts to be in the layouts/ directory.
-->
<script setup lang="ts">
import PyMatrixLayout from '~/apps/app_pymatrix/layouts_app_pymatrix/default.vue';
</script>

<template>
  <PyMatrixLayout />
</template>
