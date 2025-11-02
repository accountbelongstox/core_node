<template>
  <BasePanel
    :show="show"
    size="lg"
    title="Group Tree Management"
    title-icon="🌳"
    @close="emit('close')"
  >
    <template #body>
      <div class="group-tree-container">
        <!-- Toolbar -->
        <div class="tree-toolbar">
          <!-- Search -->
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input
              v-model="searchQuery"
              type="text"
              class="search-input"
              placeholder="Search groups or devices..."
            />
            <button
              v-if="searchQuery"
              class="clear-search-btn"
              @click="searchQuery = ''"
            >
              ✕
            </button>
          </div>

          <!-- Actions -->
          <div class="tree-actions">
            <button class="action-btn primary" @click="handleAddGroup">
              <span class="btn-icon">➕</span>
              <span class="btn-text">Add Group</span>
            </button>
            <button class="action-btn" @click="handleRefresh">
              <span class="btn-icon">🔄</span>
              <span class="btn-text">Refresh</span>
            </button>
            <button class="action-btn" @click="handleSelectAll">
              <span class="btn-icon">☑️</span>
              <span class="btn-text">Select All</span>
            </button>
            <button class="action-btn" @click="handleDeselectAll">
              <span class="btn-icon">☐</span>
              <span class="btn-text">Deselect All</span>
            </button>
          </div>
        </div>

        <!-- Tree View -->
        <div class="tree-view" :class="{ loading: isLoading }">
          <div v-if="isLoading" class="loading-state">
            <div class="spinner"></div>
            <p>Loading group tree...</p>
          </div>

          <div v-else-if="error" class="error-state">
            <p class="error-message">{{ error }}</p>
            <button class="retry-btn" @click="handleRefresh">Retry</button>
          </div>

          <div v-else-if="filteredTree.length === 0" class="empty-state">
            <span class="empty-icon">📂</span>
            <p class="empty-message">
              {{ searchQuery ? 'No matches found' : 'No groups created yet' }}
            </p>
            <button v-if="!searchQuery" class="create-btn" @click="handleAddGroup">
              Create First Group
            </button>
          </div>

          <div v-else class="tree-nodes">
            <GroupTreeNode
              v-for="node in filteredTree"
              :key="node.id"
              :node="node"
              :depth="0"
              @select="handleSelect"
              @expand="handleExpand"
              @context-menu="handleContextMenu"
              @drop-device="handleDropDevice"
            />
          </div>
        </div>

        <!-- Stats -->
        <div class="tree-stats">
          <div class="stat-item">
            <span class="stat-label">Groups:</span>
            <span class="stat-value">{{ stats.totalGroups }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Devices:</span>
            <span class="stat-value">{{ stats.totalDevices }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Online:</span>
            <span class="stat-value">{{ stats.onlineDevices }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Selected:</span>
            <span class="stat-value">{{ stats.selectedCount }}</span>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="tree-footer">
        <BaseButton
          variant="ghost"
          @click="emit('close')"
        >
          Close
        </BaseButton>
        <BaseButton
          variant="primary"
          :disabled="stats.selectedCount === 0"
          @click="handleApply"
        >
          Apply Selection ({{ stats.selectedCount }})
        </BaseButton>
      </div>
    </template>
  </BasePanel>

  <!-- Context Menu (simple version, can be replaced with BaseContextMenu) -->
  <div
    v-if="showContextMenu"
    class="context-menu"
    :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
    @click.stop
  >
    <div v-if="contextMenu.node?.type === 'group'" class="context-menu-items">
      <button class="context-menu-item" @click="handleAddSubGroup">
        ➕ Add Sub-Group
      </button>
      <button class="context-menu-item" @click="handleRenameGroup">
        ✏️ Rename Group
      </button>
      <div class="context-menu-divider"></div>
      <button class="context-menu-item danger" @click="handleDeleteGroup">
        🗑️ Delete Group
      </button>
    </div>
    <div v-else class="context-menu-items">
      <button class="context-menu-item" @click="handleRemoveDevice">
        ➖ Remove from Group
      </button>
    </div>
  </div>

  <!-- Overlay for context menu -->
  <div
    v-if="showContextMenu"
    class="context-menu-overlay"
    @click="closeContextMenu"
  ></div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import BasePanel from '~/common/components/ui/BasePanel.vue';
import BaseButton from '~/common/components/ui/BaseButton.vue';
import GroupTreeNode from './GroupTreeNode.vue';
import type { GroupTreeNode as TreeNode } from '../../../types/pymatrix';

interface Props {
  show?: boolean;
}

interface Emits {
  (e: 'close'): void;
  (e: 'apply', selectedIds: string[]): void;
  (e: 'refresh'): void;
}

const props = withDefaults(defineProps<Props>(), {
  show: false
});

const emit = defineEmits<Emits>();

// State
const searchQuery = ref('');
const isLoading = ref(false);
const error = ref<string | null>(null);
const treeData = ref<TreeNode[]>([]);
const showContextMenu = ref(false);
const contextMenu = ref<{ node: TreeNode | null; x: number; y: number }>({
  node: null,
  x: 0,
  y: 0
});

// Computed
const filteredTree = computed(() => {
  if (!searchQuery.value) return treeData.value;

  const query = searchQuery.value.toLowerCase();

  function filterNodes(nodes: TreeNode[]): TreeNode[] {
    return nodes.filter(node => {
      const nameMatch = node.name.toLowerCase().includes(query);
      const serialMatch = node.deviceSerial?.toLowerCase().includes(query);
      const hasMatchingChildren = node.children && filterNodes(node.children).length > 0;

      return nameMatch || serialMatch || hasMatchingChildren;
    }).map(node => {
      if (node.children) {
        return { ...node, children: filterNodes(node.children) };
      }
      return node;
    });
  }

  return filterNodes(treeData.value);
});

const stats = computed(() => {
  function countNodes(nodes: TreeNode[], counts = { totalGroups: 0, totalDevices: 0, onlineDevices: 0, selectedCount: 0 }) {
    nodes.forEach(node => {
      if (node.type === 'group') {
        counts.totalGroups++;
        if (node.children) {
          countNodes(node.children, counts);
        }
      } else {
        counts.totalDevices++;
        if (node.exists) {
          counts.onlineDevices++;
        }
      }
      if (node.selected) {
        counts.selectedCount++;
      }
    });
    return counts;
  }

  return countNodes(treeData.value);
});

// Methods
async function loadTreeData() {
  isLoading.value = true;
  error.value = null;

  try {
    // TODO: Call API to fetch group tree
    // For now, create sample data
    await new Promise(resolve => setTimeout(resolve, 500));

    treeData.value = [
      {
        id: 'group-1',
        name: 'Production Devices',
        type: 'group',
        selected: false,
        children: [
          {
            id: 'device-1',
            name: 'Device A',
            type: 'device',
            deviceSerial: 'abc123456',
            selected: false,
            exists: true
          },
          {
            id: 'device-2',
            name: 'Device B',
            type: 'device',
            deviceSerial: 'def789012',
            selected: false,
            exists: false
          }
        ]
      },
      {
        id: 'group-2',
        name: 'Test Devices',
        type: 'group',
        selected: false,
        children: []
      }
    ];

    console.log('[GroupTreeView] Tree data loaded');
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load group tree';
    console.error('[GroupTreeView] Load error:', err);
  } finally {
    isLoading.value = false;
  }
}

function handleSelect(nodeId: string, selected: boolean) {
  function updateNode(nodes: TreeNode[]): TreeNode[] {
    return nodes.map(node => {
      if (node.id === nodeId) {
        return { ...node, selected };
      }
      if (node.children) {
        return { ...node, children: updateNode(node.children) };
      }
      return node;
    });
  }

  treeData.value = updateNode(treeData.value);
  console.log('[GroupTreeView] Node selected:', nodeId, selected);
}

function handleExpand(nodeId: string, expanded: boolean) {
  console.log('[GroupTreeView] Node expanded:', nodeId, expanded);
}

function handleContextMenu(event: { node: TreeNode; x: number; y: number }) {
  contextMenu.value = event;
  showContextMenu.value = true;
  console.log('[GroupTreeView] Context menu opened for:', event.node.name);
}

function closeContextMenu() {
  showContextMenu.value = false;
}

function handleDropDevice(event: { deviceSerial: string; targetGroupId: string }) {
  console.log('[GroupTreeView] Device dropped:', event.deviceSerial, 'into', event.targetGroupId);
  // TODO: Call API to move device to group
}

function handleAddGroup() {
  console.log('[GroupTreeView] Add group');
  // TODO: Show dialog to add group
}

function handleAddSubGroup() {
  console.log('[GroupTreeView] Add sub-group to:', contextMenu.value.node?.name);
  closeContextMenu();
}

function handleRenameGroup() {
  console.log('[GroupTreeView] Rename group:', contextMenu.value.node?.name);
  closeContextMenu();
}

function handleDeleteGroup() {
  console.log('[GroupTreeView] Delete group:', contextMenu.value.node?.name);
  closeContextMenu();
}

function handleRemoveDevice() {
  console.log('[GroupTreeView] Remove device:', contextMenu.value.node?.name);
  closeContextMenu();
}

function handleRefresh() {
  loadTreeData();
  emit('refresh');
}

function handleSelectAll() {
  function selectAllNodes(nodes: TreeNode[]): TreeNode[] {
    return nodes.map(node => ({
      ...node,
      selected: true,
      children: node.children ? selectAllNodes(node.children) : undefined
    }));
  }

  treeData.value = selectAllNodes(treeData.value);
  console.log('[GroupTreeView] All nodes selected');
}

function handleDeselectAll() {
  function deselectAllNodes(nodes: TreeNode[]): TreeNode[] {
    return nodes.map(node => ({
      ...node,
      selected: false,
      children: node.children ? deselectAllNodes(node.children) : undefined
    }));
  }

  treeData.value = deselectAllNodes(treeData.value);
  console.log('[GroupTreeView] All nodes deselected');
}

function handleApply() {
  const selectedIds: string[] = [];

  function collectSelected(nodes: TreeNode[]) {
    nodes.forEach(node => {
      if (node.selected) {
        selectedIds.push(node.id);
      }
      if (node.children) {
        collectSelected(node.children);
      }
    });
  }

  collectSelected(treeData.value);
  emit('apply', selectedIds);
  console.log('[GroupTreeView] Applied selection:', selectedIds);
}

onMounted(() => {
  loadTreeData();
});
</script>

<style scoped>
.group-tree-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 600px;
}

.tree-toolbar {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  font-size: 16px;
  pointer-events: none;
}

.search-input {
  flex: 1;
  padding: 10px 40px 10px 40px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  transition: all 0.2s ease;
}

.search-input:focus {
  outline: none;
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(59, 130, 246, 0.5);
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.clear-search-btn {
  position: absolute;
  right: 8px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;
}

.clear-search-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.9);
}

.tree-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
}

