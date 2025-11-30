<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b flex-shrink-0">
        <h2 class="text-xl font-semibold text-gray-900">Execute PowerShell</h2>
        <button
          @click="$emit('close')"
          class="text-gray-400 hover:text-gray-600 transition"
        >
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>

      <!-- Body -->
      <div class="p-6 flex-grow overflow-y-auto">
        <form @submit.prevent="handleSubmit">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              PowerShell Command
            </label>
            <textarea
              v-model="formData.command"
              placeholder="Enter PowerShell command or script..."
              required
              rows="6"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              :class="{ 'border-red-500': errors.command }"
            ></textarea>
            <p v-if="errors.command" class="text-red-500 text-sm mt-1">{{ errors.command }}</p>
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Execution Options
            </label>
            <div class="space-y-3">
              <label class="flex items-center">
                <input
                  v-model="formData.elevated"
                  type="checkbox"
                  class="mr-2"
                />
                <span class="text-gray-700">Run as Administrator</span>
                <i class="fas fa-user-shield text-orange-500 ml-2"></i>
              </label>
              <label class="flex items-center">
                <input
                  v-model="formData.waitForCompletion"
                  type="checkbox"
                  class="mr-2"
                />
                <span class="text-gray-700">Wait for Completion</span>
              </label>
              <label class="flex items-center">
                <input
                  v-model="formData.captureOutput"
                  type="checkbox"
                  class="mr-2"
                />
                <span class="text-gray-700">Capture Output</span>
              </label>
            </div>
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Timeout (seconds)
            </label>
            <input
              v-model.number="formData.timeout"
              type="number"
              min="1"
              max="300"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <!-- Command Templates -->
          <div class="mb-4">
            <p class="text-sm font-medium text-gray-700 mb-2">Common Commands:</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
              <button
                type="button"
                v-for="template in commandTemplates"
                :key="template.name"
                @click="formData.command = template.command"
                class="text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded text-sm transition"
              >
                <div class="font-medium">{{ template.name }}</div>
                <code class="text-xs text-gray-600">{{ template.command }}</code>
              </button>
            </div>
          </div>

          <!-- System Information Commands -->
          <div class="mb-4">
            <p class="text-sm font-medium text-gray-700 mb-2">System Information:</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
              <button
                type="button"
                v-for="sysCommand in systemCommands"
                :key="sysCommand.name"
                @click="formData.command = sysCommand.command"
                class="text-left px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded text-sm transition"
              >
                <div class="font-medium">{{ sysCommand.name }}</div>
                <code class="text-xs text-gray-600">{{ sysCommand.command }}</code>
              </button>
            </div>
          </div>

          <!-- Network Commands -->
          <div class="mb-4">
            <p class="text-sm font-medium text-gray-700 mb-2">Network Commands:</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
              <button
                type="button"
                v-for="netCommand in networkCommands"
                :key="netCommand.name"
                @click="formData.command = netCommand.command"
                class="text-left px-3 py-2 bg-green-50 hover:bg-green-100 rounded text-sm transition"
              >
                <div class="font-medium">{{ netCommand.name }}</div>
                <code class="text-xs text-gray-600">{{ netCommand.command }}</code>
              </button>
            </div>
          </div>

          <!-- Warning for elevated commands -->
          <div v-if="formData.elevated" class="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div class="flex">
              <div class="flex-shrink-0">
                <i class="fas fa-exclamation-triangle text-orange-400"></i>
              </div>
              <div class="ml-3">
                <h3 class="text-sm font-medium text-orange-800">Administrator Privileges</h3>
                <div class="mt-2 text-sm text-orange-700">
                  <p>This command will run with administrator privileges. Please be careful as it can modify system settings.</p>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end p-6 border-t bg-gray-50 space-x-3 flex-shrink-0">
        <button
          @click="$emit('close')"
          class="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md transition"
        >
          Cancel
        </button>
        <button
          @click="handleSubmit"
          :disabled="isSubmitting"
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50"
        >
          <i v-if="isSubmitting" class="fas fa-spinner fa-spin mr-2"></i>
          <i v-else class="fas fa-terminal mr-2"></i>
          {{ isSubmitting ? 'Executing...' : 'Execute' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';

const emit = defineEmits<{
  close: [];
  execute: (data: { command: string; elevated: boolean; waitForCompletion: boolean; captureOutput: boolean; timeout: number }) => void;
}>();

const isSubmitting = ref(false);
const errors = reactive({
  command: ''
});

const formData = reactive({
  command: '',
  elevated: false,
  waitForCompletion: true,
  captureOutput: true,
  timeout: 30
});

const commandTemplates = [
  {
    name: 'List Processes',
    command: 'Get-Process | Select-Object Name, CPU, WorkingSet | Sort-Object CPU -Descending'
  },
  {
    name: 'List Services',
    command: 'Get-Service | Where-Object {$_.Status -eq "Running"} | Select-Object Name, Status'
  },
  {
    name: 'Disk Space',
    command: 'Get-PSDrive -PSProvider FileSystem | Select-Object Name, @{Name="Size(GB)";Expression={[math]::Round($_.Used / 1GB, 2)}}'
  },
  {
    name: 'System Uptime',
    command: '(Get-Date) - (Get-CimInstance Win32_OperatingSystem).LastBootUpTime'
  },
  {
    name: 'Environment Variables',
    command: 'Get-ChildItem Env: | Select-Object Name, Value'
  },
  {
    name: 'Installed Programs',
    command: 'Get-WmiObject -Class Win32_Product | Select-Object Name, Version'
  }
];

const systemCommands = [
  {
    name: 'System Info',
    command: 'Get-ComputerInfo | Select-Object WindowsProductName, WindowsVersion, TotalPhysicalMemory'
  },
  {
    name: 'CPU Usage',
    command: 'Get-Counter "\\Processor(_Total)\\% Processor Time" -SampleInterval 1 -MaxSamples 3'
  },
  {
    name: 'Memory Usage',
    command: 'Get-Counter "\\Memory\\Available MBytes" -SampleInterval 1 -MaxSamples 3'
  },
  {
    name: 'Running Processes',
    command: 'Get-Process | Where-Object {$_.CPU -gt 0} | Select-Object Name, CPU, WorkingSet | Format-Table'
  },
  {
    name: 'Event Log Errors',
    command: 'Get-EventLog -LogName Application -EntryType Error -Newest 10'
  },
  {
    name: 'Windows Updates',
    command: 'Get-HotFix | Select-Object HotFixID, Description, InstalledOn | Sort-Object InstalledOn -Descending'
  }
];

const networkCommands = [
  {
    name: 'IP Configuration',
    command: 'Get-NetIPConfiguration | Select-Object InterfaceAlias, IPv4Address'
  },
  {
    name: 'Network Adapters',
    command: 'Get-NetAdapter | Where-Object {$_.Status -eq "Up"} | Select-Object Name, Status, LinkSpeed'
  },
  {
    name: 'Open Ports',
    command: 'Get-NetTCPConnection | Where-Object {$_.State -eq "Listen"} | Select-Object LocalAddress, LocalPort'
  },
  {
    name: 'Ping Test',
    command: 'Test-Connection -ComputerName google.com -Count 4'
  },
  {
    name: 'DNS Cache',
    command: 'Get-DnsClientCache | Select-Object Name, DataEntry'
  },
  {
    name: 'Route Table',
    command: 'Get-NetRoute | Select-Object DestinationPrefix, NextHop, RouteMetric'
  }
];

const validateForm = () => {
  errors.command = '';

  let isValid = true;

  // Validate command
  if (!formData.command.trim()) {
    errors.command = 'PowerShell command is required';
    isValid = false;
  }

  return isValid;
};

const handleSubmit = () => {
  if (!validateForm()) return;

  // Additional confirmation for elevated commands
  if (formData.elevated && !confirm('This command will run with administrator privileges. Are you sure you want to continue?')) {
    return;
  }

  isSubmitting.value = true;

  const data = {
    command: formData.command,
    elevated: formData.elevated,
    waitForCompletion: formData.waitForCompletion,
    captureOutput: formData.captureOutput,
    timeout: formData.timeout
  };

  // Emit with a small delay to show loading state
  setTimeout(() => {
    emit('execute', data);
    isSubmitting.value = false;
    emit('close');
  }, 500);
};
</script>