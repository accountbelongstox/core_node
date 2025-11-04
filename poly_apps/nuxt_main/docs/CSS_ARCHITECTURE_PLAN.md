# PyMatrix CSS Architecture Plan

## Overview
Centralize all CSS from Vue components into a theme-based architecture following the principle: **Vue files contain ONLY logic, CSS lives in centralized theme files**.

## Current State
- **37 Vue files** with `<style scoped>` sections
- **~2,500-3,500 lines** of CSS scattered across components
- All components use isolated scoped styles

## Target Architecture

```
assets/
  css/
    theme/
      main-theme.css              # Core design system (global)
      variables.css               # CSS custom properties
      animations.css              # Global keyframe animations
      reset.css                   # CSS reset/normalize

    apps/
      pymatrix/
        pymatrix-theme.css        # PyMatrix main theme file (imports all)

        base/
          colors.css              # PyMatrix color palette
          typography.css          # Font styles
          layout.css              # Core layout structures

        components/
          buttons.css             # Button variants
          cards.css               # Card components
          panels.css              # Panel/dialog components
          forms.css               # Form elements
          badges.css              # Badge/indicator components
          tables.css              # Table styling
          modals.css              # Modal/dialog overlays
          dropdowns.css           # Dropdown menus
          tree.css                # Tree view components
          video.css               # Video player components

        layout/
          grid.css                # Device grid layout
          sidebar.css             # Left/right panels
          topbar.css              # Top navigation bar

        utilities/
          spacing.css             # Margin/padding utilities
          borders.css             # Border utilities
          shadows.css             # Box shadow utilities
          scrollbar.css           # Custom scrollbar styles
          states.css              # Hover/active/focus states

        themes/
          dark.css                # Dark mode overrides
          responsive.css          # Mobile/tablet breakpoints
```

## CSS Naming Convention (BEM + Namespace)

### Namespace Prefix
- Use `pm-` prefix for all PyMatrix-specific classes
- Example: `.pm-button`, `.pm-card`, `.pm-panel`

### BEM Structure
```css
/* Block */
.pm-device-card { }

/* Element */
.pm-device-card__header { }
.pm-device-card__body { }
.pm-device-card__footer { }

/* Modifier */
.pm-device-card--selected { }
.pm-device-card--error { }
```

## CSS Custom Properties (Variables)

### Color System
```css
:root {
  /* Primary Colors */
  --pm-primary-50: #eff6ff;
  --pm-primary-100: #dbeafe;
  --pm-primary-500: #3b82f6;
  --pm-primary-600: #2563eb;
  --pm-primary-700: #1d4ed8;

  /* Semantic Colors */
  --pm-color-success: #10b981;
  --pm-color-warning: #f59e0b;
  --pm-color-danger: #ef4444;
  --pm-color-info: #3b82f6;

  /* Neutral Colors */
  --pm-gray-50: #f9fafb;
  --pm-gray-100: #f3f4f6;
  --pm-gray-200: #e5e7eb;
  --pm-gray-300: #d1d5db;
  --pm-gray-600: #4b5563;
  --pm-gray-700: #374151;
  --pm-gray-800: #1f2937;
  --pm-gray-900: #111827;
}
```

### Spacing System
```css
:root {
  --pm-spacing-1: 0.25rem;  /* 4px */
  --pm-spacing-2: 0.5rem;   /* 8px */
  --pm-spacing-3: 0.75rem;  /* 12px */
  --pm-spacing-4: 1rem;     /* 16px */
  --pm-spacing-6: 1.5rem;   /* 24px */
  --pm-spacing-8: 2rem;     /* 32px */
}
```

### Typography System
```css
:root {
  --pm-font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --pm-font-mono: 'Courier New', monospace;

  --pm-text-xs: 0.75rem;    /* 12px */
  --pm-text-sm: 0.875rem;   /* 14px */
  --pm-text-base: 1rem;     /* 16px */
  --pm-text-lg: 1.125rem;   /* 18px */
  --pm-text-xl: 1.25rem;    /* 20px */
}
```

## Component Class Mapping

### Example: Converting DeviceFilterPanel.vue

