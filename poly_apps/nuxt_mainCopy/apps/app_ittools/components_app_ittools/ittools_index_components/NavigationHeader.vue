<template>
  <div class="bg-white border-b border-gray-200">
    <div class="px-4 sm:px-6 lg:px-8 py-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <i class="fas fa-rocket text-white text-lg"></i>
          </div>
          <div>
            <slot name="title">
              <h1 class="text-2xl font-bold text-gray-900">Developer Hub</h1>
              <p class="text-sm text-gray-500">Web Automation & Developer Tools</p>
            </slot>
          </div>
        </div>
        <slot name="nav"></slot>
      </div>
    </div>
  </div>
</template>
