# WordFlow AI - Architecture Documentation

## System Centers Overview

WordFlow AI uses a centralized architecture with multiple specialized centers that manage different aspects of the application state and functionality.

## 1. StorageCenter (Persistent Storage)

**Location**: `services/StorageCenter.ts`

**Purpose**: Unified localStorage management with type safety

**Features**:
- JSON serialization/deserialization
- Type-safe key-value storage
- Specialized modules (auth, settings, language, cache)
- Error handling and logging

**Usage**:
```typescript
// Auth
StorageCenter.auth.setToken(token);
StorageCenter.auth.getUser();
StorageCenter.auth.clearAuth();

// Settings
StorageCenter.settings.get();
StorageCenter.settings.set(settings);

// Language
StorageCenter.language.setAppLanguage('zh');

// Cache with TTL
StorageCenter.cache.set(key, value, 3600000);
```

**Persistence**: ✅ Survives page refresh

---

## 2. StateManager (Runtime State)

**Location**: `services/StateManager.ts`

**Purpose**: In-memory reactive state management

**Features**:
- Simple pub-sub pattern
- Type-safe state access
- No external dependencies
- Listener subscriptions

**Predefined States**:
```typescript
GlobalState.USER                // Current user object
GlobalState.IS_LOGGED_IN        // Authentication status
GlobalState.CURRENT_PAGE        // Current page route
GlobalState.IS_LOADING          // Loading state
GlobalState.ERROR_MESSAGE       // Error messages
GlobalState.THEME               // UI theme
GlobalState.LANGUAGE            // App language
GlobalState.ACTIVE_GROUP_ID     // Selected word group
GlobalState.LEARNING_STATS      // Learning statistics
```

**Usage**:
```typescript
// Set state
StateManager.set(GlobalState.USER, userData);

// Get state
const user = StateManager.get(GlobalState.USER);

// Subscribe
const unsubscribe = StateManager.subscribe(GlobalState.USER, (user) => {
  console.log('User changed:', user);
});
```

**Persistence**: ❌ Cleared on page refresh

**Important**: StateManager must be rehydrated from StorageCenter on app initialization!

---

## 3. SettingsCenter

**Location**: `services/SettingsCenter.ts`

**Purpose**: Application settings management with auto-refresh

**Features**:
- Settings persistence (via StorageCenter)
- Change listeners
- Auto-refresh on critical changes (theme, language, font size)
- Theme application (CSS classes)
- Language application (document.lang)

**Settings Structure**:
```typescript
{
  language: {
    appInterface: 'zh',
    learningLanguage: 'en',
    nativeLanguage: 'zh'
  },
  display: {
    theme: 'auto',           // 'light' | 'dark' | 'auto'
    fontSize: 'medium',
    fontFamily: 'system',
    compactMode: false,
    showAnimations: true
  },
  audio: {
    autoPlay: true,
    playbackSpeed: 1.0,
    volume: 0.8,
    voice: 'default'
  },
  learning: {
    dailyGoal: 20,
    reviewInterval: 4,
    difficultyLevel: 'medium'
  }
}
```

**Usage**:
```typescript
// Initialize (loads from StorageCenter)
SettingsCenter.initialize();

// Update settings
SettingsCenter.update({
  display: { theme: 'dark' }
});

// Listen to changes
SettingsCenter.onChange((newSettings) => {
  console.log('Settings updated:', newSettings);
});
```

**Auto-Refresh Triggers**:
- Theme change → Apply CSS classes
- Language change → Update document.lang
- Font size change → Apply CSS classes

**Persistence**: ✅ Via StorageCenter

---

## 4. LanguageCenter

**Location**: `i18n/LanguageCenter.ts`

**Purpose**: Multi-language i18n management

**Features**:
- Language switching
- Translation key lookup
- Fallback to English
- Change subscriptions

**Usage**:
```typescript
// Set language
LanguageCenter.setLanguage('zh');

// Get translation
const text = LanguageCenter.t('home.welcome');

// Subscribe to changes
LanguageCenter.subscribe((lang) => {
  console.log('Language changed to:', lang);
});
```

**Supported Languages**: en, zh, ja, ko, es, fr, de

**Persistence**: ✅ Via StorageCenter.language

---

## 5. ApiManager

**Location**: `services/ApiManager.ts`

**Purpose**: Multi-API endpoint management and auto-detection

**Features**:
- Multiple API endpoint support
- Auto-detection with ping
- Fallback cascade
- Current endpoint tracking

**Usage**:
```typescript
// Initialize with auto-detect
await apiManager.initialize({ autoDetect: true, timeout: 1000 });

// Get current endpoint
const baseUrl = apiManager.getCurrentBaseUrl();

// Set endpoint manually
apiManager.setEndpoint('http://example.com:9000');
```

**Persistence**: ✅ Via StorageCenter (API_CURRENT_ENDPOINT)

---

## 6. UserModel

**Location**: `models/UserModel.ts`

**Purpose**: User data and business logic

**Features**:
- Current user management
- Profile operations
- Avatar handling
- Learning statistics

**Important Methods**:
```typescript
// Initialize from storage (MUST be called on app start)
UserModel.init();

// Get/Set user
UserModel.getCurrentUser();
UserModel.setCurrentUser(user);

// Check authentication
UserModel.isLoggedIn();

// Profile operations
await UserModel.loadProfile();
await UserModel.updateProfile(data);
await UserModel.uploadAvatar(file);
```

