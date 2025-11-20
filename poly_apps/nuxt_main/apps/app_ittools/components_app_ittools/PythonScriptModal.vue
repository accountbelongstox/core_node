<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b flex-shrink-0">
        <h2 class="text-xl font-semibold text-gray-900">Run Python Script</h2>
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
              Script Path
            </label>
            <div class="flex">
              <input
                v-model="formData.scriptPath"
                type="text"
                placeholder="C:\scripts\myscript.py"
                required
                class="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                :class="{ 'border-red-500': errors.scriptPath }"
              />
              <button
                type="button"
                @click="browseScriptPath"
                class="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-md hover:bg-gray-200 transition"
              >
                <i class="fas fa-folder-open"></i>
              </button>
            </div>
            <p v-if="errors.scriptPath" class="text-red-500 text-sm mt-1">{{ errors.scriptPath }}</p>
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Python Environment
            </label>
            <select
              v-model="formData.environment"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="global">Global Python</option>
              <option value="venv">Current Virtual Environment</option>
              <option value="custom">Custom Python Path</option>
            </select>
          </div>

          <div v-if="formData.environment === 'custom'" class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Custom Python Path
            </label>
            <input
              v-model="formData.pythonPath"
              type="text"
              placeholder="C:\Python39\python.exe"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Command Line Arguments
            </label>
            <textarea
              v-model="formData.arguments"
              placeholder="--input data.txt&#10;--output result.txt&#10;--verbose"
              rows="3"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            ></textarea>
            <p class="text-xs text-gray-500 mt-1">One argument per line</p>
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Working Directory (optional)
            </label>
            <div class="flex">
              <input
                v-model="formData.workingDirectory"
                type="text"
                placeholder="C:\scripts"
                class="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                @click="browseWorkingDirectory"
                class="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-md hover:bg-gray-200 transition"
              >
                <i class="fas fa-folder-open"></i>
              </button>
            </div>
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Execution Options
            </label>
            <div class="space-y-2">
              <label class="flex items-center">
                <input
                  v-model="formData.captureOutput"
                  type="checkbox"
                  class="mr-2"
                />
                <span class="text-gray-700">Capture output</span>
              </label>
              <label class="flex items-center">
                <input
                  v-model="formData.waitForCompletion"
                  type="checkbox"
                  class="mr-2"
                />
                <span class="text-gray-700">Wait for completion</span>
              </label>
              <label class="flex items-center">
                <input
                  v-model="formData.raiseErrors"
                  type="checkbox"
                  class="mr-2"
                />
                <span class="text-gray-700">Raise on errors</span>
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
              max="3600"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <!-- Script Templates -->
          <div class="mb-4">
            <p class="text-sm font-medium text-gray-700 mb-2">Script Templates:</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
              <button
                type="button"
                v-for="template in scriptTemplates"
                :key="template.name"
                @click="createScriptFromTemplate(template)"
                class="text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded text-sm transition"
              >
                <div class="font-medium">{{ template.name }}</div>
                <div class="text-xs text-gray-600">{{ template.description }}</div>
              </button>
            </div>
          </div>

          <!-- Quick Actions -->
          <div class="mb-4">
            <p class="text-sm font-medium text-gray-700 mb-2">Quick Actions:</p>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                @click="openInteractiveShell"
                class="px-3 py-1 bg-green-100 hover:bg-green-200 rounded-full text-sm text-green-700 transition"
              >
                <i class="fas fa-terminal mr-1"></i>Interactive Shell
              </button>
              <button
                type="button"
                @click="openJupyter"
                class="px-3 py-1 bg-orange-100 hover:bg-orange-200 rounded-full text-sm text-orange-700 transition"
              >
                <i class="fas fa-book mr-1"></i>Jupyter Notebook
              </button>
              <button
                type="button"
                @click="runPythonMpm"
                class="px-3 py-1 bg-blue-100 hover:bg-blue-200 rounded-full text-sm text-blue-700 transition"
              >
                <i class="fas fa-cube mr-1"></i>Python Package Manager
              </button>
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
          <i v-else class="fas fa-play mr-2"></i>
          {{ isSubmitting ? 'Running...' : 'Run Script' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';

const emit = defineEmits<{
  close: [];
  run: (data: { scriptPath: string; arguments: string[]; environment: string; options: any }) => void;
}>();

const isSubmitting = ref(false);
const errors = reactive({
  scriptPath: ''
});

const formData = reactive({
  scriptPath: '',
  environment: 'global',
  pythonPath: '',
  arguments: '',
  workingDirectory: '',
  captureOutput: true,
  waitForCompletion: true,
  raiseErrors: true,
  timeout: 300
});

const scriptTemplates = [
  {
    name: 'Hello World',
    description: 'Simple hello world script',
    code: 'print("Hello, World!")\nprint("Python is running successfully!")'
  },
  {
    name: 'System Info',
    description: 'Display system information',
    code: 'import platform\nimport sys\n\nprint(f"Python Version: {sys.version}")\nprint(f"Platform: {platform.platform()}")\nprint(f"Architecture: {platform.architecture()}")'
  },
  {
    name: 'HTTP Server',
    description: 'Simple HTTP server',
    code: 'import http.server\nimport socketserver\nimport webbrowser\nfrom threading import Timer\n\nPORT = 8000\nHandler = http.server.SimpleHTTPRequestHandler\n\nwith socketserver.TCPServer(("", PORT), Handler) as httpd:\n    print(f"Serving at port {PORT}")\n    \n    # Open browser after 1 second\n    def open_browser():\n        webbrowser.open(f"http://localhost:{PORT}")\n    Timer(1.0, open_browser).start()\n    \n    httpd.serve_forever()'
  },
  {
    name: 'File Scanner',
    description: 'Scan directory for files',
    code: 'import os\nfrom pathlib import Path\n\ndef scan_directory(path="."):\n    print(f"Scanning directory: {os.path.abspath(path)}")\n    \n    for root, dirs, files in os.walk(path):\n        level = root.replace(path, "").count(os.sep)\n        indent = " " * 2 * level\n        print(f"{indent}{os.path.basename(root)}/")\n        \n        subindent = " " * 2 * (level + 1)\n        for file in files:\n            file_path = os.path.join(root, file)\n            file_size = os.path.getsize(file_path)\n            print(f"{subindent}{file} ({file_size} bytes)")\n\nif __name__ == "__main__":\n    scan_directory()'
  },
  {
    name: 'JSON Processor',
    description: 'Process JSON files',
    code: 'import json\nimport sys\n\ndef process_json_file(filepath):\n    try:\n        with open(filepath, \'r\') as f:\n            data = json.load(f)\n        \n        print(f"Loaded JSON from {filepath}")\n        print(f"Keys: {list(data.keys()) if isinstance(data, dict) else \'Not a dict\'}")\n        print(f"Type: {type(data).__name__}")\n        \n        # Pretty print the JSON\n        print("\\nContent:")\n        print(json.dumps(data, indent=2, ensure_ascii=False))\n        \n    except Exception as e:\n        print(f"Error processing {filepath}: {e}")\n\nif __name__ == "__main__":\n    if len(sys.argv) > 1:\n        process_json_file(sys.argv[1])\n    else:\n        print("Usage: python script.py <json_file>")'
  }
];

const validateForm = () => {
  errors.scriptPath = '';

  let isValid = true;

  // Validate script path
  if (!formData.scriptPath.trim()) {
    errors.scriptPath = 'Script path is required';
    isValid = false;
  } else if (!formData.scriptPath.toLowerCase().endsWith('.py')) {
    errors.scriptPath = 'Script must be a .py file';
    isValid = false;
  }

  return isValid;
};

const browseScriptPath = () => {
  alert('File browser would open here. Please enter the script path manually.');
};

const browseWorkingDirectory = () => {
  alert('Folder browser would open here. Please enter the working directory manually.');
};

const createScriptFromTemplate = (template: { name: string; code: string }) => {
  // In a real implementation, this would create a temporary file
  const scriptPath = `${template.name.toLowerCase().replace(/\s+/g, '_')}.py`;
  formData.scriptPath = scriptPath;
  alert(`Script template "${template.name}" would be created at ${scriptPath}\\n\\nCode:\\n${template.code}`);
};

const openInteractiveShell = () => {
  const data = {
    scriptPath: '-c',
    arguments: ['import code; code.interact()'],
    environment: formData.environment,
    options: {
      pythonPath: formData.environment === 'custom' ? formData.pythonPath : undefined,
      captureOutput: true,
      waitForCompletion: false,
      raiseErrors: false,
      timeout: 0,
      workingDirectory: formData.workingDirectory || undefined
    }
  };

  emit('run', data);
  emit('close');
};

const openJupyter = () => {
  const data = {
    scriptPath: '-m',
    arguments: ['jupyter', 'notebook'],
    environment: formData.environment,
    options: {
      pythonPath: formData.environment === 'custom' ? formData.pythonPath : undefined,
      captureOutput: false,
      waitForCompletion: false,
      raiseErrors: false,
      timeout: 0,
      workingDirectory: formData.workingDirectory || undefined
    }
  };

  emit('run', data);
  emit('close');
};

const runPythonMpm = () => {
  const data = {
    scriptPath: '-m',
    arguments: ['pip'],
    environment: formData.environment,
    options: {
      pythonPath: formData.environment === 'custom' ? formData.pythonPath : undefined,
      captureOutput: true,
      waitForCompletion: true,
      raiseErrors: false,
      timeout: 60,
      workingDirectory: formData.workingDirectory || undefined
    }
  };

  emit('run', data);
  emit('close');
};

const handleSubmit = () => {
  if (!validateForm()) return;

  isSubmitting.value = true;

  // Parse arguments (split by line, filter empty lines)
  const scriptArguments = formData.arguments
    .split('\n')
    .map(arg => arg.trim())
    .filter(arg => arg.length > 0);

  const options = {
    pythonPath: formData.environment === 'custom' ? formData.pythonPath : undefined,
    captureOutput: formData.captureOutput,
    waitForCompletion: formData.waitForCompletion,
    raiseErrors: formData.raiseErrors,
    timeout: formData.timeout,
    workingDirectory: formData.workingDirectory || undefined
  };

  const data = {
    scriptPath: formData.scriptPath,
    arguments: scriptArguments,
    environment: formData.environment,
    options
  };

  // Emit with a small delay to show loading state
  setTimeout(() => {
    emit('run', data);
    isSubmitting.value = false;
    emit('close');
  }, 500);
};
</script>