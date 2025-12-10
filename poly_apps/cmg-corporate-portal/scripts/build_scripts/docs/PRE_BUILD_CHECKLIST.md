# Pre-Build Checklist for Android/Capacitor Application

**Date:** 2025-12-11
**Target:** Capacitor 8.0.0 with Android SDK 36
**Purpose:** This checklist ensures all frontend code is properly configured before building the Android application.

---

## Critical Frontend Configurations Required

### 1. Status Bar Configuration (Android Safe Area)

#### 1.1 Install StatusBar Plugin
```bash
pnpm add @capacitor/status-bar
```

#### 1.2 App.tsx - StatusBar Initialization
Add the following imports and initialization code:

```typescript
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

// In your main App component or useEffect:
useEffect(() => {
  if (Capacitor.getPlatform() !== 'web') {
    // Set status bar style based on theme
    StatusBar.setStyle({ style: Style.Light }); // or Style.Dark

    // Optional: Set background color
    StatusBar.setBackgroundColor({ color: '#ffffff' });

    // Optional: Show/hide status bar
    StatusBar.show();
  }
}, []);

// Update StatusBar when theme changes
useEffect(() => {
  if (Capacitor.getPlatform() !== 'web') {
    StatusBar.setStyle({
      style: isDarkMode ? Style.Dark : Style.Light
    });
  }
}, [isDarkMode]);
```

#### 1.3 index.html - Meta Viewport Configuration
Ensure your `index.html` has proper viewport configuration:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```

The `viewport-fit=cover` is **critical** for safe area support on devices with notches.

#### 1.4 CSS - Safe Area Insets (Tailwind Configuration)

If using **Tailwind CSS**, add to `tailwind.config.js`:

```javascript
module.exports = {
  theme: {
    extend: {
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      padding: {
        'safe-top': 'max(env(safe-area-inset-top), 24px)',
        'safe-bottom': 'max(env(safe-area-inset-bottom), 16px)',
      }
    }
  }
}
```

Then use in your components:
```tsx
<div className="pt-safe-top">
  {/* Your content - will have safe padding at top */}
</div>
```

If using **plain CSS**, add to your global styles:

```css
:root {
  --safe-area-inset-top: env(safe-area-inset-top, 0px);
  --safe-area-inset-bottom: env(safe-area-inset-bottom, 0px);
  --safe-area-inset-left: env(safe-area-inset-left, 0px);
  --safe-area-inset-right: env(safe-area-inset-right, 0px);
}

.header {
  padding-top: max(var(--safe-area-inset-top), 24px);
}

.main-content {
  padding-top: calc(var(--safe-area-inset-top) + 60px); /* header height + safe area */
}
```

#### 1.5 Header Component - Flexible Height

Change fixed height headers to use `min-height`:

**Before (Wrong):**
```tsx
<header className="h-[60px] ...">
```

**After (Correct):**
```tsx
<header className="min-h-[60px] pt-safe-top ...">
```

#### 1.6 Main Content - Adjusted Padding

Adjust main content padding to account for header + safe area:

```tsx
<main
  className="..."
  style={{
    paddingTop: 'calc(env(safe-area-inset-top, 0px) + 60px)'
  }}
>
```

Or using CSS variable:
```css
.main-content {
  padding-top: calc(var(--safe-area-inset-top, 0px) + 60px);
}
```

---

### 2. Capacitor Configuration

#### 2.1 capacitor.config.ts - Basic Configuration

Ensure your `capacitor.config.ts` includes:

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'YOUR.PACKAGE.ID', // e.g., 'com.ddsj.cmg.club'
  appName: 'Your App Name',
  webDir: 'dist', // or 'build' depending on your framework
  server: {
    androidScheme: 'https'
  },
  plugins: {
    StatusBar: {
      style: 'Light', // or 'Dark'
      backgroundColor: '#ffffff',
      overlaysWebView: false // IMPORTANT: Set to false for Android 16+
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#ffffff',
      showSpinner: false
    }
  }
};

export default config;
```

**Important Notes:**
- `overlaysWebView: false` is critical for Android 16+ (edge-to-edge enforcement)
- `androidScheme: 'https'` prevents mixed content issues

#### 2.2 Android Specific Configuration

The build script will automatically ensure:
- `android:fitsSystemWindows="true"` in AndroidManifest.xml
- `density` in `configChanges`
- Proper SDK versions (compileSdk 36, targetSdk 36, minSdk 24)

---

### 3. Build Output Configuration

#### 3.1 Verify Build Output Directory

Check your build tool configuration:

**Vite (vite.config.ts):**
```typescript
export default defineConfig({
  build: {
    outDir: 'dist', // Must match capacitor.config.ts webDir
  }
})
```

**Create React App (package.json):**
```json
{
  "homepage": ".",
  "build": {
    "outDir": "build"
  }
}
```

**Next.js (next.config.js):**
```javascript
module.exports = {
  output: 'export',
  distDir: 'dist'
}
```

#### 3.2 Asset Path Configuration

Ensure all assets use relative paths:
```typescript
// Good
<img src="./assets/logo.png" />

// Bad - will fail in Capacitor
<img src="/assets/logo.png" />
```

