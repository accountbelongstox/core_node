# Flutter Bloom Common Library

Centralized components and services for Flutter Bloom multi-app architecture.

## Features

### 🌍 Internationalization (i18n)
- **Multi-language support**: Chinese (zh_CN) and English (en_US)
- **Reactive updates**: Changes language instantly across the entire app
- **Easy translation**: Use `.tr` extension for any string
- **Parameter interpolation**: Support dynamic values in translations

**Usage:**
```dart
import 'package:flutter_bloom/common/i18n/i18n_service.dart';

// Direct translation
final text = 'app.name'.tr;

// With parameters
final message = 'greeting'.trParams({'name': 'John'});

// Change language
await I18nService().changeLanguage('en');
```

### 🎨 Theme System
- **Pre-defined color schemes**: Primary green palette
- **Gradient support**: Beautiful gradient backgrounds
- **Light/Dark themes**: Automatic theme switching
- **Material 3**: Latest Material Design components
- **Consistent styling**: Unified button, input, and card styles

**Usage:**
```dart
import 'package:flutter_bloom/common/theme/app_theme.dart';

// Use in MaterialApp
theme: AppTheme.lightTheme,
darkTheme: AppTheme.darkTheme,

// Access colors
color: AppTheme.primaryGreen,
gradient: AppTheme.primaryGradient,
```

### 🎯 Custom Widgets

#### GradientButton
Beautiful gradient button with icon support and shadow effects.

```dart
GradientButton(
  text: 'Login',
  icon: Icon(Icons.login),
  gradient: AppTheme.primaryGradient,
  onPressed: () {},
)
```

#### GlassmorphismCard
Modern glassmorphism effect with blur and transparency.

```dart
GlassmorphismCard(
  borderRadius: 20,
  blur: 10,
  opacity: 0.2,
  child: YourContent(),
)
```

### ⚙️ Settings Service
- **Persistent storage**: Uses SharedPreferences
- **Reactive updates**: Notifies listeners on changes
- **Theme control**: Light/Dark mode switching
- **Language management**: Change language dynamically
- **Custom settings**: Store any app-specific settings

**Usage:**
```dart
final settings = SettingsService();

// Initialize
await settings.initialize();

// Change settings
await settings.setLanguage('en');
await settings.toggleDarkMode();
await settings.setNotificationsEnabled(true);

// Access settings
final lang = settings.language;
final isDark = settings.isDarkMode;

// Listen to changes
Consumer<SettingsService>(
  builder: (context, settings, child) {
    return YourWidget();
  },
)
```

### 🔐 Authentication (auth_v2)
Complete authentication system with multiple providers.

See `auth_v2/README.md` for detailed documentation.

## Architecture

```
lib/common/
├── i18n/
│   ├── i18n_service.dart       # Translation service
│   └── translations.dart       # Language strings
├── theme/
│   └── app_theme.dart         # Theme definitions
├── widgets/
│   ├── gradient_button.dart    # Gradient button widget
│   └── glassmorphism_card.dart # Glass effect card
├── services/
│   └── settings_service.dart   # Settings management
├── auth_v2/                    # Authentication system
└── common.dart                 # Export file
```

## Integration with App

### Step 1: Initialize in main()

```dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize services
  await SettingsService().initialize();

  runApp(const MyApp());
}
```

### Step 2: Setup Providers

```dart
return MultiProvider(
  providers: [
    ChangeNotifierProvider.value(value: I18nService()),
    ChangeNotifierProvider.value(value: SettingsService()),
    // Your app providers
  ],
  child: Consumer2<I18nService, SettingsService>(
    builder: (context, i18n, settings, child) {
      return MaterialApp(
        locale: i18n.currentLocale,
        theme: AppTheme.lightTheme,
        darkTheme: AppTheme.darkTheme,
        themeMode: settings.themeMode,
        home: HomeScreen(),
      );
    },
  ),
);
```

### Step 3: Use in Widgets

```dart
// Translation
Text('auth.login'.tr)

// Theme colors
color: AppTheme.primaryGreen

// Widgets
GradientButton(text: 'Submit', onPressed: () {})

// Settings
final settings = context.watch<SettingsService>();
if (settings.isDarkMode) { ... }
```

## Best Practices

### ✅ DO
- Use centralized i18n for all user-facing strings
- Use `AppTheme` constants for colors and gradients
- Utilize reactive providers for state management
- Keep translations organized and consistent
- Test with different languages and themes

### ❌ DON'T
- Hard-code strings in widgets
- Define colors directly in widgets
- Create custom buttons when `GradientButton` suffices
- Bypass `SettingsService` for app settings
- Store sensitive data in `SettingsService`

## Adding New Features

### Add New Language
1. Add translations to `translations.dart`
2. Update `supportedLocales` in `i18n_service.dart`
3. Test all screens with new language

### Add New Theme
1. Define colors in `app_theme.dart`
2. Create theme data in `lightTheme`/`darkTheme`
3. Update widgets to use theme colors

### Add New Widget
1. Create widget in `lib/common/widgets/`
2. Follow Material Design guidelines
3. Make it reusable and customizable
4. Export in `common.dart`

## Dependencies

```yaml
dependencies:
  flutter:
    sdk: flutter
  provider: ^6.0.5
  shared_preferences: ^2.2.0
  equatable: ^2.0.5
```

## Performance Considerations

- **i18n**: Translations are cached in memory
- **Settings**: SharedPreferences is async and cached
- **Theme**: Theme switching is instant with no rebuild lag
- **Widgets**: Use `const` constructors where possible

## Troubleshooting

### Translations not updating
- Ensure `I18nService` is provided via `ChangeNotifierProvider`
- Check that widget is wrapped in `Consumer` or using `context.watch()`

### Theme not switching
- Verify `SettingsService` is initialized in `main()`
- Ensure `themeMode` is bound to `MaterialApp`

### Settings not persisting
- Check `SharedPreferences` permissions
- Verify `initialize()` is called before use
- Ensure async operations complete

## License

Part of Flutter Bloom framework. See main LICENSE file.