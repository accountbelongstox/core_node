<template>
  <BasePanel
    v-if="visible"
    :title="`Installed Packages - ${deviceSerial}`"
    size="xl"
    icon="fas fa-list"
    @close="close"
  >
    <template #default>
      <div class="space-y-4">
        <!-- Search and Filter -->
        <div class="flex gap-3">
          <div class="flex-1">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search packages (e.g., com.android.chrome)..."
              class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     transition-colors"
              @input="debouncedSearch"
            />
          </div>
          <BaseButton
            color="primary"
            icon="fas fa-sync"
            :loading="loading"
            @click="loadPackages"
          >
            Refresh
          </BaseButton>
        </div>

        <!-- Loading State -->
        <div v-if="loading && packages.length === 0" class="text-center py-8">
          <i class="fas fa-spinner fa-spin text-3xl text-blue-500 mb-3"></i>
          <p class="text-gray-600 dark:text-gray-400">Loading packages...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div class="flex items-start gap-3">
            <i class="fas fa-exclamation-circle text-red-500 text-xl"></i>
            <div>
              <h4 class="font-semibold text-red-800 dark:text-red-300">Failed to load packages</h4>
              <p class="text-sm text-red-600 dark:text-red-400 mt-1">{{ error }}</p>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else-if="filteredPackages.length === 0 && !loading" class="text-center py-8">
          <i class="fas fa-inbox text-4xl text-gray-400 mb-3"></i>
          <p class="text-gray-600 dark:text-gray-400">
            {{ searchQuery ? 'No packages match your search' : 'No packages found' }}
          </p>
        </div>

        <!-- Package List -->
        <div v-else class="space-y-2 max-h-96 overflow-y-auto">
          <!-- Stats -->
          <div class="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded">
            <span>
              Showing {{ filteredPackages.length }} of {{ packages.length }} packages
            </span>
            <span v-if="selectedPackages.length > 0" class="text-blue-600 dark:text-blue-400">
              {{ selectedPackages.length }} selected
            </span>
          </div>

          <!-- Packages -->
          <div
            v-for="pkg in filteredPackages"
            :key="pkg"
            class="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg
                   hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            :class="{ 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700': selectedPackages.includes(pkg) }"
            @click="togglePackageSelection(pkg)"
          >
            <!-- Checkbox -->
            <input
              type="checkbox"
              :checked="selectedPackages.includes(pkg)"
              class="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              @click.stop="togglePackageSelection(pkg)"
            />

            <!-- Package Icon -->
            <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <i class="fas fa-cube text-white text-lg"></i>
            </div>

            <!-- Package Info -->
            <div class="flex-1 min-w-0">
              <div class="font-mono text-sm text-gray-900 dark:text-gray-100 truncate">
                {{ pkg }}
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-0.5">
                <span v-if="isSystemPackage(pkg)" class="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">
                  System
                </span>
                <span v-else class="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs">
                  User
                </span>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-2">
              <BaseButton
                size="xs"
                color="danger"
                icon="fas fa-trash"
                :disabled="isSystemPackage(pkg)"
                :title="isSystemPackage(pkg) ? 'Cannot uninstall system apps' : 'Uninstall'"
                @click.stop="uninstallPackage(pkg)"
              >
                Uninstall
              </BaseButton>
              <BaseButton
                size="xs"
                color="default"
                icon="fas fa-copy"
                title="Copy package name"
                @click.stop="copyPackageName(pkg)"
              >
              </BaseButton>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <BaseButton
            v-if="selectedPackages.length > 0"
            color="danger"
            icon="fas fa-trash"
            :disabled="selectedPackages.some(isSystemPackage)"
            @click="uninstallSelectedPackages"
          >
            Uninstall Selected ({{ selectedPackages.length }})
          </BaseButton>
        </div>
        <BaseButton color="default" @click="close">
          Close
        </BaseButton>
      </div>
    </template>
  </BasePanel>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import BasePanel from '@/common/components/ui/BasePanel.vue';
import BaseButton from '@/common/components/ui/BaseButton.vue';
import { useToast } from '../composables_app_pymatrix/useToast';
import { PyMatrixFileAPI } from '~/services/api/pymatrix/pymatrix-file-api';

const props = defineProps<{
  visible: boolean;
  deviceSerial: string;
}>();

