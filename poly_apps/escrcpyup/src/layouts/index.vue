<template>
  <!--
    ================================================================
    LAYOUT ROUTER
    ================================================================
    Switches between different layout modes based on route.meta.layout

    Available layouts:
    - 'default': Original escrcpy UI (full screen)
    - 'wrapper': Extended UI with left sidebar + center canvas + right tools

    ⚠️ DO NOT MODIFY: The routing logic must remain unchanged
    ================================================================
  -->
  <component :is="activeLayout" class=""></component>
</template>

<script setup>
import DefaultLayout from './default/index.vue'
import WrapperLayout from './wrapper/index.vue'

/*
  ================================================================
  LAYOUT MAP
  ================================================================
  ⚠️ IMPORTANT: DO NOT remove 'default' layout
  ✏️ You can add more custom layouts here
  ================================================================
*/
const LayoutMap = {
  default: DefaultLayout, // Original escrcpy UI
  wrapper: WrapperLayout, // Extended UI with outer frame
}

const route = useRoute()

/*
  ================================================================
  ACTIVE LAYOUT SELECTION
  ================================================================
  Defaults to 'wrapper' layout for the extended UI experience
  To use original UI, set route.meta.layout = 'default'

  ✏️ Change 'wrapper' to 'default' below if you want original UI as default
  ================================================================
*/
const activeLayout = computed(() => LayoutMap[route.meta.layout || 'wrapper'])
</script>
