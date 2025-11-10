import { defineStore } from 'pinia';
import type {
  Script,
  ScriptStep,
  ScriptExecutionState,
  ScriptCategory,
  ScriptStepType
} from '@/types/pymatrix';

interface ScriptStoreState {
  scripts: Script[];
  categories: ScriptCategory[];
  currentScript: Script | null;
  executionStates: Record<string, ScriptExecutionState>;
  recordingState: {
    isRecording: boolean;
    deviceSerial: string | null;
    recordedSteps: ScriptStep[];
    startTime: number | null;
  };
  selectedScriptIds: string[];
}

const DEFAULT_CATEGORIES: ScriptCategory[] = [
  {
    id: 'testing',
    name: 'Testing',
    description: 'Automated testing scripts',
    icon: '🧪',
    color: '#3b82f6',
    scriptCount: 0
  },
  {
    id: 'automation',
    name: 'Automation',
    description: 'Task automation scripts',
    icon: '⚡',
    color: '#10b981',
    scriptCount: 0
  },
  {
    id: 'demo',
    name: 'Demo',
    description: 'Demo and presentation scripts',
    icon: '🎭',
    color: '#f59e0b',
    scriptCount: 0
  },
  {
    id: 'maintenance',
    name: 'Maintenance',
    description: 'Device maintenance scripts',
    icon: '🔧',
    color: '#8b5cf6',
    scriptCount: 0
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Custom user scripts',
    icon: '📝',
    color: '#6b7280',
    scriptCount: 0
  }
];

