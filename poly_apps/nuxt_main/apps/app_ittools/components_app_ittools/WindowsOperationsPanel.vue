<template>
  <div class="windows-panel">
    <!-- Windows Operations -->
    <div class="bento-card actions-card">
      <div class="card-header">
        <i class="fab fa-windows header-icon"></i>
        <h2>Windows Operations</h2>
      </div>
      
      <div class="actions-grid">
        <button @click="getSystemInfo" :disabled="isProcessing" class="action-btn blue">
          <i class="fas fa-desktop"></i>
          <span class="action-title">System Info</span>
          <span class="action-desc">Get system details</span>
        </button>

        <button @click="getInstalledApps" :disabled="isProcessing" class="action-btn green">
          <i class="fas fa-th-large"></i>
          <span class="action-title">Installed Apps</span>
          <span class="action-desc">List applications</span>
        </button>

        <button @click="checkAdminRights" :disabled="isProcessing" class="action-btn purple">
          <i class="fas fa-user-shield"></i>
          <span class="action-title">Check Admin</span>
          <span class="action-desc">Verify privileges</span>
        </button>

        <button @click="killProcessByPort" :disabled="isProcessing" class="action-btn orange">
          <i class="fas fa-network-wired"></i>
          <span class="action-title">Kill by Port</span>
          <span class="action-desc">Free port usage</span>
        </button>

        <button @click="executePowerShell" :disabled="isProcessing" class="action-btn red">
          <i class="fas fa-terminal"></i>
          <span class="action-title">PowerShell</span>
          <span class="action-desc">Execute script</span>
        </button>

        <button @click="createShortcut" :disabled="isProcessing" class="action-btn gray">
          <i class="fas fa-link"></i>
          <span class="action-title">Create Shortcut</span>
          <span class="action-desc">Desktop shortcut</span>
        </button>
      </div>
    </div>

    <!-- Python Operations -->
    <div class="bento-card actions-card">
      <div class="card-header">
        <i class="fab fa-python header-icon python"></i>
        <h3>Python Operations</h3>
      </div>

      <div class="actions-grid">
        <button @click="checkPythonInstallation" :disabled="isProcessing" class="action-btn yellow">
          <i class="fab fa-python"></i>
          <span class="action-title">Check Python</span>
          <span class="action-desc">Verify installation</span>
        </button>

        <button @click="createVirtualEnv" :disabled="isProcessing" class="action-btn indigo">
          <i class="fas fa-cube"></i>
          <span class="action-title">Create Venv</span>
          <span class="action-desc">Virtual environment</span>
        </button>

        <button @click="installPythonPackage" :disabled="isProcessing" class="action-btn teal">
          <i class="fas fa-box"></i>
          <span class="action-title">Install Package</span>
          <span class="action-desc">pip install</span>
        </button>

        <button @click="runPythonScript" :disabled="isProcessing" class="action-btn cyan">
          <i class="fas fa-play"></i>
          <span class="action-title">Run Script</span>
          <span class="action-desc">Execute .py file</span>
        </button>

        <button @click="listPythonEnvs" :disabled="isProcessing" class="action-btn lime">
          <i class="fas fa-list"></i>
          <span class="action-title">List Envs</span>
          <span class="action-desc">Virtual environments</span>
        </button>

        <button @click="checkPythonModules" :disabled="isProcessing" class="action-btn emerald">
          <i class="fas fa-cogs"></i>
          <span class="action-title">Check Modules</span>
          <span class="action-desc">Installed packages</span>
        </button>
      </div>
    </div>

    <!-- Results Section -->
    <div v-if="result" class="bento-card results-card">
      <div class="card-header">
        <i class="fas fa-terminal header-icon"></i>
        <h3>Results</h3>
      </div>
      <div class="results-content">
        <pre>{{ JSON.stringify(result, null, 2) }}</pre>
      </div>
    </div>

    <!-- System Status -->
    <div v-if="systemStatus" class="bento-card status-card">
      <div class="card-header">
        <i class="fas fa-server header-icon"></i>
        <h3>System Status</h3>
      </div>
      <div class="status-grid">
        <div class="status-item">
          <span class="item-label">Platform</span>
          <span class="item-value">{{ systemStatus.platform }}</span>
        </div>
        <div class="status-item">
          <span class="item-label">Arch</span>
          <span class="item-value">{{ systemStatus.arch }}</span>
        </div>
        <div class="status-item">
          <span class="item-label">Node Version</span>
          <span class="item-value">{{ systemStatus.nodeVersion }}</span>
        </div>
        <div class="status-item">
          <span class="item-label">Admin Rights</span>
          <span class="item-value" :class="systemStatus.isAdmin ? 'success' : 'error'">
            {{ systemStatus.isAdmin ? 'Yes' : 'No' }}
          </span>
        </div>
        <div class="status-item">
          <span class="item-label">Python Installed</span>
          <span class="item-value" :class="systemStatus.pythonInstalled ? 'success' : 'error'">
            {{ systemStatus.pythonInstalled ? 'Yes' : 'No' }}
          </span>
        </div>
        <div class="status-item">
          <span class="item-label">System Drive</span>
          <span class="item-value">{{ systemStatus.systemDrive }}</span>
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

