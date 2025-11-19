<template>
  <BasePanel
    :model-value="modelValue"
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
        <div class="pm-tree" :class="{ loading: isLoading }">
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

          <div v-else>
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
import type { GroupTreeNode as TreeNode } from '@/types/pymatrix';

interface Props {
  modelValue?: boolean;
}

interface Emits {
  (e: 'close'): void;
  (e: 'apply', selectedIds: string[]): void;
  (e: 'refresh'): void;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false
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