**Before (Scoped CSS in Vue file):**
```vue
<template>
  <div class="device-filter-panel">
    <div class="filter-header">
      <h3 class="filter-title">Filters</h3>
    </div>
  </div>
</template>

<style scoped>
.device-filter-panel {
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
}
.filter-header {
  display: flex;
  align-items: center;
}
</style>
```

**After (Centralized CSS, logic-only Vue):**
```vue
<template>
  <div class="pm-filter-panel">
    <div class="pm-filter-panel__header">
      <h3 class="pm-filter-panel__title">Filters</h3>
    </div>
  </div>
</template>

<!-- NO STYLE SECTION -->
```

**CSS in assets/css/apps/pymatrix/components/panels.css:**
```css
/* Filter Panel Component */
.pm-filter-panel {
  display: flex;
  flex-direction: column;
  background-color: var(--pm-bg-primary);
  border: 1px solid var(--pm-border-color);
  border-radius: var(--pm-border-radius);
}

.pm-filter-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pm-filter-panel__title {
  font-size: var(--pm-text-lg);
  font-weight: 600;
  color: var(--pm-text-primary);
}
```

## Import Strategy

### Global Import (nuxt.config.ts)
```typescript
export default defineNuxtConfig({
  css: [
    '@/assets/css/theme/reset.css',
    '@/assets/css/theme/variables.css',
    '@/assets/css/theme/main-theme.css',
    '@/assets/css/theme/animations.css',
  ]
})
```

### App-Specific Import (app-entry.ts for PyMatrix)
```typescript
{
  name: 'pymatrix',
  css: [
    '@/assets/css/apps/pymatrix/pymatrix-theme.css',
  ]
}
```

### PyMatrix Theme Import Chain
**assets/css/apps/pymatrix/pymatrix-theme.css:**
```css
/* Base */
@import './base/colors.css';
@import './base/typography.css';
@import './base/layout.css';

/* Components */
@import './components/buttons.css';
@import './components/cards.css';
@import './components/panels.css';
@import './components/forms.css';
@import './components/badges.css';
@import './components/modals.css';
@import './components/tree.css';
@import './components/video.css';

/* Layout */
@import './layout/grid.css';
@import './layout/sidebar.css';
@import './layout/topbar.css';

/* Utilities */
@import './utilities/spacing.css';
@import './utilities/borders.css';
@import './utilities/states.css';
@import './utilities/scrollbar.css';

/* Themes */
@import './themes/dark.css';
@import './themes/responsive.css';
```

## Migration Steps

### Phase 1: Setup Base Structure
1. Create directory structure
2. Create variables.css with CSS custom properties
3. Create animations.css with keyframe definitions
4. Create main-theme.css with global styles

### Phase 2: Extract Component Styles (Priority Order)
1. **Buttons** (BaseButton variants used everywhere)
2. **Panels/Cards** (BasePanel, device cards, preset cards)
3. **Forms** (inputs, textareas, selects)
4. **Layout** (grid, sidebars, topbar)
5. **Badges/Indicators** (tags, status dots)
6. **Modals/Dialogs** (connect dialog, settings)
7. **Tree Views** (group tree)
8. **Video Components** (video player, controls)
9. **Utilities** (spacing, states, scrollbar)

### Phase 3: Update Vue Components
1. Remove `<style>` sections
2. Update class names to BEM convention
3. Replace hardcoded colors with CSS variables
4. Test component functionality

### Phase 4: Verify & Clean
1. Ensure all Vue files have NO `<style>` sections
2. Verify all components render correctly
3. Test dark mode
4. Test responsive breakpoints
5. Remove any unused CSS

## Benefits

1. **Maintainability**: Centralized CSS easier to update and debug
2. **Consistency**: Enforced design system through variables
3. **Performance**: No duplicate CSS, better caching
4. **Scalability**: Easy to extend with new themes
5. **Separation of Concerns**: Logic and styles completely separated
6. **Debugging**: Easier to find and fix styling issues
7. **Theme Support**: Easy to implement light/dark themes

## Validation Checklist

- [ ] All 37 Vue files have `<style>` sections removed
- [ ] All extracted CSS uses BEM naming with `pm-` prefix
- [ ] All colors use CSS custom properties
- [ ] All spacing uses CSS custom properties
- [ ] Dark mode works correctly
- [ ] Responsive breakpoints work
- [ ] No visual regressions
- [ ] Development server runs without errors
- [ ] Build process completes successfully
