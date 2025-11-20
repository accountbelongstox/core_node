<template>
  <div class="space-y-6">
    <!-- Quick Actions -->
    <div class="bg-white rounded-lg shadow p-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">
        <i class="fas fa-windows text-blue-600 mr-2"></i>
        Windows Operations
      </h2>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <button
          @click="getSystemInfo"
          :disabled="isProcessing"
          class="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg text-blue-700 transition flex flex-col items-center space-y-2"
        >
          <i class="fas fa-desktop text-2xl"></i>
          <span class="font-medium">System Info</span>
          <span class="text-sm text-blue-600">Get system details</span>
        </button>

        <button
          @click="getInstalledApps"
          :disabled="isProcessing"
          class="p-4 bg-green-50 hover:bg-green-100 rounded-lg text-green-700 transition flex flex-col items-center space-y-2"
        >
          <i class="fas fa-apps text-2xl"></i>
          <span class="font-medium">Installed Apps</span>
          <span class="text-sm text-green-600">List applications</span>
        </button>

        <button
          @click="checkAdminRights"
          :disabled="isProcessing"
          class="p-4 bg-purple-50 hover:bg-purple-100 rounded-lg text-purple-700 transition flex flex-col items-center space-y-2"
        >
          <i class="fas fa-user-shield text-2xl"></i>
          <span class="font-medium">Check Admin</span>
          <span class="text-sm text-purple-600">Verify privileges</span>
        </button>

        <button
          @click="killProcessByPort"
          :disabled="isProcessing"
          class="p-4 bg-orange-50 hover:bg-orange-100 rounded-lg text-orange-700 transition flex flex-col items-center space-y-2"
        >
          <i class="fas fa-network-wired text-2xl"></i>
          <span class="font-medium">Kill by Port</span>
          <span class="text-sm text-orange-600">Free port usage</span>
        </button>

        <button
          @click="executePowerShell"
          :disabled="isProcessing"
          class="p-4 bg-red-50 hover:bg-red-100 rounded-lg text-red-700 transition flex flex-col items-center space-y-2"
        >
          <i class="fas fa-terminal text-2xl"></i>
          <span class="font-medium">PowerShell</span>
          <span class="text-sm text-red-600">Execute script</span>
        </button>

        <button
          @click="createShortcut"
          :disabled="isProcessing"
          class="p-4 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-700 transition flex flex-col items-center space-y-2"
        >
          <i class="fas fa-link text-2xl"></i>
          <span class="font-medium">Create Shortcut</span>
          <span class="text-sm text-gray-600">Desktop shortcut</span>
        </button>
      </div>
    </div>

    <!-- Python Operations -->
    <div class="bg-white rounded-lg shadow p-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">
        <i class="fab fa-python text-yellow-600 mr-2"></i>
        Python Operations (ptyhon)
      </h3>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <button
          @click="checkPythonInstallation"
          :disabled="isProcessing"
          class="p-4 bg-yellow-50 hover:bg-yellow-100 rounded-lg text-yellow-700 transition flex flex-col items-center space-y-2"
        >
          <i class="fab fa-python text-2xl"></i>
          <span class="font-medium">Check Python</span>
          <span class="text-sm text-yellow-600">Verify installation</span>
        </button>

        <button
          @click="createVirtualEnv"
          :disabled="isProcessing"
          class="p-4 bg-indigo-50 hover:bg-indigo-100 rounded-lg text-indigo-700 transition flex flex-col items-center space-y-2"
        >
          <i class="fas fa-cube text-2xl"></i>
          <span class="font-medium">Create Venv</span>
          <span class="text-sm text-indigo-600">Virtual environment</span>
        </button>

        <button
          @click="installPythonPackage"
          :disabled="isProcessing"
          class="p-4 bg-teal-50 hover:bg-teal-100 rounded-lg text-teal-700 transition flex flex-col items-center space-y-2"
        >
          <i class="fas fa-pipette text-2xl"></i>
          <span class="font-medium">Install Package</span>
          <span class="text-sm text-teal-600">pip install</span>
        </button>

        <button
          @click="runPythonScript"
          :disabled="isProcessing"
          class="p-4 bg-cyan-50 hover:bg-cyan-100 rounded-lg text-cyan-700 transition flex flex-col items-center space-y-2"
        >
          <i class="fas fa-play text-2xl"></i>
          <span class="font-medium">Run Script</span>
          <span class="text-sm text-cyan-600">Execute .py file</span>
        </button>

        <button
          @click="listPythonEnvs"
          :disabled="isProcessing"
          class="p-4 bg-lime-50 hover:bg-lime-100 rounded-lg text-lime-700 transition flex flex-col items-center space-y-2"
        >
          <i class="fas fa-list text-2xl"></i>
          <span class="font-medium">List Envs</span>
          <span class="text-sm text-lime-600">Virtual environments</span>
        </button>

        <button
          @click="checkPythonModules"
          :disabled="isProcessing"
          class="p-4 bg-emerald-50 hover:bg-emerald-100 rounded-lg text-emerald-700 transition flex flex-col items-center space-y-2"
        >
          <i class="fas fa-cogs text-2xl"></i>
          <span class="font-medium">Check Modules</span>
          <span class="text-sm text-emerald-600">Installed packages</span>
        </button>
      </div>
    </div>

    <!-- Results Section -->
    <div v-if="result" class="bg-white rounded-lg shadow p-6">
      <h3 class="text-lg font-medium text-gray-900 mb-3">Results</h3>
      <div class="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
        <pre class="text-sm text-gray-800 whitespace-pre-wrap">{{ JSON.stringify(result, null, 2) }}</pre>
      </div>
    </div>

    <!-- System Status -->
    <div v-if="systemStatus" class="bg-white rounded-lg shadow p-6">
      <h3 class="text-lg font-medium text-gray-900 mb-3">System Status</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <span class="text-sm text-gray-500">Platform:</span>
          <span class="ml-2 font-medium">{{ systemStatus.platform }}</span>
        </div>
        <div>
          <span class="text-sm text-gray-500">Arch:</span>
          <span class="ml-2 font-medium">{{ systemStatus.arch }}</span>
        </div>
        <div>
          <span class="text-sm text-gray-500">Node Version:</span>
          <span class="ml-2 font-medium">{{ systemStatus.nodeVersion }}</span>
        </div>
        <div>
          <span class="text-sm text-gray-500">Admin Rights:</span>
          <span class="ml-2 font-medium" :class="systemStatus.isAdmin ? 'text-green-600' : 'text-red-600'">
            {{ systemStatus.isAdmin ? 'Yes' : 'No' }}
          </span>
        </div>
        <div>
          <span class="text-sm text-gray-500">Python Installed:</span>
          <span class="ml-2 font-medium" :class="systemStatus.pythonInstalled ? 'text-green-600' : 'text-red-600'">
            {{ systemStatus.pythonInstalled ? 'Yes' : 'No' }}
          </span>
        </div>
        <div>
          <span class="text-sm text-gray-500">System Drive:</span>
          <span class="ml-2 font-medium">{{ systemStatus.systemDrive }}</span>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <KillPortModal
      v-if="showKillPortModal"
      @close="showKillPortModal = false"
      @kill="handleKillPort"
    />

    <PowerShellModal
      v-if="showPowerShellModal"
      @close="showPowerShellModal = false"
      @execute="handleExecutePowerShell"
    />

    <ShortcutModal
      v-if="showShortcutModal"
      @close="showShortcutModal = false"
      @create="handleCreateShortcut"
    />

    <PythonPackageModal
      v-if="showPythonPackageModal"
      @close="showPythonPackageModal = false"
      @install="handleInstallPythonPackage"
    />

    <PythonScriptModal
      v-if="showPythonScriptModal"
      @close="showPythonScriptModal = false"
      @run="handleRunPythonScript"
    />
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

