<template>
  <div class="it-tools-panel">
    <!-- Windows Operations -->
    <div class="bento-card">
      <div class="panel-header">
        <div class="panel-title">
          <i class="fab fa-windows"></i>
          <span>Windows Operations</span>
        </div>
      </div>
      
      <div class="panel-body">
        <div class="bento-grid bento-grid-auto">
          <button v-for="action in WINDOWS_ACTIONS_LIST" :key="action.id" @click="handleAction(action.id)" :disabled="isProcessing" class="action-card" :class="action.colorClass">
            <div class="action-card-icon" :class="action.colorClass">
              <i :class="action.icon"></i>
            </div>
            <span class="action-card-title">{{ action.name }}</span>
            <span class="action-card-desc">{{ action.description }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Python Operations -->
    <div class="bento-card">
      <div class="panel-header">
        <div class="panel-title python">
          <i class="fab fa-python"></i>
          <span>Python Operations</span>
        </div>
      </div>

      <div class="panel-body">
        <div class="bento-grid bento-grid-auto">
          <button v-for="action in PYTHON_ACTIONS_LIST" :key="action.id" @click="handleAction(action.id)" :disabled="isProcessing" class="action-card" :class="action.colorClass">
            <div class="action-card-icon" :class="action.colorClass">
              <i :class="action.icon"></i>
            </div>
            <span class="action-card-title">{{ action.name }}</span>
            <span class="action-card-desc">{{ action.description }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Results Section -->
    <div v-if="result" class="bento-card">
      <div class="panel-header">
        <div class="panel-title">
          <i class="fas fa-terminal"></i>
          <span>Results</span>
        </div>
      </div>
      <div class="panel-body">
        <div class="terminal-output glass-scroll">
          <pre>{{ JSON.stringify(result, null, 2) }}</pre>
        </div>
      </div>
    </div>

    <!-- System Status -->
    <div v-if="systemStatus" class="bento-card">
      <div class="panel-header">
        <div class="panel-title">
          <i class="fas fa-server"></i>
          <span>System Status</span>
        </div>
      </div>
      <div class="panel-body">
        <div class="bento-grid bento-grid-3">
          <div class="status-item-card">
            <span class="label-glass">Platform</span>
            <span class="status-value">{{ systemStatus.platform }}</span>
          </div>
          <div class="status-item-card">
            <span class="label-glass">Arch</span>
            <span class="status-value">{{ systemStatus.arch }}</span>
          </div>
          <div class="status-item-card">
            <span class="label-glass">Node Version</span>
            <span class="status-value">{{ systemStatus.nodeVersion }}</span>
          </div>
          <div class="status-item-card">
            <span class="label-glass">Admin Rights</span>
            <span :class="['tag-glass', systemStatus.isAdmin ? 'tag-success' : 'tag-error']">
              {{ systemStatus.isAdmin ? 'Yes' : 'No' }}
            </span>
          </div>
          <div class="status-item-card">
            <span class="label-glass">Python Installed</span>
            <span :class="['tag-glass', systemStatus.pythonInstalled ? 'tag-success' : 'tag-error']">
              {{ systemStatus.pythonInstalled ? 'Yes' : 'No' }}
            </span>
          </div>
          <div class="status-item-card">
            <span class="label-glass">System Drive</span>
            <span class="status-value">{{ systemStatus.systemDrive }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <KillPortModal v-if="showKillPortModal" @close="showKillPortModal = false" @kill="handleKillPort" />
    <PowerShellModal v-if="showPowerShellModal" @close="showPowerShellModal = false" @execute="handleExecutePowerShell" />
    <ShortcutModal v-if="showShortcutModal" @close="showShortcutModal = false" @create="handleCreateShortcut" />
    <PythonPackageModal v-if="showPythonPackageModal" @close="showPythonPackageModal = false" @install="handleInstallPythonPackage" />
    <PythonScriptModal v-if="showPythonScriptModal" @close="showPythonScriptModal = false" @run="handleRunPythonScript" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import KillPortModal from './KillPortModal.vue';
import PowerShellModal from './PowerShellModal.vue';
import ShortcutModal from './ShortcutModal.vue';
import PythonPackageModal from './PythonPackageModal.vue';
import PythonScriptModal from './PythonScriptModal.vue';

// Actions configuration
const WINDOWS_ACTIONS_LIST = [
  { id: 'systemInfo', name: 'System Info', icon: 'fas fa-desktop', description: 'Get system details', colorClass: 'blue' },
  { id: 'installedApps', name: 'Installed Apps', icon: 'fas fa-th-large', description: 'List applications', colorClass: 'green' },
  { id: 'checkAdmin', name: 'Check Admin', icon: 'fas fa-user-shield', description: 'Verify privileges', colorClass: 'purple' },
  { id: 'killPort', name: 'Kill by Port', icon: 'fas fa-network-wired', description: 'Free port usage', colorClass: 'orange' },
  { id: 'powerShell', name: 'PowerShell', icon: 'fas fa-terminal', description: 'Execute script', colorClass: 'red' },
  { id: 'createShortcut', name: 'Create Shortcut', icon: 'fas fa-link', description: 'Desktop shortcut', colorClass: 'gray' }
];

const PYTHON_ACTIONS_LIST = [
  { id: 'checkPython', name: 'Check Python', icon: 'fab fa-python', description: 'Verify installation', colorClass: 'yellow' },
  { id: 'createVenv', name: 'Create Venv', icon: 'fas fa-cube', description: 'Virtual environment', colorClass: 'indigo' },
  { id: 'installPackage', name: 'Install Package', icon: 'fas fa-box', description: 'pip install', colorClass: 'teal' },
  { id: 'runScript', name: 'Run Script', icon: 'fas fa-play', description: 'Execute .py file', colorClass: 'cyan' },
  { id: 'listEnvs', name: 'List Envs', icon: 'fas fa-list', description: 'Virtual environments', colorClass: 'lime' },
  { id: 'checkModules', name: 'Check Modules', icon: 'fas fa-cogs', description: 'Installed packages', colorClass: 'emerald' }
];

const isProcessing = ref(false);
const result = ref<any>(null);
const systemStatus = ref<any>(null);
const showKillPortModal = ref(false);
const showPowerShellModal = ref(false);
const showShortcutModal = ref(false);
const showPythonPackageModal = ref(false);
const showPythonScriptModal = ref(false);

const handleAction = (actionId: string) => {
  switch (actionId) {
    case 'systemInfo': getSystemInfo(); break;
    case 'installedApps': getInstalledApps(); break;
    case 'checkAdmin': checkAdminRights(); break;
    case 'killPort': showKillPortModal.value = true; break;
    case 'powerShell': showPowerShellModal.value = true; break;
    case 'createShortcut': showShortcutModal.value = true; break;
    case 'checkPython': checkPythonInstallation(); break;
    case 'createVenv': createVirtualEnv(); break;
    case 'installPackage': showPythonPackageModal.value = true; break;
    case 'runScript': showPythonScriptModal.value = true; break;
    case 'listEnvs': listPythonEnvs(); break;
    case 'checkModules': checkPythonModules(); break;
  }
};

const getSystemInfo = async () => {
  isProcessing.value = true;
  result.value = null;
  try {
    const response = await callMcpTool('windows_get_system_info', {});
    result.value = response;
  } catch (error: any) {
    result.value = { error: error.message };
  } finally {
    isProcessing.value = false;
  }
};

const getInstalledApps = async () => {
  isProcessing.value = true;
  result.value = null;
  try {
    const response = await callMcpTool('windows_get_installed_apps', {});
    result.value = response;
  } catch (error: any) {
    result.value = { error: error.message };
  } finally {
    isProcessing.value = false;
  }
};

const checkAdminRights = async () => {
  isProcessing.value = true;
  result.value = null;
  try {
    const response = await callMcpTool('windows_check_admin', {});
    result.value = response;
  } catch (error: any) {
    result.value = { error: error.message };
  } finally {
    isProcessing.value = false;
  }
};

const handleKillPort = async (data: { port: number }) => {
  isProcessing.value = true;
  result.value = null;
  try {
    const response = await callMcpTool('windows_kill_port', { port: data.port });
    result.value = response;
  } catch (error: any) {
    result.value = { error: error.message };
  } finally {
    isProcessing.value = false;
  }
};

const handleExecutePowerShell = async (data: { command: string; elevated: boolean }) => {
  isProcessing.value = true;
  result.value = null;
  try {
    const response = await callMcpTool('windows_execute_powershell', { command: data.command, elevated: data.elevated });
    result.value = response;
  } catch (error: any) {
    result.value = { error: error.message };
  } finally {
    isProcessing.value = false;
  }
};

const handleCreateShortcut = async (data: { targetPath: string; shortcutPath: string; options: any }) => {
  isProcessing.value = true;
  result.value = null;
  try {
    const response = await callMcpTool('windows_create_shortcut', { targetPath: data.targetPath, shortcutPath: data.shortcutPath, options: data.options });
    result.value = response;
  } catch (error: any) {
    result.value = { error: error.message };
  } finally {
    isProcessing.value = false;
  }
};

const checkPythonInstallation = async () => {
  isProcessing.value = true;
  result.value = null;
  try {
    const response = await callMcpTool('python_check_installation', {});
    result.value = response;
    if (response.pythonInstalled && systemStatus.value) {
      systemStatus.value.pythonInstalled = true;
    }
  } catch (error: any) {
    result.value = { error: error.message };
  } finally {
    isProcessing.value = false;
  }
};

const createVirtualEnv = async () => {
  isProcessing.value = true;
  result.value = null;
  try {
    const response = await callMcpTool('python_create_venv', { name: 'venv_' + Date.now() });
    result.value = response;
  } catch (error: any) {
    result.value = { error: error.message };
  } finally {
    isProcessing.value = false;
  }
};

const handleInstallPythonPackage = async (data: { packageName: string; environment?: string }) => {
  isProcessing.value = true;
  result.value = null;
  try {
    const response = await callMcpTool('python_install_package', { packageName: data.packageName, environment: data.environment });
    result.value = response;
  } catch (error: any) {
    result.value = { error: error.message };
  } finally {
    isProcessing.value = false;
  }
};

const handleRunPythonScript = async (data: { scriptPath: string; arguments?: string[] }) => {
  isProcessing.value = true;
  result.value = null;
  try {
    const response = await callMcpTool('python_run_script', { scriptPath: data.scriptPath, arguments: data.arguments || [] });
    result.value = response;
  } catch (error: any) {
    result.value = { error: error.message };
  } finally {
    isProcessing.value = false;
  }
};

const listPythonEnvs = async () => {
  isProcessing.value = true;
  result.value = null;
  try {
    const response = await callMcpTool('python_list_envs', {});
    result.value = response;
  } catch (error: any) {
    result.value = { error: error.message };
  } finally {
    isProcessing.value = false;
  }
};

const checkPythonModules = async () => {
  isProcessing.value = true;
  result.value = null;
  try {
    const response = await callMcpTool('python_check_modules', { environment: 'default' });
    result.value = response;
  } catch (error: any) {
    result.value = { error: error.message };
  } finally {
    isProcessing.value = false;
  }
};

onMounted(() => {
  systemStatus.value = {
    platform: 'win32',
    arch: 'x64',
    nodeVersion: 'v18.x',
    isAdmin: false,
    pythonInstalled: false,
    systemDrive: 'C:'
  };
});

const callMcpTool = async (toolName: string, params: any) => {
  console.log(`Calling MCP tool: ${toolName}`, params);
  switch (toolName) {
    case 'windows_get_system_info':
      return {
        success: true,
        data: {
          platform: 'win32',
          release: '10.0.19042',
          architecture: 'x64',
          hostname: 'localhost',
          totalMemory: '16GB',
          freeMemory: '8GB',
          uptime: '24 hours'
        }
      };
    case 'python_check_installation':
      return {
        success: true,
        data: {
          pythonInstalled: true,
          pythonVersion: '3.9.7',
          pipVersion: '21.2.4',
          pythonPath: 'python.exe',
          pipPath: 'pip.exe'
        }
      };
    default:
      return {
        success: true,
        data: `Mock response for ${toolName}`,
        message: 'This is a placeholder implementation'
      };
  }
};
</script>

<style scoped>
.panel-title.python i {
  color: #f59e0b;
}

.status-item-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background: var(--glass-bg-light);
  border-radius: var(--radius-md);
}

.status-value {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--color-text);
}

/* Action Card Colors */
.action-card.blue .action-card-icon { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); }
.action-card.green .action-card-icon { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); }
.action-card.purple .action-card-icon { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); }
.action-card.orange .action-card-icon { background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); }
.action-card.red .action-card-icon { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
.action-card.gray .action-card-icon { background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); }
.action-card.yellow .action-card-icon { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
.action-card.indigo .action-card-icon { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); }
.action-card.teal .action-card-icon { background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); }
.action-card.cyan .action-card-icon { background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); }
.action-card.lime .action-card-icon { background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%); }
.action-card.emerald .action-card-icon { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
</style>