.action-btn.primary {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border-color: #3b82f6;
}

.action-btn.primary:hover {
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.btn-icon {
  font-size: 14px;
}

.btn-text {
  font-size: 13px;
}

.tree-view {
  flex: 1;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px;
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(59, 130, 246, 0.2);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-message {
  color: #ef4444;
  font-size: 14px;
}

.retry-btn {
  padding: 8px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}

.empty-icon {
  font-size: 48px;
  opacity: 0.5;
}

.empty-message {
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
}

.create-btn {
  padding: 10px 20px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s ease;
}

.create-btn:hover {
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  transform: translateY(-2px);
}

.tree-stats {
  display: flex;
  gap: 16px;
  padding: 12px;
  background: rgba(59, 130, 246, 0.05);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 8px;
}

.stat-item {
  display: flex;
  gap: 6px;
  font-size: 13px;
}

.stat-label {
  color: rgba(255, 255, 255, 0.6);
}

.stat-value {
  color: rgba(255, 255, 255, 0.95);
  font-weight: 700;
  padding: 0 8px;
  background: rgba(59, 130, 246, 0.2);
  border-radius: 4px;
}

.tree-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* Context Menu */
.context-menu {
  position: fixed;
  z-index: 10001;
  min-width: 200px;
  background: linear-gradient(135deg, rgba(20, 20, 20, 0.98) 0%, rgba(30, 30, 30, 0.98) 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(16px);
  padding: 4px;
}

.context-menu-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.context-menu-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.context-menu-item.danger {
  color: #ef4444;
}

.context-menu-item.danger:hover {
  background: rgba(239, 68, 68, 0.15);
}

.context-menu-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 4px 8px;
}

.context-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10000;
}
</style>