---

### 4. Package.json Scripts

#### 4.1 Recommended Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "dev": "vite", // or your dev server
    "build": "vite build",
    "build:android": "npm run build && npx cap sync android",
    "android:open": "npx cap open android",
    "android:run": "npx cap run android"
  }
}
```

---

### 5. Resource Files

#### 5.1 Required Assets

Place these files in your `assets/` directory:
- **logo.png** - App icon (minimum 1024x1024px, PNG format)
- **splash.png** - Splash screen (minimum 2732x2732px, PNG format)

Or configure custom paths in `build_config.ini`:
```ini
[app_info]
app_logo_src = custom_icon.png
splash_src = custom_splash.png
```

#### 5.2 Icon Guidelines
- **Size:** Minimum 1024x1024px (recommended: 2048x2048px)
- **Format:** PNG with transparency
- **Safe zone:** Keep important content within center 80% (avoid edges)

---

### 6. Permission Handling (If Needed)

#### 6.1 Camera/Geolocation Permissions

If your app uses camera, location, or other sensitive permissions:

Install required plugins:
```bash
pnpm add @capacitor/camera
pnpm add @capacitor/geolocation
```

Request permissions in code:
```typescript
import { Camera } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';

// Camera permission
const photo = await Camera.getPhoto({
  resultType: CameraResultType.Uri,
  source: CameraSource.Camera,
  quality: 90
});

// Location permission
const position = await Geolocation.getCurrentPosition();
```

The build script will automatically add required permissions to AndroidManifest.xml during `capacitor-assets` generation.

---

### 7. Testing Checklist Before Build

#### 7.1 Web Build Test
```bash
pnpm run build
```
**Verify:** No build errors, `dist/` (or `build/`) folder created

#### 7.2 Development Server Test
```bash
pnpm run dev
```
**Verify:** App runs correctly in browser

#### 7.3 StatusBar Plugin Test (in code)
```typescript
// Add temporary test code
useEffect(() => {
  console.log('Capacitor Platform:', Capacitor.getPlatform());
  console.log('StatusBar available:', Capacitor.isPluginAvailable('StatusBar'));
}, []);
```

---

### 8. Common Issues and Solutions

#### 8.1 White Screen on Android
**Cause:** Incorrect `webDir` in `capacitor.config.ts`
**Solution:** Ensure `webDir` matches your build output folder

#### 8.2 Status Bar Overlapping Content
**Cause:** Missing safe area insets
**Solution:** Add `pt-safe-top` to header, verify `viewport-fit=cover`

#### 8.3 Mixed Content Errors
**Cause:** HTTP requests in HTTPS context
**Solution:** Add `androidScheme: 'https'` to capacitor.config.ts

#### 8.4 Assets Not Loading
**Cause:** Absolute paths in code
**Solution:** Change `/assets/...` to `./assets/...`

#### 8.5 Build Script Cannot Find Resources
**Cause:** Missing logo.png or splash.png
**Solution:** Place files in `assets/` or configure paths in `build_config.ini`

---

### 9. Pre-Build Command Checklist

Run these commands **before** executing the build script:

```bash
# 1. Install dependencies
pnpm install

# 2. Install Capacitor and StatusBar plugin
pnpm add @capacitor/core @capacitor/cli @capacitor/android @capacitor/status-bar

# 3. Build web assets
pnpm run build

# 4. Verify build output exists
ls dist/  # or build/ depending on your config
```

---

### 10. Build Script Execution

#### 10.1 Windows
```powershell
.\poly_apps\cmg-corporate-portal\scripts\start.ps1
```

#### 10.2 Linux/Mac
```bash
./poly_apps/cmg-corporate-portal/scripts/start.sh
```

#### 10.3 Build Options
1. **Install Capacitor** (first time only)
2. **Build for Android** (every build)

---

## Summary - Must-Have Changes

✅ **Required:**
1. Install `@capacitor/status-bar` plugin
2. Add StatusBar initialization in App.tsx
3. Add `viewport-fit=cover` to index.html
4. Configure safe area insets (CSS or Tailwind)
5. Change header from `h-[60px]` to `min-h-[60px] pt-safe-top`
6. Adjust main content padding: `calc(env(safe-area-inset-top) + 60px)`
7. Set `overlaysWebView: false` in capacitor.config.ts
8. Verify `webDir` matches build output
9. Place logo.png and splash.png in assets/
10. Run `pnpm run build` before build script

✅ **Recommended:**
- Add dark mode StatusBar style switching
- Configure SplashScreen plugin
- Use relative paths for all assets
- Add build scripts to package.json

---

## Reference Links

- [Capacitor 8 Migration Guide](https://capacitorjs.com/docs/updating/8-0)
- [StatusBar Plugin API](https://capacitorjs.com/docs/apis/status-bar)
- [Android Configuration](https://capacitorjs.com/docs/android/configuration)
- [Safe Area Insets Guide](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)

---

**Last Updated:** 2025-12-11
**Build System Version:** Capacitor 8.0.0 + AGP 8.13.0 + Gradle 8.14.3
