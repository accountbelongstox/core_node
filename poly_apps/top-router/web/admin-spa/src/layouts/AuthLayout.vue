<template>
  <div
    class="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-900"
  >
    <!-- Dynamic Background -->
    <div class="absolute inset-0 z-0">
      <div
        class="animate-gradient-xy absolute inset-0 bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 dark:from-indigo-900/40 dark:via-purple-900/40 dark:to-pink-900/40"
      ></div>

      <!-- Decorative Blobs -->
      <div
        class="animate-blob absolute left-0 top-0 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-400/30 opacity-70 mix-blend-multiply blur-3xl filter"
      ></div>
      <div
        class="animate-blob animation-delay-2000 absolute right-0 top-0 h-96 w-96 -translate-y-1/2 translate-x-1/2 rounded-full bg-purple-400/30 opacity-70 mix-blend-multiply blur-3xl filter"
      ></div>
      <div
        class="animate-blob animation-delay-4000 absolute -bottom-32 left-20 h-96 w-96 rounded-full bg-pink-400/30 opacity-70 mix-blend-multiply blur-3xl filter"
      ></div>
    </div>

    <!-- Content Container -->
    <div class="relative z-10 flex w-full flex-col items-center px-4 py-8 sm:px-6 lg:px-8">
      <div class="mb-8 text-center">
        <h1
          class="text-3xl font-bold tracking-tight text-slate-900 drop-shadow-sm dark:text-white sm:text-4xl"
        >
          Top Router
        </h1>
        <p class="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">统一 AI 访问入口</p>
      </div>

      <router-view v-slot="{ Component }">
        <transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="transform scale-95 opacity-0"
          enter-to-class="transform scale-100 opacity-100"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="transform scale-100 opacity-100"
          leave-to-class="transform scale-95 opacity-0"
          mode="out-in"
        >
          <component :is="Component" />
        </transition>
      </router-view>

      <div class="mt-8 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
        &copy; {{ new Date().getFullYear() }} Top Router Service. All rights reserved.
      </div>
    </div>
  </div>
</template>

<script setup>
// Layout logic here if needed
</script>

<style scoped>
.animate-gradient-xy {
  background-size: 400% 400%;
  animation: gradient-xy 15s ease infinite;
}

@keyframes gradient-xy {
  0%,
  100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

.animate-blob {
  animation: blob 7s infinite;
}

.animation-delay-2000 {
  animation-delay: 2s;
}

.animation-delay-4000 {
  animation-delay: 4s;
}

@keyframes blob {
  0% {
    transform: translate(0px, 0px) scale(1);
  }
  33% {
    transform: translate(30px, -50px) scale(1.1);
  }
  66% {
    transform: translate(-20px, 20px) scale(0.9);
  }
  100% {
    transform: translate(0px, 0px) scale(1);
  }
}
</style>
