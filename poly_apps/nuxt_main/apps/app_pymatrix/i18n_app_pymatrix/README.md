# PyMatrix i18n Configuration

This directory contains PyMatrix-specific internationalization (i18n) files.

## Structure

```
i18n_app_pymatrix/
└── locales/
    ├── en.json          # English translations
    ├── zh.json          # Chinese translations
    ├── ja.json          # Japanese translations
    └── fa.json          # Persian/Farsi translations
```

## Translation Keys

### Device Management
- `device`, `devices` - Device related labels
- `connect`, `disconnect` - Connection actions
- `connected`, `disconnected`, `connecting` - Connection states
- `connection_failed`, `connection_lost` - Connection errors

### Screen Features
- `screen_mirroring` - Screen mirroring functionality
- `screen_control` - Screen control features
- `screen_recording` - Recording features
- `screen_capture` - Screenshot functionality

### Group Control
- `group_control`, `group_management` - Group features
- `create_group`, `delete_group` - Group actions
- `add_to_group`, `remove_from_group` - Member management

### Batch Operations
- `batch_operations` - Batch operations label
- `batch_connect`, `batch_disconnect` - Batch connection
- `batch_install`, `batch_uninstall` - Batch app management

### Recording
- `recording_start`, `recording_stop` - Recording controls
- `recording_pause`, `recording_resume` - Recording states
- `recording_save` - Save recording

### File Transfer
- `file_transfer` - File transfer feature
- `file_push`, `file_pull` - File operations
- `apk_install`, `apk_uninstall` - APK management

### Device Information
- `device_info` - Device information panel
- `device_model`, `device_brand`, `device_version` - Device details
- `device_resolution`, `device_battery` - Device specs

### Video/Audio
- `video_quality`, `video_bitrate`, `video_fps`, `video_codec` - Video settings
- `audio_streaming`, `audio_enable`, `audio_disable`, `audio_volume` - Audio settings

### Controls
- `keyboard_control`, `mouse_control` - Input controls
- `touch_control`, `gamepad_control` - Touch and gamepad
- `clipboard_sync`, `clipboard_copy`, `clipboard_paste` - Clipboard

### UI States
- `no_devices` - Empty state
- `select_device` - Selection prompt
- `device_search`, `device_filter` - Search and filter

### Presets
- `connection_history` - Connection history
- `connection_presets` - Saved presets
- `save_preset`, `load_preset` - Preset management

## Usage in Components

### Basic Usage

```vue
<script setup>
import { useAppI18n } from '@/composables/useAppI18n'

const { t } = useAppI18n()
</script>

<template>
  <div>
    <h1>{{ t('screen_mirroring') }}</h1>
    <button>{{ t('connect') }}</button>
    <button>{{ t('disconnect') }}</button>
  </div>
</template>
```

### With Global Translations

```vue
<script setup>
import { useAppI18n } from '@/composables/useAppI18n'

const { t } = useAppI18n()
</script>

<template>
  <div>
    <!-- App-specific translation -->
    <h1>{{ t('device_info') }}</h1>

    <!-- Global translation (from i18n/locales) -->
    <button>{{ t('save') }}</button>
    <button>{{ t('cancel') }}</button>
  </div>
</template>
```

## Adding New Translations

1. Add the key to all language files (en, zh, ja, fa)
2. Follow the naming convention: `{feature}_{action}`
3. Use snake_case for keys
4. Keep translations concise and clear

Example:
```json
{
  "new_feature_action": "New Feature Action"
}
```

## Language Support

Currently supported languages:
- **en** - English (Primary)
- **zh** - Chinese (Simplified)
- **ja** - Japanese
- **fa** - Persian/Farsi (RTL)

## Best Practices

1. ✅ Use app-specific keys only (don't duplicate global keys)
2. ✅ Keep keys descriptive and following naming pattern
3. ✅ Maintain consistency across all language files
4. ✅ Test RTL languages (fa) for layout issues
5. ❌ Don't reference other app's translation keys
6. ❌ Don't put common translations here (use global i18n)

## Merging with Global Translations

PyMatrix translations are automatically merged with global translations:

**Global (`i18n/locales/en.json`):**
```json
{
  "save": "Save",
  "cancel": "Cancel",
  "settings": "Settings"
}
```

**PyMatrix (`i18n_app_pymatrix/locales/en.json`):**
```json
{
  "device": "Device",
  "connect": "Connect"
}
```

**Runtime (Merged):**
```json
{
  "save": "Save",      // From global
  "cancel": "Cancel",  // From global
  "settings": "Settings", // From global
  "device": "Device",  // From PyMatrix
  "connect": "Connect" // From PyMatrix
}
```

## Testing Translations

```bash
# Switch to PyMatrix app
node scripts/switch-app-entry.js pymatrix

# Start dev server
yarn dev:pymatrix

# Change language in UI to test all translations
```

## Architecture Reference

See full architecture documentation:
`development-guides/NUXT_MULTI_APP_NAMESPACE_ARCHITECTURE.md`

Section: **7. i18n Namespace System**
