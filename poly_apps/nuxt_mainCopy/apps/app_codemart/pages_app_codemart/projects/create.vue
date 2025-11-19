<!--
  【DEVELOPMENT STANDARDS】
  - NO <style> tags allowed in this component
  - All styles must reference theme variables via class names
  - Theme file: common/styles/theme-base.css
  - Extended theme: apps/app_codemart/styles_app_codemart/theme-codemart.css

  Project Creation Page - Multi-step wizard for submitting new projects
-->
<template>
  <div class="codemart-page">
    <div class="codemart-container">
      <ProjectSubmissionWizard />
    </div>
  </div>
</template>

<script setup lang="ts">
import ProjectSubmissionWizard from '~/apps/app_codemart/components_app_codemart/project-submission/ProjectSubmissionWizard.vue'

definePageMeta({
  layout: 'default-with-nav',
  middleware: ['auth']
})
</script>

<!-- NO <style> tag - All styles defined in theme files -->
