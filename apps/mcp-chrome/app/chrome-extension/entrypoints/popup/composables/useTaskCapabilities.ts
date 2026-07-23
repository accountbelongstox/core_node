import { computed, type ComputedRef, type Ref } from 'vue';
import { usePersistedRef } from '@/composables/usePersistedRef';
import {
  CAPABILITIES,
  type CapabilityDef,
  type CapabilityKey,
} from '@/utils/task-capabilities';

export type TaskCapabilityState = Record<CapabilityKey, Ref<boolean>>;

export interface TaskCapabilitiesComposable {
  capabilities: CapabilityDef[];
  capabilityState: TaskCapabilityState;
  enabledKeys: ComputedRef<CapabilityKey[]>;
  enabledCount: ComputedRef<number>;
}

export function useTaskCapabilities(): TaskCapabilitiesComposable {
  const capabilityState = CAPABILITIES.reduce(
    (state, capability) => {
      state[capability.key] = usePersistedRef(capability.storageKey, false);
      return state;
    },
    {} as TaskCapabilityState,
  );
  const enabledKeys = computed<CapabilityKey[]>(() =>
    CAPABILITIES
      .filter((capability) => !capability.stub && capabilityState[capability.key].value)
      .map((capability) => capability.key),
  );
  const enabledCount = computed(() => enabledKeys.value.length);

  return {
    capabilities: CAPABILITIES,
    capabilityState,
    enabledKeys,
    enabledCount,
  };
}
