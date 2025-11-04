<template>
  <base-panel title="🖱️ Mouse Control" :collapsible="true" :default-collapsed="collapsed">
    <template #headerActions>
      <button
        class="pm-button pm-button--icon pm-button--sm pm-button--ocean"
        @click="showHelp = true"
        title="Show mouse controls help"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
          <path d="M5.255 5.786a.237.237 0 0 0 .241.247h.825c.138 0 .248-.113.266-.25.09-.656.54-1.134 1.342-1.134.686 0 1.314.343 1.314 1.168 0 .635-.374.927-.965 1.371-.673.489-1.206 1.06-1.168 1.987l.003.217a.25.25 0 0 0 .25.246h.811a.25.25 0 0 0 .25-.25v-.105c0-.718.273-.927 1.01-1.486.609-.463 1.244-.977 1.244-2.056 0-1.511-1.276-2.241-2.673-2.241-1.267 0-2.655.59-2.75 2.286zm1.557 5.763c0 .533.425.927 1.01.927.609 0 1.028-.394 1.028-.927 0-.552-.42-.94-1.029-.94-.584 0-1.009.388-1.009.94z"/>
        </svg>
      </button>
    </template>

    <!-- Mouse Buttons Section -->
    <div class="pm-mb-6">
      <h4 class="pm-panel__title" style="font-size: 14px; margin-bottom: 12px;">🖱️ Mouse Buttons</h4>
      <div class="pm-button-group" style="display: grid; grid-template-columns: repeat(2, 1fr);">
        <button
          v-for="btn in mouseButtons"
          :key="btn.id"
          class="pm-button pm-button--electric-blue"
          :class="{ 'pm-button--fire': activeButton === btn.id }"
          @click="handleMouseClick(btn.id)"
          :title="btn.description"
          style="flex-direction: column; height: auto; padding: 16px 12px;"
        >
          <div style="font-size: 28px;">{{ btn.icon }}</div>
          <div style="font-size: 12px;">{{ btn.label }}</div>
        </button>
      </div>
    </div>

    <!-- Gesture Controls Section -->
    <div class="pm-mb-6">
      <h4 class="pm-panel__title" style="font-size: 14px; margin-bottom: 12px;">👆 Gestures</h4>
      <div class="pm-button-group" style="display: grid; grid-template-columns: repeat(3, 1fr);">
        <button
          v-for="gesture in gestureControls"
          :key="gesture.id"
          class="pm-button pm-button--violet"
          @click="handleGesture(gesture.id)"
          :title="gesture.description"
          style="flex-direction: column; height: auto; padding: 12px 8px;"
        >
          <div style="font-size: 24px;">{{ gesture.icon }}</div>
          <div style="font-size: 11px;">{{ gesture.label }}</div>
        </button>
      </div>
    </div>

    <!-- Scroll Controls Section -->
    <div class="pm-mb-6">
      <h4 class="pm-panel__title" style="font-size: 14px; margin-bottom: 12px;">🔄 Scroll</h4>
      <div class="pm-button-group" style="display: flex;">
        <button
          class="pm-button pm-button--forest"
          @click="handleScroll('up')"
          title="Scroll up"
          style="flex: 1; gap: 8px;"
        >
          <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
            <path fill-rule="evenodd" d="M8 15a.5.5 0 0 0 .5-.5V2.707l3.146 3.147a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 1 0 .708.708L7.5 2.707V14.5a.5.5 0 0 0 .5.5z"/>
          </svg>
          <span>Scroll Up</span>
        </button>
        <button
          class="pm-button pm-button--forest"
          @click="handleScroll('down')"
          title="Scroll down"
          style="flex: 1; gap: 8px;"
        >
          <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
            <path fill-rule="evenodd" d="M8 1a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L7.5 13.293V1.5A.5.5 0 0 1 8 1z"/>
          </svg>
          <span>Scroll Down</span>
        </button>
      </div>
    </div>

    <!-- Advanced Settings -->
    <div class="pm-mb-0">
      <h4 class="pm-panel__title" style="font-size: 14px; margin-bottom: 12px;">⚙️ Settings</h4>
      <div style="display: flex; gap: 12px;">
        <label style="flex: 1; display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: rgba(255, 255, 255, 0.7); font-weight: 500;">
          <span>Swipe Duration (ms)</span>
          <input
            v-model.number="swipeDuration"
            type="number"
            class="pm-input"
            min="100"
            max="2000"
            step="50"
          />
        </label>
        <label style="flex: 1; display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: rgba(255, 255, 255, 0.7); font-weight: 500;">
          <span>Long Press (ms)</span>
          <input
            v-model.number="longPressDuration"
            type="number"
            class="pm-input"
            min="300"
            max="5000"
            step="100"
          />
        </label>
      </div>
    </div>

    <!-- Help Modal -->
    <base-modal v-if="showHelp" @close="showHelp = false">
      <template #header>
        <h3>🖱️ Mouse Control Help</h3>
      </template>
      <template #body>
        <div style="display: flex; flex-direction: column; gap: 20px;">
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <h4 style="margin: 0; font-size: 14px; font-weight: 600; color: rgba(255, 255, 255, 0.9);">Mouse Buttons</h4>
            <ul style="margin: 0; padding-left: 20px; list-style-type: disc;">
              <li style="margin: 6px 0; font-size: 13px; color: rgba(255, 255, 255, 0.7); line-height: 1.5;"><strong style="color: rgba(255, 255, 255, 0.9); font-weight: 600;">Left Click:</strong> Send single tap at center</li>
              <li style="margin: 6px 0; font-size: 13px; color: rgba(255, 255, 255, 0.7); line-height: 1.5;"><strong style="color: rgba(255, 255, 255, 0.9); font-weight: 600;">Right Click:</strong> Send long press (context menu)</li>
              <li style="margin: 6px 0; font-size: 13px; color: rgba(255, 255, 255, 0.7); line-height: 1.5;"><strong style="color: rgba(255, 255, 255, 0.9); font-weight: 600;">Middle Click:</strong> Send middle button tap</li>
              <li style="margin: 6px 0; font-size: 13px; color: rgba(255, 255, 255, 0.7); line-height: 1.5;"><strong style="color: rgba(255, 255, 255, 0.9); font-weight: 600;">Double Click:</strong> Send double tap rapidly</li>
            </ul>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <h4 style="margin: 0; font-size: 14px; font-weight: 600; color: rgba(255, 255, 255, 0.9);">Gestures</h4>
            <ul style="margin: 0; padding-left: 20px; list-style-type: disc;">
              <li style="margin: 6px 0; font-size: 13px; color: rgba(255, 255, 255, 0.7); line-height: 1.5;"><strong style="color: rgba(255, 255, 255, 0.9); font-weight: 600;">Swipe Up/Down/Left/Right:</strong> Simulate swipe gestures</li>
              <li style="margin: 6px 0; font-size: 13px; color: rgba(255, 255, 255, 0.7); line-height: 1.5;"><strong style="color: rgba(255, 255, 255, 0.9); font-weight: 600;">Long Press:</strong> Hold touch for context menus</li>
            </ul>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <h4 style="margin: 0; font-size: 14px; font-weight: 600; color: rgba(255, 255, 255, 0.9);">Scroll</h4>
            <ul style="margin: 0; padding-left: 20px; list-style-type: disc;">
              <li style="margin: 6px 0; font-size: 13px; color: rgba(255, 255, 255, 0.7); line-height: 1.5;"><strong style="color: rgba(255, 255, 255, 0.9); font-weight: 600;">Scroll Up/Down:</strong> Swipe up/down to scroll content</li>
            </ul>
          </div>
        </div>
      </template>
    </base-modal>
  </base-panel>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import BasePanel from '@/apps/app_pymatrix/components_app_pymatrix/shared/BasePanel.vue';
