<template>
  <div class="pm-tree-node" :class="{ 'pm-tree-node--selected': node.selected, 'pm-tree-node--group': node.type === 'group' }">
    <div
      class="pm-tree-node__header"
      :class="{ 'pm-tree-node__header--selected': node.selected }"
      :style="{ paddingLeft: `${depth * 20}px` }"
      @click="handleClick"
      @contextmenu.prevent="handleContextMenu"
      @drop.prevent="handleDrop"
      @dragover.prevent="handleDragOver"
      @dragleave="handleDragLeave"
    >
      <!-- Expand/Collapse Button -->
      <button
        v-if="node.type === 'group' && hasChildren"
        class="pm-tree-node__toggle"
        @click.stop="toggleExpand"
      >
        <span class="pm-tree-node__toggle-icon" :class="{ 'pm-tree-node__toggle-icon--expanded': expanded }">▶</span>
      </button>
      <span v-else class="pm-tree-node__spacer"></span>

      <!-- Node Icon -->
      <span class="pm-tree-node__icon">{{ node.type === 'group' ? '📁' : '📱' }}</span>

      <!-- Node Name -->
      <span class="pm-tree-node__text">{{ node.name }}</span>

      <!-- Device Serial (for devices) -->
      <span v-if="node.type === 'device' && node.deviceSerial" class="pm-tree-node__serial">
        {{ node.deviceSerial.substring(0, 8) }}
      </span>

      <!-- Exists Status -->
      <span v-if="node.type === 'device'" class="pm-tree-node__status" :class="{ 'pm-tree-node__status--online': node.exists }">
        {{ node.exists ? '●' : '○' }}
      </span>

      <!-- Selection Checkbox -->
      <input
        type="checkbox"
        class="pm-tree-node__checkbox"
        :checked="node.selected"
        @click.stop
        @change="handleSelect"
      />
    </div>

    <!-- Children (recursive) -->
    <div v-if="node.type === 'group' && expanded && hasChildren" class="pm-tree-node__children">
      <GroupTreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
        @select="emit('select', $event)"
        @expand="emit('expand', $event)"
        @context-menu="emit('context-menu', $event)"
        @drop-device="emit('drop-device', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { GroupTreeNode as TreeNode } from '@/types/pymatrix';

interface Props {
  node: TreeNode;
  depth?: number;
}

interface Emits {
  (e: 'select', nodeId: string, selected: boolean): void;
  (e: 'expand', nodeId: string, expanded: boolean): void;
  (e: 'context-menu', event: { node: TreeNode; x: number; y: number }): void;
  (e: 'drop-device', event: { deviceSerial: string; targetGroupId: string }): void;
}

const props = withDefaults(defineProps<Props>(), {
  depth: 0
});

const emit = defineEmits<Emits>();

const expanded = ref(true);
const isDragOver = ref(false);

const hasChildren = computed(() =>
  props.node.children && props.node.children.length > 0
);

function toggleExpand() {
  if (props.node.type !== 'group') return;
  expanded.value = !expanded.value;
  emit('expand', props.node.id, expanded.value);
}

function handleClick() {
  console.log('[GroupTreeNode] Clicked:', props.node.name);
}

function handleSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  emit('select', props.node.id, target.checked);
  console.log('[GroupTreeNode] Selected:', props.node.name, target.checked);
}

function handleContextMenu(event: MouseEvent) {
  emit('context-menu', {
    node: props.node,
    x: event.clientX,
    y: event.clientY
  });
  console.log('[GroupTreeNode] Context menu:', props.node.name);
}

function handleDragOver(event: DragEvent) {
  if (props.node.type !== 'group') return;

  event.preventDefault();
  isDragOver.value = true;
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
}

function handleDragLeave() {
  isDragOver.value = false;
}

function handleDrop(event: DragEvent) {
  if (props.node.type !== 'group') return;

  isDragOver.value = false;

  if (event.dataTransfer) {
    const deviceSerial = event.dataTransfer.getData('text/plain');
    if (deviceSerial) {
      emit('drop-device', {
        deviceSerial,
        targetGroupId: props.node.id
      });
      console.log('[GroupTreeNode] Device dropped:', deviceSerial, 'into group:', props.node.name);
    }
  }
}
</script>

