<template>
  <div class="codemart-app">
    <CodeMartHeader />
    <div class="codemart-content">
      <CodemartSidebar />
      <div class="codemart-main">
        <slot />
      </div>
    </div>
    <CodeMartFooter />
  </div>
</template>

<script setup lang="ts">
import CodeMartHeader from '../CodeMartHeader.vue';
import CodemartSidebar from '../CodemartSidebar.vue';
import CodeMartFooter from '../CodeMartFooter.vue';
</script>

<style scoped>
.codemart-app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.codemart-content {
  display: flex;
  flex: 1;
}

.codemart-main {
  flex: 1;
  padding: 2rem;
}
</style>
