import { defineStore } from 'pinia';

export interface DeviceTag {
  id: string;
  name: string;
  color: string;
  description?: string;
  isPredefined: boolean;
  createdAt: string;
  usageCount: number;
}

interface TagsState {
  tags: DeviceTag[];
  selectedTagIds: string[];
}

export const useTagsStore = defineStore('pymatrix-tags', {
  state: (): TagsState => ({
    tags: [],
    selectedTagIds: []
  }),

  getters: {
    /**
     * Get all tags sorted by usage count
     */
    allTags: (state): DeviceTag[] => {
      return [...state.tags].sort((a, b) => b.usageCount - a.usageCount);
    },

    /**
     * Get predefined tags
     */
    predefinedTags: (state): DeviceTag[] => {
      return state.tags.filter(tag => tag.isPredefined);
    },

    /**
     * Get custom tags
     */
    customTags: (state): DeviceTag[] => {
      return state.tags.filter(tag => !tag.isPredefined);
    },

    /**
     * Get tags by IDs
     */
    getTagsByIds: (state) => (tagIds: string[]): DeviceTag[] => {
      return state.tags.filter(tag => tagIds.includes(tag.id));
    },

    /**
     * Find tag by ID
     */
    getTagById: (state) => (tagId: string): DeviceTag | undefined => {
      return state.tags.find(tag => tag.id === tagId);
    },

    /**
     * Find tag by name
     */
    getTagByName: (state) => (name: string): DeviceTag | undefined => {
      return state.tags.find(tag => tag.name.toLowerCase() === name.toLowerCase());
    },

    /**
     * Get selected tags
     */
    selectedTags: (state): DeviceTag[] => {
      return state.tags.filter(tag => state.selectedTagIds.includes(tag.id));
    },

    /**
     * Check if any tags are selected
     */
    hasSelectedTags: (state): boolean => {
      return state.selectedTagIds.length > 0;
    }
  },

  actions: {
    /**
     * Initialize tags store with predefined tags and load from localStorage
     */
    initializeTags() {
      // Load from localStorage first
      this.loadFromLocalStorage();

      // If no tags exist, create predefined tags
      if (this.tags.length === 0) {
        const predefinedTags: DeviceTag[] = [
          {
            id: 'tag-production',
            name: 'Production',
            color: '#ef4444',
            description: 'Production environment devices',
            isPredefined: true,
            createdAt: new Date().toISOString(),
            usageCount: 0
          },
          {
            id: 'tag-testing',
            name: 'Testing',
            color: '#f59e0b',
            description: 'Testing and QA devices',
            isPredefined: true,
            createdAt: new Date().toISOString(),
            usageCount: 0
          },
          {
            id: 'tag-development',
            name: 'Development',
            color: '#10b981',
            description: 'Development environment devices',
            isPredefined: true,
            createdAt: new Date().toISOString(),
            usageCount: 0
          },
          {
            id: 'tag-demo',
            name: 'Demo',
            color: '#3b82f6',
            description: 'Demo and presentation devices',
            isPredefined: true,
            createdAt: new Date().toISOString(),
            usageCount: 0
          },
          {
            id: 'tag-backup',
            name: 'Backup',
            color: '#8b5cf6',
            description: 'Backup devices',
            isPredefined: true,
            createdAt: new Date().toISOString(),
            usageCount: 0
          }
        ];

        this.tags = predefinedTags;
        this.saveToLocalStorage();
      }
    },

    /**
     * Create a new tag
     */
    createTag(tagData: { name: string; color: string; description?: string }): DeviceTag | null {
      // Check for duplicate name
      if (this.getTagByName(tagData.name)) {
        console.warn(`Tag with name "${tagData.name}" already exists`);
        return null;
      }

      const newTag: DeviceTag = {
        id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: tagData.name,
        color: tagData.color,
        description: tagData.description,
        isPredefined: false,
        createdAt: new Date().toISOString(),
        usageCount: 0
      };

      this.tags.push(newTag);
      this.saveToLocalStorage();
      return newTag;
    },

    /**
     * Update an existing tag
     */
    updateTag(tagId: string, updates: Partial<Pick<DeviceTag, 'name' | 'color' | 'description'>>): boolean {
      const tag = this.getTagById(tagId);
      if (!tag) {
        console.warn(`Tag with ID "${tagId}" not found`);
        return false;
      }

      // Prevent editing predefined tag names
      if (tag.isPredefined && updates.name && updates.name !== tag.name) {
        console.warn('Cannot change name of predefined tag');
        return false;
      }

      // Check for duplicate name
      if (updates.name && updates.name !== tag.name && this.getTagByName(updates.name)) {
        console.warn(`Tag with name "${updates.name}" already exists`);
        return false;
      }

      Object.assign(tag, updates);
      this.saveToLocalStorage();
      return true;
    },

    /**
     * Delete a tag
     */
    deleteTag(tagId: string): boolean {
      const tagIndex = this.tags.findIndex(tag => tag.id === tagId);
      if (tagIndex === -1) {
        console.warn(`Tag with ID "${tagId}" not found`);
        return false;
      }

      const tag = this.tags[tagIndex];
      if (tag.isPredefined) {
        console.warn('Cannot delete predefined tag');
        return false;
      }

      this.tags.splice(tagIndex, 1);

      // Remove from selected tags if present
      const selectedIndex = this.selectedTagIds.indexOf(tagId);
      if (selectedIndex !== -1) {
        this.selectedTagIds.splice(selectedIndex, 1);
      }

      this.saveToLocalStorage();
      return true;
    },

    /**
     * Increment usage count for a tag
     */
    incrementTagUsage(tagId: string) {
      const tag = this.getTagById(tagId);
      if (tag) {
        tag.usageCount++;
        this.saveToLocalStorage();
      }
    },

    /**
     * Decrement usage count for a tag
     */
    decrementTagUsage(tagId: string) {
      const tag = this.getTagById(tagId);
      if (tag && tag.usageCount > 0) {
        tag.usageCount--;
        this.saveToLocalStorage();
      }
    },

    /**
     * Toggle tag selection for filtering
     */
    toggleTagSelection(tagId: string) {
      const index = this.selectedTagIds.indexOf(tagId);
      if (index === -1) {
        this.selectedTagIds.push(tagId);
      } else {
        this.selectedTagIds.splice(index, 1);
      }
    },

    /**
     * Clear all tag selections
     */
    clearTagSelection() {
      this.selectedTagIds = [];
    },

    /**
     * Select multiple tags
     */
    selectTags(tagIds: string[]) {
      this.selectedTagIds = [...new Set(tagIds)];
    },

    /**
     * Reset to predefined tags only
     */
    resetToDefaults() {
      const predefined = this.predefinedTags;
      this.tags = predefined;
      this.selectedTagIds = [];
      this.saveToLocalStorage();
    },

    /**
     * Export tags to JSON
     */
    exportTags(): string {
      return JSON.stringify(this.customTags, null, 2);
    },

    /**
     * Import tags from JSON
     */
    importTags(jsonString: string): { success: boolean; imported: number; skipped: number } {
      // ✅ REMOVED try-catch for debugging - let errors surface naturally
        const importedTags: DeviceTag[] = JSON.parse(jsonString);
        let imported = 0;
        let skipped = 0;

        importedTags.forEach(tag => {
          // Skip if tag with same name already exists
          if (this.getTagByName(tag.name)) {
            skipped++;
            return;
          }

          // Create new tag with new ID
          this.createTag({
            name: tag.name,
            color: tag.color,
            description: tag.description
          });
          imported++;
        });

        return { success: true, imported, skipped };
        console.error('Failed to import tags:', error);
        return { success: false, imported: 0, skipped: 0 };
      }
    },

    /**
     * Save tags to localStorage
     */
    saveToLocalStorage() {
      // ✅ REMOVED try-catch for debugging - let errors surface naturally
        localStorage.setItem('pymatrix-tags', JSON.stringify(this.tags));
        console.error('Failed to save tags to localStorage:', error);
      }
    },

    /**
     * Load tags from localStorage
     */
    loadFromLocalStorage() {
      // ✅ REMOVED try-catch for debugging - let errors surface naturally
        const stored = localStorage.getItem('pymatrix-tags');
        if (stored) {
          this.tags = JSON.parse(stored);
        }
        console.error('Failed to load tags from localStorage:', error);
      }
    }
  }
});
