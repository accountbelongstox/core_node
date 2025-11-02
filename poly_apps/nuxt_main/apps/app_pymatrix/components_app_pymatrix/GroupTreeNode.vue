<template>
  <div class="tree-node" :class="{ 'is-selected': node.selected, 'is-group': node.type === 'group' }">
    <div
      class="node-content"
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
        class="expand-btn"
        @click.stop="toggleExpand"
      >
        <span class="expand-icon" :class="{ expanded }">▶</span>
      </button>
      <span v-else class="expand-spacer"></span>

      <!-- Node Icon -->
      <span class="node-icon">{{ node.type === 'group' ? '📁' : '📱' }}</span>

      <!-- Node Name -->
      <span class="node-name">{{ node.name }}</span>

      <!-- Device Serial (for devices) -->
      <span v-if="node.type === 'device' && node.deviceSerial" class="node-serial">
        {{ node.deviceSerial.substring(0, 8) }}
      </span>

      <!-- Exists Status -->
      <span v-if="node.type === 'device'" class="node-status" :class="{ online: node.exists }">
        {{ node.exists ? '●' : '○' }}
      </span>

      <!-- Selection Checkbox -->
      <input
        type="checkbox"
        class="node-checkbox"
        :checked="node.selected"
        @click.stop
        @change="handleSelect"
      />
    </div>

    <!-- Children (recursive) -->
    <div v-if="node.type === 'group' && expanded && hasChildren" class="node-children">
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
import type { GroupTreeNode as TreeNode } from '../../../types/pymatrix';

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

<style scoped>
.tree-node {
  user-select: none;
}

.node-content {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  padding-right: 12px;
  min-height: 36px;
  border-radius: 6px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.node-content:hover {
  background: rgba(255, 255, 255, 0.05);
}

.tree-node.is-selected > .node-content {
  background: rgba(59, 130, 246, 0.15);
  border-left: 3px solid #3b82f6;
}

.tree-node.is-group > .node-content {
  font-weight: 600;
}

.expand-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.6);
  transition: all 0.2s ease;
}

.expand-btn:hover {
  color: rgba(255, 255, 255, 0.9);
  transform: scale(1.2);
}

.expand-icon {
  font-size: 10px;
  transition: transform 0.2s ease;
  display: inline-block;
}

.expand-icon.expanded {
  transform: rotate(90deg);
}

.expand-spacer {
  width: 20px;
}

.node-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.node-name {
  flex: 1;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-serial {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  font-family: monospace;
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.node-status {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
}

.node-status.online {
  color: #22c55e;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.node-checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: #3b82f6;
  flex-shrink: 0;
}

.node-children {
  margin-left: 0;
}

/* Drag and drop styles */
.node-content.drag-over {
  background: rgba(34, 197, 94, 0.15);
  border: 2px dashed #22c55e;
}
</style>