import BaseModal from '@/apps/app_pymatrix/components_app_pymatrix/shared/BaseModal.vue';

interface Props {
  serial: string;
  collapsed?: boolean;
}

interface Emits {
  (e: 'mouseAction', data: { action: string; data: any }): void;
}

const props = withDefaults(defineProps<Props>(), {
  collapsed: false
});

const emit = defineEmits<Emits>();

const activeButton = ref<string | null>(null);
const showHelp = ref(false);
const swipeDuration = ref(300);
const longPressDuration = ref(800);

const mouseButtons = [
  { id: 'left', icon: '👆', label: 'Left Click', description: 'Single tap' },
  { id: 'right', icon: '👉', label: 'Right Click', description: 'Long press (context menu)' },
  { id: 'middle', icon: '☝️', label: 'Middle Click', description: 'Middle button tap' },
  { id: 'double', icon: '👆👆', label: 'Double Click', description: 'Double tap' }
];

const gestureControls = [
  { id: 'swipe-up', icon: '⬆️', label: 'Swipe Up', description: 'Swipe from bottom to top' },
  { id: 'swipe-down', icon: '⬇️', label: 'Swipe Down', description: 'Swipe from top to bottom' },
  { id: 'swipe-left', icon: '⬅️', label: 'Swipe Left', description: 'Swipe from right to left' },
  { id: 'swipe-right', icon: '➡️', label: 'Swipe Right', description: 'Swipe from left to right' },
  { id: 'long-press', icon: '⏱️', label: 'Long Press', description: 'Hold touch for context menu' }
];

