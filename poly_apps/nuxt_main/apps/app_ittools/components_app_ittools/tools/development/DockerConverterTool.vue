<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-blue-600 to-cyan-500">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fab fa-docker text-white text-2xl"></i>
            <h2 class="text-2xl font-semibold text-white">Docker Run to Compose</h2>
          </div>
          <p class="text-sm text-blue-100">Convert docker run commands to docker-compose.yml</p>
        </div>
        <button @click="$emit('close')" class="p-2 text-blue-200 hover:text-white rounded-lg hover:bg-white/10 transition">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid gap-6 lg:grid-cols-2">
        <!-- Input -->
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Docker Run Command</label>
            <textarea v-model="dockerRun" rows="8"
              class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              placeholder="docker run -d --name nginx -p 80:80 -v /data:/usr/share/nginx/html nginx:latest"></textarea>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Examples</label>
            <div class="flex flex-wrap gap-2">
              <button v-for="example in examples" :key="example.name" @click="dockerRun = example.cmd"
                class="px-3 py-2 bg-slate-100 hover:bg-blue-100 rounded-lg text-sm transition">
                {{ example.name }}
              </button>
            </div>
          </div>
        </div>

        <!-- Output -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-slate-700">docker-compose.yml</h3>
            <button v-if="result" @click="copy" 
              class="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 transition">
              <i :class="copied ? 'fas fa-check text-green-600' : 'fas fa-copy'" class="mr-1"></i>
              {{ copied ? 'Copied!' : 'Copy' }}
            </button>
          </div>

          <div v-if="loading" class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center">
            <i class="fas fa-spinner fa-spin text-blue-600 text-2xl"></i>
          </div>

          <div v-else-if="result" class="bg-slate-900 rounded-xl p-4 overflow-auto max-h-[400px]">
            <pre class="text-green-400 font-mono text-sm whitespace-pre">{{ result }}</pre>
          </div>

          <div v-else class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center text-slate-400">
            <i class="fab fa-docker text-4xl mb-2"></i>
            <p>Enter a docker run command</p>
          </div>
        </div>
      </div>

      <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <i class="fas fa-exclamation-circle mr-2"></i>{{ error }}
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex justify-end space-x-3">
      <button @click="reset" class="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-white">Reset</button>
      <button @click="convert" :disabled="!dockerRun || loading"
        class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>Convert
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Tool } from '../../../types_app_ittools';

defineProps<{ tool: Tool }>();
defineEmits<{ close: []; executed: [result: any] }>();

const dockerRun = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<string>('');
const copied = ref(false);

const examples = [
  { name: 'Nginx', cmd: 'docker run -d --name nginx -p 80:80 -v /data:/usr/share/nginx/html nginx:latest' },
  { name: 'MySQL', cmd: 'docker run -d --name mysql -e MYSQL_ROOT_PASSWORD=secret -p 3306:3306 -v mysql_data:/var/lib/mysql mysql:8' },
  { name: 'Redis', cmd: 'docker run -d --name redis -p 6379:6379 redis:alpine' }
];

const convert = () => {
  if (!dockerRun.value.trim()) return;
  loading.value = true;
  error.value = null;

  try {
    const compose = parseDockerRun(dockerRun.value);
    result.value = compose;
  } catch (err: any) {
    error.value = err.message || 'Failed to parse docker run command';
  } finally {
    loading.value = false;
  }
};

const parseDockerRun = (cmd: string): string => {
  const args = cmd.replace(/docker\s+run\s+/i, '').trim();
  
  // Parse options
  const service: Record<string, any> = {};
  let image = '';
  
  // Simple regex-based parsing
  const portMatch = args.match(/-p\s+(\d+:\d+)/g);
  const volumeMatch = args.match(/-v\s+([\w\/:.]+)/g);
  const envMatch = args.match(/-e\s+(\w+=\w+)/g);
  const nameMatch = args.match(/--name\s+(\w+)/);
  const restartMatch = args.match(/--restart\s+(\w+)/);
  
  // Extract image (last part that doesn't start with -)
  const parts = args.split(/\s+/);
  for (let i = parts.length - 1; i >= 0; i--) {
    if (!parts[i].startsWith('-') && parts[i].includes(':')) {
      image = parts[i];
      break;
    } else if (!parts[i].startsWith('-') && i === parts.length - 1) {
      image = parts[i];
      break;
    }
  }

  if (!image) image = 'image:latest';
  
  service.image = image;
  
  if (nameMatch) {
    service.container_name = nameMatch[1];
  }
  
  if (portMatch) {
    service.ports = portMatch.map(p => p.replace(/-p\s+/, ''));
  }
  
  if (volumeMatch) {
    service.volumes = volumeMatch.map(v => v.replace(/-v\s+/, ''));
  }
  
  if (envMatch) {
    service.environment = {};
    envMatch.forEach(e => {
      const [key, value] = e.replace(/-e\s+/, '').split('=');
      service.environment[key] = value;
    });
  }
  
  if (restartMatch) {
    service.restart = restartMatch[1];
  }
  
  // Generate YAML
  const serviceName = service.container_name || 'app';
  let yaml = 'version: "3.8"\n\nservices:\n';
  yaml += `  ${serviceName}:\n`;
  yaml += `    image: ${service.image}\n`;
  
  if (service.container_name) {
    yaml += `    container_name: ${service.container_name}\n`;
  }
  
  if (service.ports) {
    yaml += '    ports:\n';
    service.ports.forEach((p: string) => {
      yaml += `      - "${p}"\n`;
    });
  }
  
  if (service.volumes) {
    yaml += '    volumes:\n';
    service.volumes.forEach((v: string) => {
      yaml += `      - ${v}\n`;
    });
  }
  
  if (service.environment) {
    yaml += '    environment:\n';
    Object.entries(service.environment).forEach(([k, v]) => {
      yaml += `      ${k}: ${v}\n`;
    });
  }
  
  if (service.restart) {
    yaml += `    restart: ${service.restart}\n`;
  }
  
  return yaml;
};

const copy = async () => {
  try {
    await navigator.clipboard.writeText(result.value);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  } catch {}
};

const reset = () => {
  dockerRun.value = '';
  result.value = '';
  error.value = null;
};
</script>

