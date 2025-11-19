# Global Configuration System

## Overview

This global configuration system provides centralized management for:
- Theme modes (light/dark/system)
- Multi-language support (16 languages)
- Layout preferences
- Direction (LTR/RTL)
- Persistent storage with localStorage

## Architecture

```
common/
├── stores/
│   └── app-config-store.ts          # Global configuration state
├── composables/
│   ├── useGlobalConfig.ts           # Configuration composable
│   └── useI18nConfig.ts             # Multi-language composable
├── utils/
│   └── localStorage.ts              # localStorage manager
├── plugins/
│   └── app-config.client.ts         # Auto-initialization plugin
└── components/
    └── ui/
        └── GlobalConfigPanel.vue    # Configuration UI component
```

## Features

### 1. Theme Management
- **Light Mode**: Default bright theme
- **Dark Mode**: Dark theme for low-light environments
- **System**: Follows OS theme preference
- Auto-applies theme to DOM
- Persists user preference

### 2. Multi-Language Support
Supported languages:
- English (en)
- Chinese (zh)
- Japanese (ja)
- Persian/Farsi (fa) - NEW!
- Spanish (es)
- French (fr)
- German (de)
- Russian (ru)
- Portuguese (pt)
- Italian (it)
- Polish (pl)
- Turkish (tr)
- Swedish (sv)
- Hungarian (hu)
- Danish (da)
- Greek (el)

### 3. RTL/LTR Support
- Auto-detects RTL languages (Persian, Arabic, etc.)
- Applies direction to entire application
- Persists direction preference

### 4. Persistent Storage
- All settings saved to localStorage
- Auto-restore on app load
- Namespaced keys to avoid conflicts

## Usage Examples

### Basic Usage in Components

```vue
<script setup lang="ts">
import { useGlobalConfig } from '@/common/composables/useGlobalConfig';
import { useI18nConfig } from '@/common/composables/useI18nConfig';

// Theme management
const { theme, isDarkMode, toggleTheme, setTheme } = useGlobalConfig();

// Language management
const { currentLanguage, availableLanguages, changeLanguage } = useI18nConfig();

// Change theme
const switchTheme = () => {
  setTheme('dark'); // or 'light', 'system'
};

// Toggle between light and dark
const toggle = () => {
  toggleTheme();
};

// Change language
const switchLanguage = () => {
  changeLanguage('zh'); // Switch to Chinese
};
</script>

<template>
  <div>
    <p>Current Theme: {{ theme }}</p>
    <p>Is Dark: {{ isDarkMode }}</p>
    <p>Language: {{ currentLanguage.nativeName }}</p>

    <button @click="toggle">Toggle Theme</button>
    <button @click="switchLanguage">Switch to Chinese</button>
  </div>
</template>
```

### Using the Configuration Panel

```vue
<script setup lang="ts">
import GlobalConfigPanel from '@/common/components/ui/GlobalConfigPanel.vue';
</script>

<template>
  <div>
    <GlobalConfigPanel />
  </div>
</template>
```

### Direct Store Access

```typescript
import { useAppConfigStore } from '@/common/stores/app-config-store';

const configStore = useAppConfigStore();

// Read configuration
console.log(configStore.config);
console.log(configStore.isDarkMode);
console.log(configStore.currentLocale);

// Update configuration
configStore.setTheme('dark');
configStore.setLocale('ja');
configStore.setLayout('boxed-layout');
configStore.setRTL('rtl');

// Batch update
configStore.updateConfig({
  theme: 'dark',
  locale: 'zh',
  layout: 'full'
});

// Reset to defaults
configStore.resetToDefaults();
```

### Using localStorage Manager

```typescript
import { LocalStorageManager } from '@/common/utils/localStorage';

// Set item
LocalStorageManager.setItem('user_preferences', {
  notifications: true,
  sound: false
});

// Get item
const prefs = LocalStorageManager.getItem('user_preferences');

// Get with default value
const theme = LocalStorageManager.getItem('theme', 'light');

// Check if item exists
if (LocalStorageManager.hasItem('user_preferences')) {
  // ...
}

// Remove item
LocalStorageManager.removeItem('user_preferences');

// Clear all app items
LocalStorageManager.clear();

// Get all keys
const keys = LocalStorageManager.getAllKeys();
```

### Custom Prefix

```typescript
import { LocalStorageManager } from '@/common/utils/localStorage';

// Change prefix for specific app namespace
LocalStorageManager.setPrefix('pymatrix_');

// Now all keys will be prefixed with 'pymatrix_'
LocalStorageManager.setItem('config', { ... }); // Stored as 'pymatrix_config'
```

## Type Definitions