function handleMouseClick(buttonType: string) {
  activeButton.value = buttonType;
  setTimeout(() => (activeButton.value = null), 200);

  console.log(`[MouseControlPanel] Mouse ${buttonType} clicked for ${props.serial}`);

  switch (buttonType) {
    case 'left':
      // Send single tap at center
      emit('mouseAction', {
        action: 'tap',
        data: { x: 0.5, y: 0.5 }
      });
      break;

    case 'right':
      // Send long press (simulates right click / context menu)
      emit('mouseAction', {
        action: 'longPress',
        data: { x: 0.5, y: 0.5, duration: longPressDuration.value }
      });
      break;

    case 'middle':
      // Send middle button tap
      emit('mouseAction', {
        action: 'tap',
        data: { x: 0.5, y: 0.5, button: 'middle' }
      });
      break;

    case 'double':
      // Send double tap
      emit('mouseAction', {
        action: 'doubleTap',
        data: { x: 0.5, y: 0.5 }
      });
      break;
  }
}

function handleGesture(gestureType: string) {
  console.log(`[MouseControlPanel] Gesture ${gestureType} for ${props.serial}`);

  switch (gestureType) {
    case 'swipe-up':
      emit('mouseAction', {
        action: 'swipe',
        data: {
          x1: 0.5, y1: 0.8,
          x2: 0.5, y2: 0.2,
          duration: swipeDuration.value
        }
      });
      break;

    case 'swipe-down':
      emit('mouseAction', {
        action: 'swipe',
        data: {
          x1: 0.5, y1: 0.2,
          x2: 0.5, y2: 0.8,
          duration: swipeDuration.value
        }
      });
      break;

    case 'swipe-left':
      emit('mouseAction', {
        action: 'swipe',
        data: {
          x1: 0.8, y1: 0.5,
          x2: 0.2, y2: 0.5,
          duration: swipeDuration.value
        }
      });
      break;

    case 'swipe-right':
      emit('mouseAction', {
        action: 'swipe',
        data: {
          x1: 0.2, y1: 0.5,
          x2: 0.8, y2: 0.5,
          duration: swipeDuration.value
        }
      });
      break;

    case 'long-press':
      emit('mouseAction', {
        action: 'longPress',
        data: { x: 0.5, y: 0.5, duration: longPressDuration.value }
      });
      break;
  }
}

function handleScroll(direction: 'up' | 'down') {
  console.log(`[MouseControlPanel] Scroll ${direction} for ${props.serial}`);

  // Scroll is implemented as a swipe gesture
  if (direction === 'up') {
    emit('mouseAction', {
      action: 'swipe',
      data: {
        x1: 0.5, y1: 0.6,
        x2: 0.5, y2: 0.4,
        duration: 200
      }
    });
  } else {
    emit('mouseAction', {
      action: 'swipe',
      data: {
        x1: 0.5, y1: 0.4,
        x2: 0.5, y2: 0.6,
        duration: 200
      }
    });
  }
}
</script>