**Persistence**: ✅ Via StorageCenter.auth

---

## 7. AuthModel

**Location**: `models/AuthModel.ts`

**Purpose**: Authentication business logic

**Features**:
- Login/Register/Logout
- Session validation
- Token management
- Auto-login check

**Usage**:
```typescript
// Login
const result = await AuthModel.login({ username, password });

// Register
const result = await AuthModel.register(data);

// Validate session
const isValid = await AuthModel.validateSession();

// Initialize auth on app start
const hasAuth = await AuthModel.initializeAuth();

// Logout
await AuthModel.logout();
```

---

## Initialization Flow

The correct initialization order is critical:

```typescript
// AppContext.tsx useEffect
useEffect(() => {
  // 0. Initialize UserModel from storage FIRST
  UserModel.init();

  // 1. Initialize API Manager
  await apiManager.initialize({ autoDetect: true, timeout: 1000 });

  // 2. Initialize Settings Center
  const initialSettings = SettingsCenter.initialize();
  setSettings(initialSettings);

  // 3. Subscribe to settings changes
  const unsubscribe = SettingsCenter.onChange((newSettings) => {
    setSettings(newSettings);
  });

  // 4. Subscribe to language changes
  LanguageCenter.subscribe((lang) => {
    console.log('Language changed:', lang);
  });

  // 5. Load user and validate session
  const initAuth = async () => {
    const storedUser = StorageCenter.auth.getUser();
    const storedToken = StorageCenter.auth.getToken();

    if (storedUser && storedToken) {
      setUserState(storedUser);
      StateManager.set(GlobalState.USER, storedUser);
      StateManager.set(GlobalState.IS_LOGGED_IN, true);

      // Validate session
      const isValid = await AuthModel.validateSession();
      if (isValid) {
        setCurrentPage('home');
      } else {
        setUserState(null);
        setCurrentPage('login');
      }
    } else {
      setCurrentPage('login');
    }
  };

  initAuth();

  // Cleanup
  return () => {
    unsubscribeSettings();
    unsubscribeLang();
  };
}, []);
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│                    AppContext                        │
│  (React State + Lifecycle Management)                │
└──────────┬────────────────────────────────┬──────────┘
           │                                │
           ▼                                ▼
   ┌───────────────┐              ┌────────────────┐
   │  StateManager │              │ StorageCenter  │
   │  (Runtime)    │◄─────────────┤ (Persistent)   │
   └───────┬───────┘   Rehydrate  └────────┬───────┘
           │                                │
           │                                │
      ┌────┴────┬──────────┬───────────┬───┴────┐
      ▼         ▼          ▼           ▼        ▼
 ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
 │UserModel│ │Settings  │ │Language  │ │AuthModel │
 │         │ │Center    │ │Center    │ │          │
 └─────────┘ └──────────┘ └──────────┘ └──────────┘
      │            │            │            │
      └────────────┴────────────┴────────────┘
                   │
                   ▼
           ┌──────────────┐
           │  ApiCenter   │
           │  (API Calls) │
           └──────────────┘
                   │
                   ▼
           ┌──────────────┐
           │   Backend    │
           └──────────────┘
```

---

## Settings Changes and Refresh

When settings change, SettingsCenter automatically handles refresh:

### Immediate Application (No Refresh)
- Theme change → Apply CSS classes immediately
- Font size → Apply CSS classes immediately
- Language → Update document.lang immediately

### Events Triggered
```typescript
// Custom event dispatched
window.dispatchEvent(new CustomEvent('settings-changed', {
  detail: newSettings
}));
```

### Components React
- AppContext receives onChange callback
- React state updates
- Components re-render

**No `window.location.reload()` needed!**

---

## Common Pitfalls

### ❌ Problem: User logged out after page refresh

**Cause**: UserModel not initialized from storage

**Solution**:
```typescript
// In AppContext useEffect, BEFORE validateSession
UserModel.init();
```

### ❌ Problem: Settings not persisting

**Cause**: Direct state mutation without going through SettingsCenter

**Solution**:
```typescript
// ❌ Wrong
settings.theme = 'dark';

// ✅ Correct
SettingsCenter.update({ display: { theme: 'dark' } });
```

### ❌ Problem: Language change causes page refresh

**Cause**: Using `window.location.reload()` instead of SettingsCenter

**Solution**:
```typescript
// ❌ Wrong
updateSettings({ language: { appInterface: 'zh' } });
window.location.reload();

// ✅ Correct
updateSettings({ language: { appInterface: 'zh' } });
// SettingsCenter handles refresh automatically
```

---

## Testing Checklist

- [ ] Login → Refresh page → Still logged in
- [ ] Change theme → No refresh, theme applied
- [ ] Change language → No refresh, language applied
- [ ] Settings persist after refresh
- [ ] UserModel.init() called on app start
- [ ] StateManager rehydrated from StorageCenter
- [ ] API endpoint persists across refresh

---

## Summary

1. **StorageCenter**: Persistent localStorage (survives refresh)
2. **StateManager**: Runtime state (cleared on refresh)
3. **SettingsCenter**: Settings with auto-refresh (persisted via StorageCenter)
4. **LanguageCenter**: i18n management
5. **UserModel**: User data (MUST call init() on app start)
6. **AuthModel**: Authentication logic
7. **ApiManager**: Multi-API endpoint management

**Key Rule**: Always initialize UserModel from StorageCenter before validating session!