const isProcessing = ref(false);
const result = ref<any>(null);
const systemStatus = ref<any>(null);
const showKillPortModal = ref(false);
const showPowerShellModal = ref(false);
const showShortcutModal = ref(false);
const showPythonPackageModal = ref(false);
const showPythonScriptModal = ref(false);

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

const killProcessByPort = () => { showKillPortModal.value = true; };

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

const executePowerShell = () => { showPowerShellModal.value = true; };

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

const createShortcut = () => { showShortcutModal.value = true; };

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

const installPythonPackage = () => { showPythonPackageModal.value = true; };

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

const runPythonScript = () => { showPythonScriptModal.value = true; };

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
.windows-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-bento, 12px);
}

.bento-card {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(99, 102, 241, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.actions-card, .results-card, .status-card {
  padding: 1.5rem;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.header-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  border-radius: 12px;
  color: white;
  font-size: 1rem;
}

.header-icon.python {
  background: linear-gradient(135deg, #f59e0b 0%, #eab308 100%);
}

.card-header h2, .card-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.25rem;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(229, 231, 235, 0.6);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn i:first-child {
  font-size: 1.75rem;
  margin-bottom: 0.25rem;
}

.action-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}

.action-desc {
  font-size: 0.75rem;
  color: #6b7280;
}

.action-btn.blue { background: rgba(59, 130, 246, 0.08); border-color: rgba(59, 130, 246, 0.2); }
.action-btn.blue i:first-child { color: #3b82f6; }

.action-btn.green { background: rgba(34, 197, 94, 0.08); border-color: rgba(34, 197, 94, 0.2); }
.action-btn.green i:first-child { color: #22c55e; }

.action-btn.purple { background: rgba(139, 92, 246, 0.08); border-color: rgba(139, 92, 246, 0.2); }
.action-btn.purple i:first-child { color: #8b5cf6; }

.action-btn.orange { background: rgba(249, 115, 22, 0.08); border-color: rgba(249, 115, 22, 0.2); }
.action-btn.orange i:first-child { color: #f97316; }

.action-btn.red { background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.2); }
.action-btn.red i:first-child { color: #ef4444; }

.action-btn.gray { background: rgba(107, 114, 128, 0.08); border-color: rgba(107, 114, 128, 0.2); }
.action-btn.gray i:first-child { color: #6b7280; }

.action-btn.yellow { background: rgba(245, 158, 11, 0.08); border-color: rgba(245, 158, 11, 0.2); }
.action-btn.yellow i:first-child { color: #f59e0b; }

.action-btn.indigo { background: rgba(99, 102, 241, 0.08); border-color: rgba(99, 102, 241, 0.2); }
.action-btn.indigo i:first-child { color: #6366f1; }

.action-btn.teal { background: rgba(20, 184, 166, 0.08); border-color: rgba(20, 184, 166, 0.2); }
.action-btn.teal i:first-child { color: #14b8a6; }

.action-btn.cyan { background: rgba(6, 182, 212, 0.08); border-color: rgba(6, 182, 212, 0.2); }
.action-btn.cyan i:first-child { color: #06b6d4; }

.action-btn.lime { background: rgba(132, 204, 22, 0.08); border-color: rgba(132, 204, 22, 0.2); }
.action-btn.lime i:first-child { color: #84cc16; }

.action-btn.emerald { background: rgba(16, 185, 129, 0.08); border-color: rgba(16, 185, 129, 0.2); }
.action-btn.emerald i:first-child { color: #10b981; }

.results-content {
  background: rgba(249, 250, 251, 0.8);
  border: 1px solid rgba(229, 231, 235, 0.6);
  border-radius: 12px;
  padding: 1rem;
  max-height: 300px;
  overflow-y: auto;
}

.results-content pre {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.8125rem;
  color: #374151;
  margin: 0;
  white-space: pre-wrap;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.status-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.item-label {
  font-size: 0.75rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.item-value {
  font-size: 0.9375rem;
  font-weight: 500;
  color: #1f2937;
}

.item-value.success { color: #22c55e; }
.item-value.error { color: #ef4444; }
</style>