// Windows operations via MCP
const getSystemInfo = async () => {
  isProcessing.value = true;
  result.value = null;

  try {
    const response = await callMcpTool('windows_get_system_info', {});
    result.value = response;
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
    result.value = { error: error.message };
  } finally {
    isProcessing.value = false;
  }
};

const killProcessByPort = () => {
  showKillPortModal.value = true;
};

const handleKillPort = async (data: { port: number }) => {
  isProcessing.value = true;
  result.value = null;

  try {
    const response = await callMcpTool('windows_kill_port', {
      port: data.port
    });
    result.value = response;
  } catch (error) {
    result.value = { error: error.message };
  } finally {
    isProcessing.value = false;
  }
};

const executePowerShell = () => {
  showPowerShellModal.value = true;
};

const handleExecutePowerShell = async (data: { command: string; elevated: boolean }) => {
  isProcessing.value = true;
  result.value = null;

  try {
    const response = await callMcpTool('windows_execute_powershell', {
      command: data.command,
      elevated: data.elevated
    });
    result.value = response;
  } catch (error) {
    result.value = { error: error.message };
  } finally {
    isProcessing.value = false;
  }
};

const createShortcut = () => {
  showShortcutModal.value = true;
};

const handleCreateShortcut = async (data: { targetPath: string; shortcutPath: string; options: any }) => {
  isProcessing.value = true;
  result.value = null;

  try {
    const response = await callMcpTool('windows_create_shortcut', {
      targetPath: data.targetPath,
      shortcutPath: data.shortcutPath,
      options: data.options
    });
    result.value = response;
  } catch (error) {
    result.value = { error: error.message };
  } finally {
    isProcessing.value = false;
  }
};

