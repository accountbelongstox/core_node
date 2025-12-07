# Resources Module - Multi-language Support

This module provides multi-language (i18n) support for the application using Kotlin Multiplatform Compose Resources.

## Overview

Based on [Kotlin Multiplatform Compose Resources localization](https://kotlinlang.org/docs/multiplatform/compose-localize-strings.html), this module manages all string resources and translations for the application.

## Supported Languages

- **English (en)** - Default language
- **简体中文 (zh-CN)** - Simplified Chinese
- **繁體中文 (zh-TW)** - Traditional Chinese (planned)
- **Português (pt-BR)** - Portuguese (Brazil)

## Directory Structure

```
resources/src/commonMain/composeResources/
├── values/              # Default (English)
│   ├── strings.xml
│   └── plurals.xml
├── values-zh-rCN/       # Simplified Chinese
│   ├── strings.xml
│   └── plurals.xml
├── values-pt-rBR/       # Portuguese (Brazil)
│   ├── strings.xml
│   └── plurals.xml
└── files/
    └── aboutlibraries.json
```

## Usage

### 1. Accessing String Resources

In your Compose code, use `stringResource()` to access localized strings:

```kotlin
import org.jetbrains.compose.resources.stringResource
import com.escodro.resources.Res

@Composable
fun MyScreen() {
    Text(stringResource(Res.string.home_title_tasks))
}
```

### 2. String Resources with Parameters

For strings with placeholders, use `stringResource()` with arguments:

```kotlin
// In strings.xml:
// <string name="welcome_message">Welcome, %s!</string>

Text(
    stringResource(
        Res.string.welcome_message,
        "User"
    )
)
```

### 3. Plural Resources

For plural forms, use `pluralStringResource()`:

```kotlin
import org.jetbrains.compose.resources.pluralStringResource

Text(
    pluralStringResource(
        Res.plurals.tracker_message_title,
        count = taskCount,
        taskCount
    )
)
```

### 4. Adding New Strings

1. Add the string to `values/strings.xml` (default/English):
```xml
<string name="my_new_string">My New String</string>
```

2. Add translations to other language files:
```xml
<!-- values-zh-rCN/strings.xml -->
<string name="my_new_string">我的新字符串</string>

<!-- values-pt-rBR/strings.xml -->
<string name="my_new_string">Minha Nova String</string>
```

3. Rebuild the project to generate the `Res` class.

## Language Switching

Language preference is managed through the `LocaleManager` in the `router` module. The app will automatically use the system locale by default, but users can change the language in settings.

## Best Practices

1. **Always provide English translations** - English is the default fallback language.
2. **Use descriptive string names** - Follow the naming convention: `module_feature_description` (e.g., `task_detail_cd_icon_category`).
3. **Keep strings context-free** - Avoid strings that depend on UI context.
4. **Use plural resources** - For strings that change based on quantity, use `plurals.xml`.
5. **Test all languages** - Ensure UI layouts work correctly with all supported languages, especially RTL languages.

## RTL Support

Compose Multiplatform 1.8.2+ includes support for Right-to-Left (RTL) languages. The framework automatically handles:
- Text direction
- Layout mirroring
- Gesture handling

## Adding a New Language

1. Create a new directory: `values-{languageCode}-r{countryCode}/`
   - Example: `values-es-rES/` for Spanish (Spain)
   - Example: `values-fr-rFR/` for French (France)

2. Copy `strings.xml` and `plurals.xml` from `values/` to the new directory.

3. Translate all strings in the new files.

4. Add the locale to `AppLocale` enum in `router` module.

5. Rebuild the project.

## References

- [Kotlin Multiplatform Compose Resources](https://kotlinlang.org/docs/multiplatform/compose-localize-strings.html)
- [Compose Multiplatform Documentation](https://www.jetbrains.com/lp/compose-multiplatform/)

