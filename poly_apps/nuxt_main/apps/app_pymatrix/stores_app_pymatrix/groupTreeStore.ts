/**
 * Group Tree Store
 * Manages group tree structure, selection, and operations
 */

import { defineStore } from 'pinia';
import type { GroupTreeNode } from '../../../types/pymatrix';

export interface GroupTreeState {
  tree: GroupTreeNode[];
  selectedIds: string[];
  expandedIds: string[];
  loading: boolean;
  error: string | null;
}

export const useGroupTreeStore = defineStore('groupTree', {
  state: (): GroupTreeState => ({
    tree: [],
    selectedIds: [],
    expandedIds: [],
    loading: false,
    error: null
  }),

  getters: {
    /**
     * Get all groups in the tree
     */
    allGroups: (state): GroupTreeNode[] => {
      const groups: GroupTreeNode[] = [];

      function collectGroups(nodes: GroupTreeNode[]) {
        nodes.forEach(node => {
          if (node.type === 'group') {
            groups.push(node);
            if (node.children) {
              collectGroups(node.children);
            }
          }
        });
      }

      collectGroups(state.tree);
      return groups;
    },

    /**
     * Get all devices in the tree
     */
    allDevices: (state): GroupTreeNode[] => {
      const devices: GroupTreeNode[] = [];

      function collectDevices(nodes: GroupTreeNode[]) {
        nodes.forEach(node => {
          if (node.type === 'device') {
            devices.push(node);
          } else if (node.children) {
            collectDevices(node.children);
          }
        });
      }

      collectDevices(state.tree);
      return devices;
    },

    /**
     * Get selected nodes
     */
    selectedNodes: (state): GroupTreeNode[] => {
      const selected: GroupTreeNode[] = [];

      function collectSelected(nodes: GroupTreeNode[]) {
        nodes.forEach(node => {
          if (state.selectedIds.includes(node.id)) {
            selected.push(node);
          }
          if (node.children) {
            collectSelected(node.children);
          }
        });
      }

      collectSelected(state.tree);
      return selected;
    },

    /**
     * Get tree statistics
     */
    stats: (state): { totalGroups: number; totalDevices: number; onlineDevices: number; selectedCount: number } => {
      let totalGroups = 0;
      let totalDevices = 0;
      let onlineDevices = 0;

      function countNodes(nodes: GroupTreeNode[]) {
        nodes.forEach(node => {
          if (node.type === 'group') {
            totalGroups++;
            if (node.children) {
              countNodes(node.children);
            }
          } else {
            totalDevices++;
            if (node.exists) {
              onlineDevices++;
            }
          }
        });
      }

      countNodes(state.tree);

      return {
        totalGroups,
        totalDevices,
        onlineDevices,
        selectedCount: state.selectedIds.length
      };
    },

    /**
     * Check if a node is expanded
     */
    isExpanded: (state) => (nodeId: string): boolean => {
      return state.expandedIds.includes(nodeId);
    },

    /**
     * Check if a node is selected
     */
    isSelected: (state) => (nodeId: string): boolean => {
      return state.selectedIds.includes(nodeId);
    },

    /**
     * Find a node by ID
     */
    findNode: (state) => (nodeId: string): GroupTreeNode | null => {
      function search(nodes: GroupTreeNode[]): GroupTreeNode | null {
        for (const node of nodes) {
          if (node.id === nodeId) {
            return node;
          }
          if (node.children) {
            const found = search(node.children);
            if (found) return found;
          }
        }
        return null;
      }

      return search(state.tree);
    },

    /**
     * Find parent node of a given node
     */
    findParent: (state) => (nodeId: string): GroupTreeNode | null => {
      function search(nodes: GroupTreeNode[], parent: GroupTreeNode | null = null): GroupTreeNode | null {
        for (const node of nodes) {
          if (node.id === nodeId) {
            return parent;
          }
          if (node.children) {
            const found = search(node.children, node);
            if (found !== null) return found;
          }
        }
        return null;
      }

      return search(state.tree);
    }
  },

  actions: {
    /**
     * Set tree data
     */
    setTree(tree: GroupTreeNode[]) {
      this.tree = tree;
      console.log('[GroupTreeStore] Tree data set:', tree.length, 'root nodes');
    },

    /**
     * Add a new group
     */
    addGroup(group: Omit<GroupTreeNode, 'id' | 'type'>, parentId?: string): string {
      const newGroup: GroupTreeNode = {
        ...group,
        id: `group-${Date.now()}`,
        type: 'group',
        children: []
      };

      if (parentId) {
        // Add to parent group
        const parent = this.findNode(parentId);
        if (parent && parent.type === 'group') {
          if (!parent.children) {
            parent.children = [];
          }
          parent.children.push(newGroup);
          console.log('[GroupTreeStore] Group added to parent:', parentId);
        }
      } else {
        // Add to root
        this.tree.push(newGroup);
        console.log('[GroupTreeStore] Group added to root');
      }

      return newGroup.id;
    },

    /**
     * Update a group
     */
    updateGroup(groupId: string, updates: Partial<GroupTreeNode>) {
      function update(nodes: GroupTreeNode[]): boolean {
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].id === groupId) {
            nodes[i] = { ...nodes[i], ...updates };
            console.log('[GroupTreeStore] Group updated:', groupId);
            return true;
          }
          if (nodes[i].children && update(nodes[i].children!)) {
            return true;
          }
        }
        return false;
      }

      update(this.tree);
    },

    /**
     * Delete a group
     */
    deleteGroup(groupId: string) {
      function remove(nodes: GroupTreeNode[]): boolean {
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].id === groupId) {
            nodes.splice(i, 1);
            console.log('[GroupTreeStore] Group deleted:', groupId);
            return true;
          }
          if (nodes[i].children && remove(nodes[i].children!)) {
            return true;
          }
        }
        return false;
      }

      remove(this.tree);

      // Remove from selected and expanded IDs
      this.selectedIds = this.selectedIds.filter(id => id !== groupId);
      this.expandedIds = this.expandedIds.filter(id => id !== groupId);
    },

    /**
     * Add a device to a group
     */
    addDeviceToGroup(device: Omit<GroupTreeNode, 'id' | 'type'>, groupId: string): string {
      const newDevice: GroupTreeNode = {
        ...device,
        id: `device-${Date.now()}`,
        type: 'device'
      };

      const group = this.findNode(groupId);
      if (group && group.type === 'group') {
        if (!group.children) {
          group.children = [];
        }
        group.children.push(newDevice);
        console.log('[GroupTreeStore] Device added to group:', groupId);
      }

      return newDevice.id;
    },

    /**
     * Move a device to a different group
     */
    moveDevice(deviceId: string, targetGroupId: string) {
      // Find and remove device from current location
      let device: GroupTreeNode | null = null;

      function removeDevice(nodes: GroupTreeNode[]): boolean {
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].id === deviceId && nodes[i].type === 'device') {
            device = nodes[i];
            nodes.splice(i, 1);
            return true;
          }
          if (nodes[i].children && removeDevice(nodes[i].children!)) {
            return true;
          }
        }
        return false;
      }

      if (removeDevice(this.tree) && device) {
        // Add device to target group
        const targetGroup = this.findNode(targetGroupId);
        if (targetGroup && targetGroup.type === 'group') {
          if (!targetGroup.children) {
            targetGroup.children = [];
          }
          targetGroup.children.push(device);
          console.log('[GroupTreeStore] Device moved to group:', targetGroupId);
        }
      }
    },

    /**
     * Remove a device from a group
     */
    removeDevice(deviceId: string) {
      function remove(nodes: GroupTreeNode[]): boolean {
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].id === deviceId && nodes[i].type === 'device') {
            nodes.splice(i, 1);
            console.log('[GroupTreeStore] Device removed:', deviceId);
            return true;
          }
          if (nodes[i].children && remove(nodes[i].children!)) {
            return true;
          }
        }
        return false;
      }

      remove(this.tree);
      this.selectedIds = this.selectedIds.filter(id => id !== deviceId);
    },

    /**
     * Update device status
     */
    updateDeviceStatus(deviceSerial: string, exists: boolean) {
      function update(nodes: GroupTreeNode[]): boolean {
        for (const node of nodes) {
          if (node.type === 'device' && node.deviceSerial === deviceSerial) {
            node.exists = exists;
            console.log('[GroupTreeStore] Device status updated:', deviceSerial, exists);
            return true;
          }
          if (node.children && update(node.children)) {
            return true;
          }
        }
        return false;
      }

      update(this.tree);
    },

    /**
     * Toggle node selection
     */
    toggleSelection(nodeId: string) {
      const index = this.selectedIds.indexOf(nodeId);
      if (index >= 0) {
        this.selectedIds.splice(index, 1);
      } else {
        this.selectedIds.push(nodeId);
      }
      console.log('[GroupTreeStore] Selection toggled:', nodeId);
    },

    /**
     * Set node selection
     */
    setSelection(nodeId: string, selected: boolean) {
      const index = this.selectedIds.indexOf(nodeId);
      if (selected && index < 0) {
        this.selectedIds.push(nodeId);
      } else if (!selected && index >= 0) {
        this.selectedIds.splice(index, 1);
      }
    },

    /**
     * Select all nodes
     */
    selectAll() {
      const allIds: string[] = [];

      function collectIds(nodes: GroupTreeNode[]) {
        nodes.forEach(node => {
          allIds.push(node.id);
          if (node.children) {
            collectIds(node.children);
          }
        });
      }

      collectIds(this.tree);
      this.selectedIds = allIds;
      console.log('[GroupTreeStore] All nodes selected:', allIds.length);
    },

    /**
     * Deselect all nodes
     */
    deselectAll() {
      this.selectedIds = [];
      console.log('[GroupTreeStore] All nodes deselected');
    },

    /**
     * Toggle node expansion
     */
    toggleExpansion(nodeId: string) {
      const index = this.expandedIds.indexOf(nodeId);
      if (index >= 0) {
        this.expandedIds.splice(index, 1);
      } else {
        this.expandedIds.push(nodeId);
      }
      console.log('[GroupTreeStore] Expansion toggled:', nodeId);
    },

    /**
     * Set node expansion
     */
    setExpansion(nodeId: string, expanded: boolean) {
      const index = this.expandedIds.indexOf(nodeId);
      if (expanded && index < 0) {
        this.expandedIds.push(nodeId);
      } else if (!expanded && index >= 0) {
        this.expandedIds.splice(index, 1);
      }
    },

    /**
     * Expand all nodes
     */
    expandAll() {
      const allGroupIds: string[] = [];

      function collectGroupIds(nodes: GroupTreeNode[]) {
        nodes.forEach(node => {
          if (node.type === 'group') {
            allGroupIds.push(node.id);
            if (node.children) {
              collectGroupIds(node.children);
            }
          }
        });
      }

      collectGroupIds(this.tree);
      this.expandedIds = allGroupIds;
      console.log('[GroupTreeStore] All groups expanded:', allGroupIds.length);
    },

    /**
     * Collapse all nodes
     */
    collapseAll() {
      this.expandedIds = [];
      console.log('[GroupTreeStore] All groups collapsed');
    },

    /**
     * Set loading state
     */
    setLoading(loading: boolean) {
      this.loading = loading;
    },

    /**
     * Set error state
     */
    setError(error: string | null) {
      this.error = error;
    },

    /**
     * Reset store to initial state
     */
    reset() {
      this.tree = [];
      this.selectedIds = [];
      this.expandedIds = [];
      this.loading = false;
      this.error = null;
      console.log('[GroupTreeStore] Store reset');
    }
  }
});
