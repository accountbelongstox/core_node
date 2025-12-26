<template>
  <div class="pm-panel pm-panel--blue">
    <!-- Header -->
    <div class="pm-panel__header">
      <h3 class="pm-panel__title">
        <i class="pm-panel__title-icon fas fa-list"></i>
        Installed Packages - {{ deviceSerial }}
      </h3>
      <button class="pm-button pm-button--ghost" @click="close">
        <i class="fas fa-times"></i>
      </button>
    </div>

    <!-- Body -->
    <div class="pm-panel__body">
      <div class="space-y-4">
        <!-- Search and Filter -->
        <div class="flex gap-3">
          <div class="flex-1">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search packages (e.g., com.android.chrome)..."
              class="pm-input"
              @input="debouncedSearch"
            />
          </div>
          <button
            class="pm-button pm-button--electric-blue"
            :disabled="loading"
            @click="loadPackages"
          >
            <i class="fas fa-sync" :class="{ 'fa-spin': loading }"></i>
            Refresh
          </button>
        </div>

        <!-- Loading State -->
        <div v-if="loading && packages.length === 0" class="text-center py-8">
          <i class="fas fa-spinner fa-spin text-3xl text-blue-500 mb-3"></i>
          <p class="text-gray-400">Loading packages...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="pm-panel pm-panel--red p-4">
          <div class="flex items-start gap-3">
            <i class="fas fa-exclamation-circle text-red-500 text-xl"></i>
            <div>
              <h4 class="font-semibold text-red-300">Failed to load packages</h4>
              <p class="text-sm text-red-400 mt-1">{{ error }}</p>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else-if="filteredPackages.length === 0 && !loading" class="text-center py-8">
          <i class="fas fa-inbox text-4xl text-gray-400 mb-3"></i>
          <p class="text-gray-400">
            {{ searchQuery ? 'No packages match your search' : 'No packages found' }}
          </p>
        </div>

        <!-- Package List -->
        <div v-else class="space-y-2 max-h-96 overflow-y-auto">
          <!-- Stats -->
          <div class="flex items-center justify-between text-sm text-gray-400 px-2 py-1 bg-gray-800/50 rounded">
            <span>
              Showing {{ filteredPackages.length }} of {{ packages.length }} packages
            </span>
            <span v-if="selectedPackages.length > 0" class="text-blue-400">
              {{ selectedPackages.length }} selected
            </span>
          </div>

          <!-- Packages -->
          <div
            v-for="pkg in filteredPackages"
            :key="pkg"
            class="pm-device-card"
            :class="{ 'border-blue-500': selectedPackages.includes(pkg) }"
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
              <div class="font-mono text-sm text-gray-100 truncate">
                {{ pkg }}
              </div>
              <div class="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                <span v-if="isSystemPackage(pkg)" class="pm-badge pm-badge--warning">
                  System
                </span>
                <span v-else class="pm-badge pm-badge--success">
                  User
                </span>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-2">
              <button
                class="pm-button pm-button--fire"
                style="font-size: 0.75rem; padding: 0.25rem 0.75rem;"
                :disabled="isSystemPackage(pkg)"
                :title="isSystemPackage(pkg) ? 'Cannot uninstall system apps' : 'Uninstall'"
                @click.stop="uninstallPackage(pkg)"
              >
                <i class="fas fa-trash"></i>
                Uninstall
              </button>
              <button
                class="pm-button pm-button--ghost"
                style="font-size: 0.75rem; padding: 0.25rem 0.5rem;"
                title="Copy package name"
                @click.stop="copyPackageName(pkg)"
              >
                <i class="fas fa-copy"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="pm-panel__footer">
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-2">
          <button
            v-if="selectedPackages.length > 0"
            class="pm-button pm-button--fire"
            :disabled="selectedPackages.some(isSystemPackage)"
            @click="uninstallSelectedPackages"
          >
            <i class="fas fa-trash"></i>
            Uninstall Selected ({{ selectedPackages.length }})
          </button>
        </div>
        <button class="pm-button pm-button--ghost" @click="close">
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import BasePanel from '@/common/components/ui/BasePanel.vue';
import BaseButton from '@/common/components/ui/BaseButton.vue';
import { useToast } from '@/app_pymatrix_pages/composables/useToast';
import { PyMatrixFileAPI } from '@/services/api/pymatrix/pymatrix-file-api';

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
