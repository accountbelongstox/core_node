<!--
  REDIRECT TO PYMATRIX MAIN PAGE
  This file redirects to the correct PyMatrix entry point at /pymatrix
-->
<script setup lang="ts">
// Redirect to the correct PyMatrix page
await navigateTo('/pymatrix', { replace: true });
</script>

<template>
  <div style="display: flex; align-items: center; justify-content: center; height: 100vh;">
    <p>Redirecting to PyMatrix...</p>
  </div>
</template>
