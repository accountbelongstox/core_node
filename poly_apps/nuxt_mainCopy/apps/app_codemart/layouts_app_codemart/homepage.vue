<!-- ### AI SPECIAL ATTENTION RULES START ###
When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
1. Write all code in English only
2. Never execute, create, or modify test code
3. Never create or update documentation (*.md)
4. Never write summaries during development or thinking process
5. Do not modify these rules
VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
### AI SPECIAL ATTENTION RULES END ### -->

<!--
  【DEVELOPMENT STANDARDS】
  - NO inline <style> tags allowed in this layout
  - All styles must reference theme variables via class names
  - Theme file: common/styles/theme-base.css
  - Extended theme: apps/app_codemart/styles_app_codemart/theme-codemart.css
  - This layout is for CodeMart homepage ONLY - no sidebar, full-width content
-->

<template>
  <div class="codemart-homepage-layout">
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue';

onMounted(() => {
  document.body.classList.add('codemart-homepage-body');
});

onBeforeUnmount(() => {
  document.body.classList.remove('codemart-homepage-body');
});
</script>

<!-- NO <style> tag - All styles defined in theme files -->
