import { defineStore } from 'pinia';

export interface GridLayoutPreferences {
  columns: number; // 1-5 columns
  deviceOrder: string[]; // Array of device serials in display order
}

export type ThemeMode = 'dark' | 'light';

export interface UIPreferences {
  gridLayout: GridLayoutPreferences;
  toastPosition: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  theme: ThemeMode;
}

interface UIPreferencesState {
  preferences: UIPreferences;
}

const DEFAULT_PREFERENCES: UIPreferences = {
  gridLayout: {
    columns: 0, // 0 means auto-detect based on device count
    deviceOrder: []
  },
  toastPosition: 'top-right',
  theme: 'dark'
};

export const useUIPreferencesStore = defineStore('uiPreferences', {
  state: (): UIPreferencesState => ({
    preferences: loadPreferences()
  }),

  getters: {
    gridColumns: (state) => state.preferences.gridLayout.columns,
    deviceOrder: (state) => state.preferences.gridLayout.deviceOrder,
    toastPosition: (state) => state.preferences.toastPosition,
    theme: (state) => state.preferences.theme,

    isAutoColumns: (state) => state.preferences.gridLayout.columns === 0,

    // Get effective columns for a given device count
    getEffectiveColumns: (state) => (deviceCount: number): number => {
      if (state.preferences.gridLayout.columns > 0) {
        return state.preferences.gridLayout.columns;
      }
      // Auto-detect based on device count
      if (deviceCount <= 1) return 1;
      if (deviceCount <= 4) return 2;
      if (deviceCount <= 9) return 3;
      if (deviceCount <= 16) return 4;
      return 5;
    }
  },

  actions: {
    setGridColumns(columns: number) {
      if (columns < 0 || columns > 5) {
        console.error('[UIPreferencesStore] Invalid column count:', columns);
        return;
      }
      this.preferences.gridLayout.columns = columns;
      this.savePreferences();
      console.log('[UIPreferencesStore] Grid columns set to:', columns === 0 ? 'auto' : columns);
    },

    setDeviceOrder(deviceSerials: string[]) {
      this.preferences.gridLayout.deviceOrder = [...deviceSerials];
      this.savePreferences();
      console.log('[UIPreferencesStore] Device order updated:', deviceSerials.length, 'devices');
    },

    updateDeviceOrder(fromIndex: number, toIndex: number) {
      const order = [...this.preferences.gridLayout.deviceOrder];
      const [movedItem] = order.splice(fromIndex, 1);
      order.splice(toIndex, 0, movedItem);
      this.preferences.gridLayout.deviceOrder = order;
      this.savePreferences();
      console.log('[UIPreferencesStore] Device moved from', fromIndex, 'to', toIndex);
    },

    removeDeviceFromOrder(serial: string) {
      const index = this.preferences.gridLayout.deviceOrder.indexOf(serial);
      if (index !== -1) {
        this.preferences.gridLayout.deviceOrder.splice(index, 1);
        this.savePreferences();
        console.log('[UIPreferencesStore] Device removed from order:', serial);
      }
    },

    addDeviceToOrder(serial: string) {
      if (!this.preferences.gridLayout.deviceOrder.includes(serial)) {
        this.preferences.gridLayout.deviceOrder.push(serial);
        this.savePreferences();
        console.log('[UIPreferencesStore] Device added to order:', serial);
      }
    },

    setToastPosition(position: UIPreferences['toastPosition']) {
      this.preferences.toastPosition = position;
      this.savePreferences();
      console.log('[UIPreferencesStore] Toast position set to:', position);
    },

    setTheme(mode: ThemeMode) {
      if (!['dark', 'light'].includes(mode)) {
        console.warn('[UIPreferencesStore] Invalid theme mode:', mode);
        return;
      }
      this.preferences.theme = mode;
      this.savePreferences();
      console.log('[UIPreferencesStore] Theme mode set to:', mode);
    },

    resetGridLayout() {
      this.preferences.gridLayout = { ...DEFAULT_PREFERENCES.gridLayout };
      this.savePreferences();
      console.log('[UIPreferencesStore] Grid layout reset to defaults');
    },

    resetAll() {
      this.preferences = { ...DEFAULT_PREFERENCES };
      this.savePreferences();
      console.log('[UIPreferencesStore] All preferences reset to defaults');
    },

    savePreferences() {
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('pymatrix_ui_preferences', JSON.stringify(this.preferences));
        } catch (error) {
          console.error('[UIPreferencesStore] Failed to save preferences:', error);
        }
      }
    }
  }
});

function loadPreferences(): UIPreferences {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_PREFERENCES };
  }

  try {
    const saved = localStorage.getItem('pymatrix_ui_preferences');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge with defaults to ensure all properties exist
      return {
        gridLayout: {
          ...DEFAULT_PREFERENCES.gridLayout,
          ...parsed.gridLayout
        },
        toastPosition: parsed.toastPosition || DEFAULT_PREFERENCES.toastPosition,
        theme: parsed.theme === 'light' ? 'light' : DEFAULT_PREFERENCES.theme
      };
    }
  } catch (error) {
    console.error('[UIPreferencesStore] Failed to load preferences:', error);
  }

  return { ...DEFAULT_PREFERENCES };
}
