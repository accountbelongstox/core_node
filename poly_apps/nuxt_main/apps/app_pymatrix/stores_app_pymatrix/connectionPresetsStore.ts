/**
 * Connection Presets Store
 * Manages saved connection configurations with localStorage persistence
 */

import { defineStore } from 'pinia';
import type { DeviceConfig } from '@/types/pymatrix';

export interface ConnectionPreset {
  id: string;
  name: string;
  description?: string;
  config: DeviceConfig;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionPresetsState {
  presets: ConnectionPreset[];
  activePresetId: string | null;
}

const STORAGE_KEY = 'pymatrix_connection_presets';
const DEFAULT_PRESETS: ConnectionPreset[] = [
  {
    id: 'preset-high-quality',
    name: 'High Quality',
    description: 'High resolution and bit rate for best visual quality',
    config: {
      max_size: 1920,
      bit_rate: 8000000,
      max_fps: 60,
      codec: 'h265',
      control: true,
      locked_video_orientation: -1
    },
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'preset-balanced',
    name: 'Balanced',
    description: 'Balanced settings for general use',
    config: {
      max_size: 1280,
      bit_rate: 4000000,
      max_fps: 30,
      codec: 'h264',
      control: true,
      locked_video_orientation: -1
    },
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'preset-low-latency',
    name: 'Low Latency',
    description: 'Lower resolution and bit rate for minimal latency',
    config: {
      max_size: 720,
      bit_rate: 2000000,
      max_fps: 30,
      codec: 'h264',
      control: true,
      locked_video_orientation: -1
    },
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'preset-battery-saver',
    name: 'Battery Saver',
    description: 'Minimal settings to save device battery',
    config: {
      max_size: 480,
      bit_rate: 1000000,
      max_fps: 15,
      codec: 'h264',
      control: true,
      locked_video_orientation: -1
    },
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const useConnectionPresetsStore = defineStore('connectionPresets', {
  state: (): ConnectionPresetsState => ({
    presets: [],
    activePresetId: null
  }),

  getters: {
    /**
     * Get all presets sorted by name
     */
    allPresets: (state): ConnectionPreset[] => {
      return [...state.presets].sort((a, b) => {
        // Default presets first
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return a.name.localeCompare(b.name);
      });
    },

    /**
     * Get default presets only
     */
    defaultPresets: (state): ConnectionPreset[] => {
      return state.presets.filter(p => p.isDefault);
    },

    /**
     * Get custom presets only
     */
    customPresets: (state): ConnectionPreset[] => {
      return state.presets.filter(p => !p.isDefault);
    },

    /**
     * Get active preset
     */
    activePreset: (state): ConnectionPreset | null => {
      if (!state.activePresetId) return null;
      return state.presets.find(p => p.id === state.activePresetId) || null;
    },

    /**
     * Find preset by ID
     */
    findPreset: (state) => (presetId: string): ConnectionPreset | undefined => {
      return state.presets.find(p => p.id === presetId);
    },

    /**
     * Check if preset name exists
     */
    presetNameExists: (state) => (name: string, excludeId?: string): boolean => {
      return state.presets.some(p =>
        p.name.toLowerCase() === name.toLowerCase() &&
        (!excludeId || p.id !== excludeId)
      );
    }
  },

  actions: {
    /**
     * Load presets from localStorage
     */
    loadPresets() {
      if (typeof window === 'undefined') {
        this.presets = DEFAULT_PRESETS;
        this.activePresetId = 'preset-balanced';
        return;
      }

      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.presets = data.presets || [];
        this.activePresetId = data.activePresetId || null;
        console.log('[ConnectionPresetsStore] Presets loaded:', this.presets.length);
      } else {
        this.presets = DEFAULT_PRESETS;
        this.activePresetId = 'preset-balanced';
        this.savePresets();
        console.log('[ConnectionPresetsStore] Initialized with default presets');
      }
    },

    /**
     * Save presets to localStorage
     */
    savePresets() {
      if (typeof window === 'undefined') {
        return;
      }

      const data = {
        presets: this.presets,
        activePresetId: this.activePresetId
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      console.log('[ConnectionPresetsStore] Presets saved');
    },

    /**
     * Create a new preset
     */
    createPreset(preset: Omit<ConnectionPreset, 'id' | 'createdAt' | 'updatedAt'>): string {
      const id = `preset-${Date.now()}`;
      const now = new Date().toISOString();

      const newPreset: ConnectionPreset = {
        ...preset,
        id,
        createdAt: now,
        updatedAt: now
      };

      this.presets.push(newPreset);
      this.savePresets();
      console.log('[ConnectionPresetsStore] Preset created:', newPreset.name);
      return id;
    },

    /**
     * Update an existing preset
     */
    updatePreset(presetId: string, updates: Partial<Omit<ConnectionPreset, 'id' | 'createdAt' | 'isDefault'>>) {
      const preset = this.presets.find(p => p.id === presetId);
      if (!preset) {
        console.error('[ConnectionPresetsStore] Preset not found:', presetId);
        return;
      }

      // Don't allow updating default presets
      if (preset.isDefault) {
        console.error('[ConnectionPresetsStore] Cannot update default preset:', presetId);
        return;
      }

      Object.assign(preset, updates, { updatedAt: new Date().toISOString() });
      this.savePresets();
      console.log('[ConnectionPresetsStore] Preset updated:', preset.name);
    },

    /**
     * Delete a preset
     */
    deletePreset(presetId: string) {
      const preset = this.presets.find(p => p.id === presetId);
      if (!preset) {
        console.error('[ConnectionPresetsStore] Preset not found:', presetId);
        return;
      }

      // Don't allow deleting default presets
      if (preset.isDefault) {
        console.error('[ConnectionPresetsStore] Cannot delete default preset:', presetId);
        return;
      }

      const index = this.presets.findIndex(p => p.id === presetId);
      if (index >= 0) {
        this.presets.splice(index, 1);

        // Clear active preset if it was deleted
        if (this.activePresetId === presetId) {
          this.activePresetId = null;
        }

        this.savePresets();
        console.log('[ConnectionPresetsStore] Preset deleted:', preset.name);
      }
    },

    /**
     * Set active preset
     */
    setActivePreset(presetId: string | null) {
      if (presetId && !this.presets.find(p => p.id === presetId)) {
        console.error('[ConnectionPresetsStore] Preset not found:', presetId);
        return;
      }

      this.activePresetId = presetId;
      this.savePresets();
      console.log('[ConnectionPresetsStore] Active preset set:', presetId);
    },

    /**
     * Duplicate a preset
     */
    duplicatePreset(presetId: string): string | null {
      const preset = this.presets.find(p => p.id === presetId);
      if (!preset) {
        console.error('[ConnectionPresetsStore] Preset not found:', presetId);
        return null;
      }

      const newName = `${preset.name} (Copy)`;
      const newId = this.createPreset({
        name: newName,
        description: preset.description,
        config: { ...preset.config },
        isDefault: false
      });

      return newId;
    },

    /**
     * Export presets to JSON
     */
    exportPresets(): string {
      const customPresets = this.customPresets;
      return JSON.stringify(customPresets, null, 2);
    },

    /**
     * Import presets from JSON
     */
    importPresets(json: string): { success: number; failed: number } {
      const imported = JSON.parse(json) as ConnectionPreset[];

      if (!Array.isArray(imported)) {
        console.error('[ConnectionPresetsStore] Invalid preset format');
        return { success: 0, failed: 1 };
      }

      let success = 0;
      let failed = 0;

      imported.forEach(preset => {
        // Validate preset structure
        if (!preset.name || !preset.config) {
          failed++;
          return;
        }

        // Check for name conflict
        let name = preset.name;
        let counter = 1;
        while (this.presetNameExists(name)) {
          name = `${preset.name} (${counter})`;
          counter++;
        }

        // Create preset
        this.createPreset({
          name,
          description: preset.description,
          config: preset.config,
          isDefault: false
        });

        success++;
      });

      console.log('[ConnectionPresetsStore] Import completed:', { success, failed });
      return { success, failed };
    },

    /**
     * Reset to default presets
     */
    resetToDefaults() {
      // Remove all custom presets
      this.presets = this.presets.filter(p => p.isDefault);

      // Ensure all default presets exist
      DEFAULT_PRESETS.forEach(defaultPreset => {
        if (!this.presets.find(p => p.id === defaultPreset.id)) {
          this.presets.push({ ...defaultPreset });
        }
      });

      this.activePresetId = 'preset-balanced';
      this.savePresets();
      console.log('[ConnectionPresetsStore] Reset to default presets');
    }
  }
});