export const useScriptStore = defineStore('script', {
  state: (): ScriptStoreState => ({
    scripts: [],
    categories: [...DEFAULT_CATEGORIES],
    currentScript: null,
    executionStates: {},
    recordingState: {
      isRecording: false,
      deviceSerial: null,
      recordedSteps: [],
      startTime: null
    },
    selectedScriptIds: []
  }),

  getters: {
    /**
     * Get all scripts
     */
    allScripts(state): Script[] {
      return state.scripts;
    },

    /**
     * Get scripts by category
     */
    getScriptsByCategory: (state) => (categoryId: string): Script[] => {
      return state.scripts.filter(script => script.category === categoryId);
    },

    /**
     * Get script by ID
     */
    getScriptById: (state) => (scriptId: string): Script | undefined => {
      return state.scripts.find(script => script.id === scriptId);
    },

    /**
     * Get scripts by tag
     */
    getScriptsByTag: (state) => (tag: string): Script[] => {
      return state.scripts.filter(script => script.tags.includes(tag));
    },

    /**
     * Get all unique tags
     */
    allTags(state): string[] {
      const tagSet = new Set<string>();
      state.scripts.forEach(script => {
        script.tags.forEach(tag => tagSet.add(tag));
      });
      return Array.from(tagSet).sort();
    },

    /**
     * Get execution state for device
     */
    getExecutionState: (state) => (deviceSerial: string): ScriptExecutionState | undefined => {
      return state.executionStates[deviceSerial];
    },

    /**
     * Check if any device is executing script
     */
    isAnyDeviceExecuting(state): boolean {
      return Object.values(state.executionStates).some(
        state => state.status === 'running' || state.status === 'paused'
      );
    },

    /**
     * Get category by ID
     */
    getCategoryById: (state) => (categoryId: string): ScriptCategory | undefined => {
      return state.categories.find(cat => cat.id === categoryId);
    },

    /**
     * Get selected scripts
     */
    selectedScripts(state): Script[] {
      return state.scripts.filter(script => state.selectedScriptIds.includes(script.id));
    },

    /**
     * Total script count
     */
    totalScriptCount(state): number {
      return state.scripts.length;
    }
  },

  actions: {
    /**
     * Initialize store from localStorage
     */
    initialize() {
      this.loadFromLocalStorage();
      this.updateCategoryScriptCounts();
    },

    /**
     * Create new script
     */
    createScript(scriptData: Omit<Script, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Script {
      const newScript: Script = {
        ...scriptData,
        id: `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0'
      };

      this.scripts.push(newScript);
      this.updateCategoryScriptCounts();
      this.saveToLocalStorage();

      console.log('[ScriptStore] Script created:', newScript.id);
      return newScript;
    },

    /**
     * Update existing script
     */
    updateScript(scriptId: string, updates: Partial<Script>): boolean {
      const index = this.scripts.findIndex(s => s.id === scriptId);
      if (index === -1) {
        console.error('[ScriptStore] Script not found:', scriptId);
        return false;
      }

      this.scripts[index] = {
        ...this.scripts[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      if (this.currentScript && this.currentScript.id === scriptId) {
        this.currentScript = this.scripts[index];
      }

      this.updateCategoryScriptCounts();
      this.saveToLocalStorage();

      console.log('[ScriptStore] Script updated:', scriptId);
      return true;
    },

    /**
     * Delete script
     */
    deleteScript(scriptId: string): boolean {
      const index = this.scripts.findIndex(s => s.id === scriptId);
      if (index === -1) {
        console.error('[ScriptStore] Script not found:', scriptId);
        return false;
      }

      this.scripts.splice(index, 1);

      if (this.currentScript && this.currentScript.id === scriptId) {
        this.currentScript = null;
      }

      // Remove from selected
      const selectedIndex = this.selectedScriptIds.indexOf(scriptId);
      if (selectedIndex !== -1) {
        this.selectedScriptIds.splice(selectedIndex, 1);
      }

      this.updateCategoryScriptCounts();
      this.saveToLocalStorage();

      console.log('[ScriptStore] Script deleted:', scriptId);
      return true;
    },

    /**
     * Duplicate script
     */
    duplicateScript(scriptId: string): Script | null {
      const original = this.getScriptById(scriptId);
      if (!original) {
        console.error('[ScriptStore] Script not found:', scriptId);
        return null;
      }

      const duplicated = this.createScript({
        ...original,
        name: `${original.name} (Copy)`,
        tags: [...original.tags],
        steps: original.steps.map(step => ({ ...step, id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` })),
        targetDevices: original.targetDevices ? [...original.targetDevices] : undefined
      });

      console.log('[ScriptStore] Script duplicated:', scriptId, '→', duplicated.id);
      return duplicated;
    },

    /**
     * Set current script
     */
    setCurrentScript(scriptId: string | null) {
      if (scriptId === null) {
        this.currentScript = null;
        return;
      }

      const script = this.getScriptById(scriptId);
      if (script) {
        this.currentScript = script;
        console.log('[ScriptStore] Current script set:', scriptId);
      } else {
        console.error('[ScriptStore] Script not found:', scriptId);
      }
    },

    /**
     * Add step to current script
     */
    addStepToCurrentScript(step: Omit<ScriptStep, 'id'>): boolean {
      if (!this.currentScript) {
        console.error('[ScriptStore] No current script');
        return false;
      }

      const newStep: ScriptStep = {
        ...step,
        id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      this.currentScript.steps.push(newStep);
      this.updateScript(this.currentScript.id, { steps: this.currentScript.steps });

      console.log('[ScriptStore] Step added to script:', this.currentScript.id);
      return true;
    },

    /**
     * Update step in current script
     */
    updateStepInCurrentScript(stepId: string, updates: Partial<ScriptStep>): boolean {
      if (!this.currentScript) {
        console.error('[ScriptStore] No current script');
        return false;
      }

      const stepIndex = this.currentScript.steps.findIndex(s => s.id === stepId);
      if (stepIndex === -1) {
        console.error('[ScriptStore] Step not found:', stepId);
        return false;
      }

      this.currentScript.steps[stepIndex] = {
        ...this.currentScript.steps[stepIndex],
        ...updates
      };

      this.updateScript(this.currentScript.id, { steps: this.currentScript.steps });

      console.log('[ScriptStore] Step updated:', stepId);
      return true;
    },

    /**
     * Delete step from current script
     */
    deleteStepFromCurrentScript(stepId: string): boolean {
      if (!this.currentScript) {
        console.error('[ScriptStore] No current script');
        return false;
      }

      const stepIndex = this.currentScript.steps.findIndex(s => s.id === stepId);
      if (stepIndex === -1) {
        console.error('[ScriptStore] Step not found:', stepId);
        return false;
      }

      this.currentScript.steps.splice(stepIndex, 1);
      this.updateScript(this.currentScript.id, { steps: this.currentScript.steps });

      console.log('[ScriptStore] Step deleted:', stepId);
      return true;
    },

    /**
     * Reorder steps in current script
     */
    reorderStepsInCurrentScript(fromIndex: number, toIndex: number): boolean {
      if (!this.currentScript) {
        console.error('[ScriptStore] No current script');
        return false;
      }

      if (fromIndex < 0 || fromIndex >= this.currentScript.steps.length ||
          toIndex < 0 || toIndex >= this.currentScript.steps.length) {
        console.error('[ScriptStore] Invalid indices:', fromIndex, toIndex);
        return false;
      }

      const [movedStep] = this.currentScript.steps.splice(fromIndex, 1);
      this.currentScript.steps.splice(toIndex, 0, movedStep);

      this.updateScript(this.currentScript.id, { steps: this.currentScript.steps });

      console.log('[ScriptStore] Steps reordered:', fromIndex, '→', toIndex);
      return true;
    },

    /**
     * Start recording
     */
    startRecording(deviceSerial: string) {
      if (this.recordingState.isRecording) {
        console.warn('[ScriptStore] Already recording');
        return;
      }

      this.recordingState = {
        isRecording: true,
        deviceSerial,
        recordedSteps: [],
        startTime: Date.now()
      };

      console.log('[ScriptStore] Recording started for device:', deviceSerial);
    },

    /**
     * Stop recording and create script
     */
    stopRecording(scriptName?: string): Script | null {
      if (!this.recordingState.isRecording) {
        console.warn('[ScriptStore] Not recording');
        return null;
      }

      const script = this.createScript({
        name: scriptName || `Recorded Script ${new Date().toLocaleString()}`,
        description: `Recorded on device ${this.recordingState.deviceSerial}`,
        category: 'custom',
        tags: ['recorded'],
        steps: this.recordingState.recordedSteps,
        loopEnabled: false,
        scheduleEnabled: false
      });

      this.recordingState = {
        isRecording: false,
        deviceSerial: null,
        recordedSteps: [],
        startTime: null
      };

      console.log('[ScriptStore] Recording stopped, script created:', script.id);
      return script;
    },

    /**
     * Add recorded step
     */
    addRecordedStep(step: Omit<ScriptStep, 'id'>) {
      if (!this.recordingState.isRecording) {
        console.warn('[ScriptStore] Not recording');
        return;
      }

      const newStep: ScriptStep = {
        ...step,
        id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      this.recordingState.recordedSteps.push(newStep);

      console.log('[ScriptStore] Recorded step added:', newStep.type);
    },

    /**
     * Start script execution
     */
    startExecution(scriptId: string, deviceSerial: string): boolean {
      const script = this.getScriptById(scriptId);
      if (!script) {
        console.error('[ScriptStore] Script not found:', scriptId);
        return false;
      }

      this.executionStates[deviceSerial] = {
        scriptId,
        deviceSerial,
        status: 'running',
        currentStepIndex: 0,
        totalSteps: script.steps.length,
        startTime: Date.now(),
        loopIteration: script.loopEnabled ? 1 : undefined
      };

      console.log('[ScriptStore] Execution started:', scriptId, 'on', deviceSerial);
      return true;
    },

    /**
     * Update execution progress
     */
    updateExecutionProgress(deviceSerial: string, stepIndex: number) {
      const state = this.executionStates[deviceSerial];
      if (!state) {
        console.warn('[ScriptStore] No execution state for device:', deviceSerial);
        return;
      }

      state.currentStepIndex = stepIndex;

      console.log('[ScriptStore] Execution progress:', deviceSerial, stepIndex);
    },

    /**
     * Pause execution
     */
    pauseExecution(deviceSerial: string) {
      const state = this.executionStates[deviceSerial];
      if (!state || state.status !== 'running') {
        console.warn('[ScriptStore] Cannot pause:', deviceSerial);
        return;
      }

      state.status = 'paused';

      console.log('[ScriptStore] Execution paused:', deviceSerial);
    },

    /**
     * Resume execution
     */
    resumeExecution(deviceSerial: string) {
      const state = this.executionStates[deviceSerial];
      if (!state || state.status !== 'paused') {
        console.warn('[ScriptStore] Cannot resume:', deviceSerial);
        return;
      }

      state.status = 'running';

      console.log('[ScriptStore] Execution resumed:', deviceSerial);
    },

    /**
     * Complete execution
     */
    completeExecution(deviceSerial: string, success: boolean = true) {
      const state = this.executionStates[deviceSerial];
      if (!state) {
        console.warn('[ScriptStore] No execution state for device:', deviceSerial);
        return;
      }

      state.status = success ? 'completed' : 'failed';
      state.endTime = Date.now();

      console.log('[ScriptStore] Execution completed:', deviceSerial, success ? 'success' : 'failed');
    },

    /**
     * Clear execution state
     */
    clearExecutionState(deviceSerial: string) {
      delete this.executionStates[deviceSerial];

      console.log('[ScriptStore] Execution state cleared:', deviceSerial);
    },

    /**
     * Toggle script selection
     */
    toggleScriptSelection(scriptId: string) {
      const index = this.selectedScriptIds.indexOf(scriptId);
      if (index === -1) {
        this.selectedScriptIds.push(scriptId);
      } else {
        this.selectedScriptIds.splice(index, 1);
      }
    },

    /**
     * Clear script selection
     */
    clearScriptSelection() {
      this.selectedScriptIds = [];
    },

    /**
     * Select all scripts
     */
    selectAllScripts() {
      this.selectedScriptIds = this.scripts.map(s => s.id);
    },

    /**
     * Export script to JSON
     */
    exportScript(scriptId: string): string | null {
      const script = this.getScriptById(scriptId);
      if (!script) {
        console.error('[ScriptStore] Script not found:', scriptId);
        return null;
      }

      // ✅ REMOVED try-catch for debugging - let errors surface naturally
        const json = JSON.stringify(script, null, 2);
        console.log('[ScriptStore] Script exported:', scriptId);
        return json;
        console.error('[ScriptStore] Export failed:', error);
        return null;
      }
    },

    /**
     * Import script from JSON
     */
    importScript(json: string): Script | null {
      // ✅ REMOVED try-catch for debugging - let errors surface naturally
        const scriptData = JSON.parse(json) as Script;

        // Generate new ID and timestamps
        const imported = this.createScript({
          ...scriptData,
          name: `${scriptData.name} (Imported)`
        });

        console.log('[ScriptStore] Script imported:', imported.id);
        return imported;
        console.error('[ScriptStore] Import failed:', error);
        return null;
      }
    },

    /**
     * Export selected scripts
     */
    exportSelectedScripts(): string | null {
      if (this.selectedScriptIds.length === 0) {
        console.warn('[ScriptStore] No scripts selected');
        return null;
      }

      const scripts = this.selectedScripts;

      // ✅ REMOVED try-catch for debugging - let errors surface naturally
        const json = JSON.stringify(scripts, null, 2);
        console.log('[ScriptStore] Selected scripts exported:', this.selectedScriptIds.length);
        return json;
        console.error('[ScriptStore] Export failed:', error);
        return null;
      }
    },

    /**
     * Import multiple scripts
     */
    importMultipleScripts(json: string): Script[] | null {
      // ✅ REMOVED try-catch for debugging - let errors surface naturally
        const scriptsData = JSON.parse(json) as Script[];

        if (!Array.isArray(scriptsData)) {
          console.error('[ScriptStore] Invalid import data');
          return null;
        }

        const imported: Script[] = [];
        scriptsData.forEach(scriptData => {
          const script = this.createScript({
            ...scriptData,
            name: `${scriptData.name} (Imported)`
          });
          imported.push(script);
        });

        console.log('[ScriptStore] Scripts imported:', imported.length);
        return imported;
        console.error('[ScriptStore] Import failed:', error);
        return null;
      }
    },

    /**
     * Create custom category
     */
    createCategory(category: Omit<ScriptCategory, 'scriptCount'>): ScriptCategory {
      const newCategory: ScriptCategory = {
        ...category,
        scriptCount: 0
      };

      this.categories.push(newCategory);
      this.saveToLocalStorage();

      console.log('[ScriptStore] Category created:', newCategory.id);
      return newCategory;
    },

    /**
     * Delete custom category
     */
    deleteCategory(categoryId: string): boolean {
      const index = this.categories.findIndex(c => c.id === categoryId);
      if (index === -1) {
        console.error('[ScriptStore] Category not found:', categoryId);
        return false;
      }

      // Move scripts to 'custom' category
      this.scripts.forEach(script => {
        if (script.category === categoryId) {
          script.category = 'custom';
        }
      });

      this.categories.splice(index, 1);
      this.updateCategoryScriptCounts();
      this.saveToLocalStorage();

      console.log('[ScriptStore] Category deleted:', categoryId);
      return true;
    },

    /**
     * Update category script counts
     */
    updateCategoryScriptCounts() {
      this.categories.forEach(category => {
        category.scriptCount = this.scripts.filter(s => s.category === category.id).length;
      });
    },

    /**
     * Save to localStorage
     */
    saveToLocalStorage() {
      // ✅ REMOVED try-catch for debugging - let errors surface naturally
        localStorage.setItem('pymatrix_scripts', JSON.stringify(this.scripts));
        localStorage.setItem('pymatrix_script_categories', JSON.stringify(this.categories));
        console.log('[ScriptStore] Saved to localStorage');
        console.error('[ScriptStore] Save to localStorage failed:', error);
      }
    },

    /**
     * Load from localStorage
     */
    loadFromLocalStorage() {
      // ✅ REMOVED try-catch for debugging - let errors surface naturally
        const scriptsJson = localStorage.getItem('pymatrix_scripts');
        if (scriptsJson) {
          this.scripts = JSON.parse(scriptsJson);
          console.log('[ScriptStore] Loaded scripts from localStorage:', this.scripts.length);
        }

        const categoriesJson = localStorage.getItem('pymatrix_script_categories');
        if (categoriesJson) {
          this.categories = JSON.parse(categoriesJson);
          console.log('[ScriptStore] Loaded categories from localStorage:', this.categories.length);
        } else {
          this.categories = [...DEFAULT_CATEGORIES];
        }
        console.error('[ScriptStore] Load from localStorage failed:', error);
        this.categories = [...DEFAULT_CATEGORIES];
      }
    },

    /**
     * Reset store
     */
    reset() {
      this.scripts = [];
      this.categories = [...DEFAULT_CATEGORIES];
      this.currentScript = null;
      this.executionStates = {};
      this.recordingState = {
        isRecording: false,
        deviceSerial: null,
        recordedSteps: [],
        startTime: null
      };
      this.selectedScriptIds = [];

      this.saveToLocalStorage();

      console.log('[ScriptStore] Store reset');
    }
  }
});