// Python operations via MCP
const checkPythonInstallation = async () => {
  isProcessing.value = true;
  result.value = null;

  try {
    const response = await callMcpTool('python_check_installation', {});
    result.value = response;
    if (response.pythonInstalled) {
      systemStatus.value.pythonInstalled = true;
    }
  } catch (error) {
    result.value = { error: error.message };
  } finally {
    isProcessing.value = false;
  }
};

const createVirtualEnv = async () => {
  isProcessing.value = true;
  result.value = null;

  try {
    const response = await callMcpTool('python_create_venv', {
      name: 'venv_' + Date.now()
    });
    result.value = response;
  } catch (error) {
    result.value = { error: error.message };
  } finally {
    isProcessing.value = false;
  }
};

const installPythonPackage = () => {
  showPythonPackageModal.value = true;
};

const handleInstallPythonPackage = async (data: { packageName: string; environment?: string }) => {
  isProcessing.value = true;
  result.value = null;

  try {
    const response = await callMcpTool('python_install_package', {
      packageName: data.packageName,
      environment: data.environment
    });
    result.value = response;
  } catch (error) {
    result.value = { error: error.message };
  } finally {
    isProcessing.value = false;
  }
};

const runPythonScript = () => {
  showPythonScriptModal.value = true;
};

const handleRunPythonScript = async (data: { scriptPath: string; arguments?: string[] }) => {
  isProcessing.value = true;
  result.value = null;

  try {
    const response = await callMcpTool('python_run_script', {
      scriptPath: data.scriptPath,
      arguments: data.arguments || []
    });
    result.value = response;
  } catch (error) {
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
  } catch (error) {
    result.value = { error: error.message };
  } finally {
    isProcessing.value = false;
  }
};

const checkPythonModules = async () => {
  isProcessing.value = true;
  result.value = null;

  try {
    const response = await callMcpTool('python_check_modules', {
      environment: 'default'
    });
    result.value = response;
  } catch (error) {
    result.value = { error: error.message };
  } finally {
    isProcessing.value = false;
  }
};

// Initialize system status
onMounted(() => {
  systemStatus.value = {
    platform: require('os').platform(),
    arch: require('os').arch(),
    nodeVersion: process.version,
    isAdmin: false, // Will be updated via MCP call
    pythonInstalled: false, // Will be updated via MCP call
    systemDrive: process.env.SystemDrive || 'C:'
  };
});

// Placeholder for MCP tool calls - this would be implemented with actual MCP communication
const callMcpTool = async (toolName: string, params: any) => {
  // This is a placeholder - in a real implementation, this would make
  // actual calls to the MCP server running in the background
  console.log(`Calling MCP tool: ${toolName}`, params);

  // Simulate different responses based on tool name
  switch (toolName) {
    case 'windows_get_system_info':
      return {
        success: true,
        data: {
          platform: 'win32',
          release: '10.0.19042',
          architecture: 'x64',
          hostname: require('os').hostname(),
          totalMemory: Math.round(require('os').totalmem() / 1024 / 1024 / 1024) + 'GB',
          freeMemory: Math.round(require('os').freemem() / 1024 / 1024 / 1024) + 'GB',
          uptime: Math.round(require('os').uptime() / 3600) + ' hours'
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