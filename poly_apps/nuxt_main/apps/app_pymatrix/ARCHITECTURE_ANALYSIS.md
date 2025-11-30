# PyMatrix Frontend Architecture Analysis

**Date**: 2025-11-04
**Purpose**: Understand existing structure before refactoring

---

## Existing Architecture

### 1. Configuration Layer

**File**: `config_app_pymatrix/index.ts`

```typescript
export const PYMATRIX_CONFIG = {
  API_BASE_URL: 'http://localhost:8000',
  WS_BASE_URL: 'ws://localhost:8000',
  // ... video quality configs
}
```

**Status**: ⚠️ Defined but NOT USED in components

---

### 2. Component Layer

#### Props Chain

```
Page/Layout
  ↓ (baseUrl prop)
PyMatrixDeviceGrid (default: 'ws://localhost:8000')
  ↓ (baseUrl prop)
VideoPlayer (default: 'ws://localhost:8000')
  ↓ (passes to composables)
useVideoStream({ deviceSerial, baseUrl })
useDeviceControl({ deviceSerial, baseUrl })
```

**Key Findings**:
- Components accept `baseUrl` as optional prop
- Default value: `'ws://localhost:8000'` (hardcoded in each component)
- Config file exists but is NOT connected to components

---

### 3. Composables Layer

**Current Signature** (before my changes):
```typescript
useVideoStream({ deviceSerial, baseUrl })
useDeviceControl({ deviceSerial, baseUrl })
```

**My Changes** (BREAKING):
```typescript
// I removed baseUrl parameter
useVideoStream({ deviceSerial })
useDeviceControl({ deviceSerial })
```

**Problem**: This breaks existing component usage!

---

### 4. API Services Layer

**File**: `services/api/pymatrix/pymatrix-config-api.ts`

**Original**:
```typescript
const baseURL = config.public.pyMatrixAPI || 'http://localhost:8889';
```

**My Update**:
```typescript
import { buildApiUrl } from '@/utils_app_pymatrix/api-urls';
const url = buildApiUrl('/config');
```

**Status**: ✅ Updated successfully

---

## Architecture Decision

### Option 1: Keep Props Chain (Recommended)

**Pros**:
- No breaking changes
- Flexible (can override baseUrl per component)
- Works with existing code

**Cons**:
- Props drilling
- Hardcoded defaults in multiple places

**Implementation**:
```typescript
// utils_app_pymatrix/api-urls.ts
export function buildControlWsUrl(serial: string, baseUrl?: string): string {
  const url = baseUrl || PYMATRIX_CONFIG.WS_BASE_URL;
  return `${url}/ws/control/${serial}`;
}

// useDeviceControl.ts
export function useDeviceControl(options: UseDeviceControlOptions) {
  const wsUrl = buildControlWsUrl(options.deviceSerial, options.baseUrl);
  // ...
}
```

---

### Option 2: Full Centralization (Breaking Change)

**Pros**:
- True centralization
- No props drilling
- Single source of truth

**Cons**:
- Requires updating all components
- Breaking change

**Implementation**:
```typescript
// Remove baseUrl props from all components
// Use only PYMATRIX_CONFIG
```

---

## Recommended Solution

**Hybrid Approach**: Support both patterns

```typescript
// utils_app_pymatrix/api-urls.ts
import PYMATRIX_CONFIG from '@/config_app_pymatrix';

// Accept optional baseUrl, fallback to config
export function buildControlWsUrl(serial: string, baseUrl?: string): string {
  const base = baseUrl || PYMATRIX_CONFIG.WS_BASE_URL;
  return `${base}/ws/control/${serial}`;
}
```

```typescript
// useDeviceControl.ts
interface UseDeviceControlOptions {
  deviceSerial: string;
  baseUrl?: string; // Optional, for backward compatibility
}

export function useDeviceControl(options: UseDeviceControlOptions) {
  const wsUrl = buildControlWsUrl(options.deviceSerial, options.baseUrl);
  // ...
}
```

**Benefits**:
- ✅ Backward compatible
- ✅ Gradual migration path
- ✅ Components can still override
- ✅ Default uses centralized config

---

## Migration Path

1. ✅ Create utils with optional baseUrl parameter
2. ✅ Keep composables accepting optional baseUrl
3. ⚠️ Components keep working as-is
4. 🔄 Gradually remove baseUrl props (optional, future work)

---

## Conclusion

**Current State**:
- Localhost-based (frontend and backend on same machine)
- Props-based baseUrl passing
- Config exists but unused

**Target State**:
- Centralized URL construction
- Backward compatible with existing props
- Config-based defaults
- Easy to override when needed