const emit = defineEmits<{
  close: [];
  packageUninstalled: [packageName: string];
}>();

const { success, error: showError } = useToast();
const fileAPI = new PyMatrixFileAPI();

// State
const packages = ref<string[]>([]);
const loading = ref(false);
const error = ref('');
const searchQuery = ref('');
const selectedPackages = ref<string[]>([]);

// Computed
const filteredPackages = computed(() => {
  if (!searchQuery.value) return packages.value;

  const query = searchQuery.value.toLowerCase();
  return packages.value.filter(pkg => pkg.toLowerCase().includes(query));
});

// System package detection (basic heuristic)
const isSystemPackage = (packageName: string): boolean => {
  const systemPrefixes = [
    'com.android.',
    'android.',
    'com.google.android.',
    'com.samsung.',
    'com.sec.',
  ];
  return systemPrefixes.some(prefix => packageName.startsWith(prefix));
};

// Debounced search
let searchTimeout: NodeJS.Timeout;
const debouncedSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    // Search is reactive through computed property
  }, 300);
};

// Toggle package selection
const togglePackageSelection = (packageName: string) => {
  const index = selectedPackages.value.indexOf(packageName);
  if (index > -1) {
    selectedPackages.value.splice(index, 1);
  } else {
    selectedPackages.value.push(packageName);
  }
};

// Copy package name to clipboard
const copyPackageName = async (packageName: string) => {
  try {
    await navigator.clipboard.writeText(packageName);
    success('Package name copied to clipboard');
  } catch (err) {
    showError('Failed to copy package name');
  }
};

// Load packages
const loadPackages = async () => {
  loading.value = true;
  error.value = '';

  try {
    const response = await fileAPI.listPackages(props.deviceSerial);

    if (response.success && response.data?.packages) {
      packages.value = response.data.packages.sort();
      success(`Loaded ${packages.value.length} packages`);
    } else {
      error.value = response.error || 'Failed to load packages';
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error occurred';
  } finally {
    loading.value = false;
  }
};

// Uninstall single package
const uninstallPackage = async (packageName: string) => {
  if (isSystemPackage(packageName)) {
    showError('Cannot uninstall system apps');
    return;
  }

  if (!confirm(`Are you sure you want to uninstall "${packageName}"?`)) {
    return;
  }

  try {
    const response = await fileAPI.uninstallApp(props.deviceSerial, packageName);

    if (response.success) {
      success(`Successfully uninstalled ${packageName}`);
      // Remove from list
      packages.value = packages.value.filter(pkg => pkg !== packageName);
      // Remove from selection if selected
      selectedPackages.value = selectedPackages.value.filter(pkg => pkg !== packageName);
      // Emit event
      emit('packageUninstalled', packageName);
    } else {
      showError(response.error || `Failed to uninstall ${packageName}`);
    }
  } catch (err) {
    showError(err instanceof Error ? err.message : 'Failed to uninstall package');
  }
};

// Uninstall selected packages
const uninstallSelectedPackages = async () => {
  const userPackages = selectedPackages.value.filter(pkg => !isSystemPackage(pkg));

  if (userPackages.length === 0) {
    showError('No user packages selected');
    return;
  }

  if (!confirm(`Are you sure you want to uninstall ${userPackages.length} package(s)?`)) {
    return;
  }

  let successCount = 0;
  let failCount = 0;

  for (const packageName of userPackages) {
    try {
      const response = await fileAPI.uninstallApp(props.deviceSerial, packageName);

      if (response.success) {
        successCount++;
        // Remove from list
        packages.value = packages.value.filter(pkg => pkg !== packageName);
        // Emit event
        emit('packageUninstalled', packageName);
      } else {
        failCount++;
      }
    } catch (err) {
      failCount++;
    }
  }

  // Clear selection
  selectedPackages.value = [];

  // Show result
  if (successCount > 0) {
    success(`Successfully uninstalled ${successCount} package(s)`);
  }
  if (failCount > 0) {
    showError(`Failed to uninstall ${failCount} package(s)`);
  }
};

// Close panel
const close = () => {
  emit('close');
};

// Watch visibility to load packages
watch(() => props.visible, (visible) => {
  if (visible) {
    loadPackages();
    selectedPackages.value = [];
    searchQuery.value = '';
  }
});
</script>