```typescript
// Theme mode types
type ThemeMode = 'light' | 'dark' | 'system';

// Language codes
type LanguageCode = 'en' | 'zh' | 'ja' | 'fa' | 'es' | 'fr' | 'de' | 'ru' | 'pt' | 'it' | 'pl' | 'tr' | 'sv' | 'hu' | 'da' | 'el';

// Menu types
type MenuType = 'vertical' | 'collapsible-vertical' | 'horizontal';

// Layout types
type LayoutType = 'full' | 'boxed-layout';

// Direction types
type DirectionType = 'rtl' | 'ltr';

// Navbar types
type NavbarType = 'navbar-sticky' | 'navbar-floating' | 'navbar-static';

// Configuration state
interface AppConfigState {
  theme: ThemeMode;
  locale: LanguageCode;
  menu: MenuType;
  layout: LayoutType;
  rtlClass: DirectionType;
  animation: string;
  navbar: NavbarType;
  semidark: boolean;
}

// Language option
interface LanguageOption {
  code: LanguageCode;
  name: string;
  nativeName: string;
  flag: string;
  rtl?: boolean;
}
```

## Composables API Reference

### useGlobalConfig()

```typescript
const {
  theme,           // Ref<ThemeMode> - Current theme
  locale,          // Ref<LanguageCode> - Current locale
  isDarkMode,      // ComputedRef<boolean> - Is dark mode active
  isRTL,           // ComputedRef<boolean> - Is RTL active
  config,          // ComputedRef<AppConfigState> - Full config

  setTheme,        // (theme: ThemeMode) => void
  setLocale,       // (locale: LanguageCode) => void
  setMenu,         // (menu: MenuType) => void
  setLayout,       // (layout: LayoutType) => void
  setRTL,          // (rtl: DirectionType) => void
  setNavbar,       // (navbar: NavbarType) => void
  setSemidark,     // (semidark: boolean) => void
  setAnimation,    // (animation: string) => void

  toggleTheme,     // () => void - Toggle light/dark
  toggleRTL,       // () => void - Toggle LTR/RTL
  resetToDefaults, // () => void - Reset all settings
  initialize,      // () => void - Load from storage
} = useGlobalConfig();
```

### useI18nConfig()

```typescript
const {
  currentLanguage,     // ComputedRef<LanguageOption> - Current language info
  availableLanguages,  // ComputedRef<LanguageOption[]> - All languages
  changeLanguage,      // (code: LanguageCode) => void - Change language
  getLanguageByCode,   // (code: LanguageCode) => LanguageOption | undefined
  isRTLLanguage,       // (code: LanguageCode) => boolean
  t,                   // (key: string) => string - Translation function
} = useI18nConfig();
```

## Extending Language Files

To add translations to existing language files:

1. Add keys to `i18n/locales/{locale}.json`
2. Use the same key structure across all languages
3. For new languages, create a new file following existing format

Example translation keys:
```json
{
  "settings": "Settings",
  "theme": "Theme",
  "light": "Light",
  "dark": "Dark",
  "language": "Language",
  "save": "Save",
  "cancel": "Cancel"
}
```

## Error Correction

### Previous Issue
The base-store.ts had theme management mixed with user authentication, which violated single responsibility principle.

### Solution
- Created dedicated `app-config-store.ts` for global configuration
- Separated concerns: authentication in base-store, configuration in app-config-store
- Used localStorage for persistence instead of mixing with Pinia state
- Made configuration accessible globally through composables

## Best Practices

1. **Always use composables** instead of direct store access in components
2. **Initialize early** - The plugin auto-initializes on app load
3. **Watch for changes** - The store automatically syncs to DOM
4. **Namespace storage keys** - Use LocalStorageManager's prefix feature
5. **Type safety** - Use provided TypeScript types for all configuration values

## Migration Guide

If you have existing theme/locale code:

```typescript
// OLD - Direct DOM manipulation
document.documentElement.classList.add('dark');
localStorage.setItem('theme', 'dark');

// NEW - Use global config
const { setTheme } = useGlobalConfig();
setTheme('dark');
```

```typescript
// OLD - Direct i18n access
import { useI18n } from 'vue-i18n';
const { locale } = useI18n();
locale.value = 'zh';

// NEW - Use i18n config
const { changeLanguage } = useI18nConfig();
changeLanguage('zh');
```

## Troubleshooting

### Theme not persisting
- Check if plugin is loaded: `common/plugins/app-config.client.ts`
- Verify localStorage permissions
- Check browser console for errors

### Language not changing
- Ensure i18n module is installed: `@nuxtjs/i18n`
- Verify language file exists in `i18n/locales/`
- Check if locale code matches supported languages

### RTL not working
- Verify CSS supports RTL (use logical properties)
- Check if HTML dir attribute is set
- Ensure theme CSS includes RTL styles

## Performance

- Configuration loads once on app initialization
- Changes are batched and debounced
- localStorage operations are minimal
- DOM updates are reactive and efficient

## Security

- All user input is validated against allowed types
- localStorage keys are namespaced to prevent conflicts
- No sensitive data stored in localStorage
- XSS protection through Vue's template system
