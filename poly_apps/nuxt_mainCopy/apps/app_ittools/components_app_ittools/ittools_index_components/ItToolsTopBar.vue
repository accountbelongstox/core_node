<template>
  <header class="bg-white border-b border-gray-200 shadow-sm">
    <div class="px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center h-16">
        <div class="flex items-center">
          <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <i class="fas fa-rocket text-white text-lg"></i>
          </div>
          <div class="ml-4">
            <h1 class="text-xl font-bold text-gray-900">Developer Hub</h1>
            <p class="text-xs text-gray-500">Web Automation & Developer Tools</p>
          </div>
        </div>
        <div class="flex items-center space-x-4">
          <div
            class="flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium"
            :class="connection.connected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
          >
            <div class="w-2 h-2 rounded-full" :class="connection.connected ? 'bg-green-500' : 'bg-red-500'"></div>
            <span>{{ connection.text }}</span>
          </div>
          <button
            @click="$emit('toggle-sidebar')"
            class="p-2 text-gray-600 hover:text-gray-900 transition rounded-lg hover:bg-gray-100"
          >
            <i class="fas fa-bars text-xl"></i>
          </button>
          <button class="p-2 text-gray-600 hover:text-gray-900 transition rounded-lg hover:bg-gray-100">
            <i class="fas fa-user-circle text-xl"></i>
          </button>
        </div>
      </div>
    </div>
    <div class="border-t border-gray-200">
      <div class="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <slot name="logo"></slot>
        <nav class="hidden md:flex space-x-1">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="$emit('switch-tab', tab.id)"
            :class="[
              'px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer flex items-center',
              activeTab === tab.id
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-transparent'
            ]"
          >
            <i :class="tab.icon" class="mr-2"></i>
            {{ tab.name }}
            <span v-if="tab.badge" class="ml-2 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
              {{ tab.badge }}
            </span>
          </button>
        </nav>
        <button class="md:hidden p-2 text-gray-600 hover:text-gray-900">
          <i class="fas fa-bars text-xl"></i>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
interface TabItem {
  id: string;
  name: string;
  icon: string;
  badge?: string;
}

const props = defineProps<{
  tabs: TabItem[];
  activeTab: string;
  connection: { text: string; connected: boolean };
}>();

defineEmits(['toggle-sidebar', 'switch-tab']);
</script>
