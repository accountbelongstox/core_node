<!-- ### FLUTTER ARCHITECTURE PROMPT START ### -->

# Important: When you see this document, multiple AIs may be working collaboratively, so documents and code are updated in real-time. You should update the code and documents with the latest content as much as possible.

# Flutter Aggregated Application - Basic Specifications (Must Follow Basic Specifications)

- **Project Mode**: This project is a **Multi-App Aggregation** Flutter application that supports multiple business modules through a single codebase.
- **Target Platforms**: Currently prioritizing support for **Android**, **iOS** mobile platforms, and **Mobile Web**.
- **All code in English, except for multilingual scripts. Prohibited from running test commands during development, prohibited from writing test scripts, prohibited from writing summaries**
- **Any development requested under this specification should output a development result to ./{your AI Name}_devlop_result.md file, you can continuously update this file**


## Multi-Entry Mode ✅ COMPLETED
```
Specification: Dual Entry Mode
      ├── lib/main.dart                        ✅ Virtual entry (lightweight proxy), will reference special APP `lib/apps/app_main/`
      ├── lib/common/app/main_common.dart      ✅ Common entry (complete startup logic)
      └── lib/apps/app_{name}/main_app_{name}.dart ✅ Independent entry (APP-specific)

This application uses multi-entry mode:
- Main entry (lib/main.dart): Lightweight virtual entry, directly calls `lib/apps/app_main/` which then calls the common entry `main_common.dart`. After startup, it will reference all APP's route collection, multilingual collection, and static resource collection
- Common entry (lib/common/app/main_common.dart): Contains complete startup logic, provides a runCommonApp method externally, can pass in one or more multilingual, routing and other resources
- Independent entry examples:
  ├── lib/apps/app_qy/main_app_{appname A}.dart: App A independent entry, includes only this APP's code and resources
  └── lib/apps/app_bloom/main_app_{appname A}.dart: App B independent entry
Features:
- lib/main.dart is used for unified debugging of all APPs through the special APP `lib/apps/app_main/`
```

## Example APP
- This project contains an example APP that will be developed following this specification and serves as a template for creating new APPs based on this Flutter project. When asked to develop the example APP, you can develop it in `lib/apps/app_example/`

## Main Entry main.dart Special APP `app_main`
- **Specialty**: `lib/apps/app_main/` is directly called by the main.dart entry point. The directory structure is consistent with regular APPs. The main difference is that the routing component will hardcode references to other apps, and there is a page (feature) `lib/apps/app_main/features_app_main/views/all_apps_showcase_screen.dart` designed as a multi-title -> list format, introducing all other APPs, with titles showing other APP names, and lists showing each page, resources, etc. of other APPs. On the main page, you can jump to any other APP page for overall debugging
- **Routing**: Design routing according to specifications, but will hardcode references to other APP routes (see "Routing System and Dual Entry Mode Design" for details)
- **Page Specification**: Follow the page (feature) specification in this document
- **Settings and Resources**: Design settings controller and assets according to specifications, but do not need other APP's app_sets and app assets (because other pages will call them automatically, as long as routes are referenced)

## APP Creation Specification

### APP Creation Steps
1. Read the entire content of this document and follow all rules
2. Reference the structure of `lib/apps/app_example/` as a template
3. Create APP directories and files according to the following structure
4. Ensure all files are associated with base classes and extensions in `lib/common/`
5. According to assets specification, add static resources in pubspec.yaml, create corresponding directories, corresponding dart files in assets app, and reference example code to encode assets resource library (see "Static Resource Usage Specification" for details)

### APP File Design and Structure Standardization
```
Specification: lib/apps/app_{name}/ requires `app_` prefix
      ├── main_app_{name}.dart            # APP entry file, calls runCommonApp (from lib/common/app/main_common.dart)
      │                                    # Must pass in: appName, appId, appSettings, enAppLocales, zhAppLocales, 
      │                                    #          appPrefs, customUserProvider, initialRoute, homeRoute
      │
      ├── config_app_{name}/              # APP configuration directory
      │   ├── app_config_app_{name}.dart  # Application configuration class (appId, appName, baseUrl, featureFlags, etc.)
      │   ├── constants_app_{name}.dart  # Constant definitions
      │   ├── prefs_app_{name}.dart      # Prefs configuration class, must extend AppPrefsBase (from lib/common/storage/app_prefs_base.dart)
      │   ├── provider_app_{name}.dart   # Export PrefsApp{name} instance for use by main_app_{name}.dart
      │   ├── storage_app_{name}.dart    # Storage configuration
      │   ├── api_config_app_{name}.dart # API configuration and data parsing (from lib/common/network/models/api_config.dart)
      │   ├── api_endpoints_app_{name}.dart # API endpoint definitions
      │   └── api_data_models_app_{name}.dart # Data model definitions
      │
      ├── settings_app_{name}/            # APP settings configuration
      │   └── settings_app_{name}.dart   # Use SettingItem (from lib/common/settings/models/setting_item.dart)
      │                                   # Define: SettingItem.toggle(), SettingItem.select(), SettingItem.slider(), etc.
      │
      ├── providers_app_{name}/           # APP state providers
      │   └── {name}_user_provider.dart   # User Provider, must extend EnhancedUserProvider (from lib/common/provider_status/user_provider.dart)
      │                                   # Implement: appProfile, setAppUser(), upsertPreference() and other methods
      │
      ├── router_app_{name}/              # Routing configuration (see "Routing System and Dual Entry Mode Design" for details)
      │   ├── router_app_{name}.dart     # Main routing configuration file, implements createRouter() method returning GoRouter
      │   └── routes_provider_app_{name}.dart # Route provider, defines route constants (routeHome, routeLogin, etc.)
      │
      ├── localization_app_{name}/        # APP multilingual directory (see "Multilingual Module" for details)
      │   ├── localization_keys_app_{appname}.dart # TextKey definitions, keys must have {appname} prefix
      │   ├── en_app_{name}.dart          # English translation, based on localization_keys
      │   └── zh_app_{name}.dart          # Chinese translation, based on localization_keys
      │
      ├── controller_app_{name}/          # APP-specific controller group
      │   ├── settings_controller_app_{name}.dart # Settings controller
      │   ├── auth_controller_app_{name}.dart    # Authentication controller
      │   └── ...                         # Other controllers
      │
      ├── models_app_{name}/              # Data model definitions
      │   └── user_model_app_{name}.dart  # Must be defined, user data model for this APP
      │
      ├── features_app_{name}/            # Feature modules
      │   └── {feature}/
      │       ├── views/                  # Page views
      │       ├── widgets/                # Page components
      │       └── controllers/            # Controllers, can reference data from models_app_{name}
      │
      ├── services_app_{name}/            # Service layer (see "Network Usage Specification" for details)
      │   ├── {name}_auth_api_service.dart # Authentication API service, based on auth_controller (lib/common/network/controller/auth_controller.dart)
      │   ├── {name}_public_api_service.dart # Public API service
      │   └── {name}_service.dart         # General service

      ├── repositories_app_{name}/        # Data repository
      │   └── {name}_repository.dart
      │
      ├── resources_app_{name}/           # APP-specific assets resources
      │   ├── assets_icons_app_{name}.dart # Icon definitions, assetsKey prefix must have {appname}
      │   ├── assets_images_app_{name}.dart # Image definitions
      │   └── assets_launch_app_{name}.dart # Launch screen definitions
      │
      ├── utils_app_{name}/               # APP utilities
      │   └── utils_app_{name}.dart
      │
      └── otherdir_app_{name}/            # Other functional directories, all must follow this naming format

### Association Specification with lib/common/

#### 1. Application Entry (main_app_{name}.dart)
- **Call**: `runCommonApp()` from `lib/common/app/main_common.dart`
- **Required Parameters**:
  - `appName`: String (Application name)
  - `appId`: String (Application ID, used for route namespace)
  - `appSettings`: List<SettingItem> (from settings_app_{name}/settings_app_{name}.dart)
  - `enAppLocales`: List<Map<String, dynamic>> (from localization_app_{name}/en_app_{name}.dart)
  - `zhAppLocales`: List<Map<String, dynamic>> (from localization_app_{name}/zh_app_{name}.dart)
  - `appPrefs`: AppPrefsBase (from config_app_{name}/provider_app_{name}.dart)
  - `customUserProvider`: BaseUserProvider (from providers_app_{name}/{name}_user_provider.dart)
  - `initialRoute`: String (from router_app_{name}/routes_provider_app_{name}.dart)
  - `homeRoute`: String (from router_app_{name}/routes_provider_app_{name}.dart)

#### 2. Prefs Configuration (config_app_{name}/prefs_app_{name}.dart)
- **Extend**: `AppPrefsBase` from `lib/common/storage/app_prefs_base.dart`
- **Implementation Method**: `initSharedPreferences()` returns SharedPreferences instance
- **Export**: Export instance in `provider_app_{name}.dart` for use by main_app_{name}.dart

#### 3. User Provider (providers_app_{name}/{name}_user_provider.dart)
- **Extend**: `EnhancedUserProvider` from `lib/common/provider_status/user_provider.dart`
- **Implementation Methods**:
  - `appProfile`: Get APP-specific user data
  - `setAppUser()`: Set user data
  - `upsertPreference()`: Update user preferences

#### 4. Settings Configuration (settings_app_{name}/settings_app_{name}.dart)
- **Use**: `SettingItem` from `lib/common/settings/models/setting_item.dart`
- **Methods**: `SettingItem.toggle()`, `SettingItem.select()`, `SettingItem.slider()`, `SettingItem.textInput()`, `SettingItem.checkbox()`
- **Must Set**: `appId`, `category` for grouping management

#### 5. Routing Configuration (router_app_{name}/router_app_{name}.dart)
- **Use**: `go_router` package, implement `createRouter()` method returning `GoRouter` instance, route constants defined in `routes_provider_app_{name}.dart`, format: `/app_{name}/route_name` (see "Routing System and Dual Entry Mode Design" for details)

#### 6. Localization (localization_app_{name}/)
- **Use**: `LocalizationManager` from `lib/common/localization/localization_manager.dart`, all keys must have `{appname}_` prefix to distinguish common and APP-specific, passed through `runCommonApp`'s `enAppLocales` and `zhAppLocales` parameters (see "Multilingual Module" for details)

#### 7. Network Service (services_app_{name}/)
- **Use**: `auth_controller` from `lib/common/network/controller/auth_controller.dart`, API configuration uses `ApiConfig` from `lib/common/network/models/api_config.dart`, methods: `isLogin()`, `getUserInfoData()`, `post()`, `get()`, `put()`, `delete()` (see "Network Usage Specification" for details)

**Features**: `lib/common/` provides all common class libraries to serve each APP; attaching {appname} information to folders/files is to prevent AI confusion when opening multiple files with the same name; all APPs must follow the above association specifications to ensure correct integration with common modules

```

## Flutter Bloom - API Guidelines
- **Global Configuration**: `../../../config/base.config.json`, when developing APIs, **must** reference the global configuration file, use appropriate APIs according to prompts, and hardcode into this project

## Page / Feature Setup Specification
- Regardless of location, when special app or app designs pages (features), they must follow the file structure below. Data models should be uniformly placed in app_{name}/models_app_{name}
      ├── ... Parent directory (if parent directory also has specifications, follow them.)
      │   └── {feature}/
      │       ├── views/       # Page views (if there is an old view directory, merge it into views directory)
      │       ├── widgets/     # Page components (keep)
      │       ├── controllers/ # Controllers (new)
      │       └── models/      # Deprecated directory, if it exists, move its contents to app_{name}/models_app_{name}

## Multilingual Module
- Based on 'package:flutter_localization/flutter_localization.dart' package
Due to the special nature of multilingual support, it needs to be loaded first. So in each app (including app_main), after hardcoding imports of en/zh.dart, runCommonApp finally passes to
lib/common/localization/
├── localization_manager.dart    # Extends a method `TextKey`.tr(content) from it. When called in any page, it automatically changes according to the language setting in Setting controller. It also provides setAppTranslations to append one or more en/zh language packages. localization_manager.dart has automatically loaded common_en.dart/common_zh.dart.
├── map_locales.dart        # Language mapping configuration (based on original implementation)
├── common_en.dart          # Common English translation
├── common_zh.dart          # Common Chinese translation
├── localization_keys.dart    # TextKey definitions, zh/en.dart implemented based on this key

APP Language Extension Implementation:
lib/apps/{name}/localization_app_{name}/  # Note: originally `partition_locals_app_{name}`, if old files exist, merge them into `localization_app_{name}`.
├── en_app_{appname}.dart                     # APP-specific English translation
└── zh_app_{appname}.dart                     # APP-specific Chinese translation
└── localization_keys_app_{appname}.dart      # app-specific TextKey definition, required

app_main Special APP Language Extension Implementation:
lib/apps/{name}/localization_app_{name}/ # Note: originally `partition_locals_app_{name}`, if old files exist, merge them into `localization_app_{name}`.
├── ...                     # Regular APP default implementation
└── app_locales_main.dart                     # New file, used to centrally import all other APP's en/zh.dart packages, and uniformly pass to runCommonApp -> [intermediate step] -> localization_manager.dart

Features:
1. In the main entry lib/apps/app_main/app_main_main.dart referenced by main.dart, hardcode imports of all app language packages (centrally introduced through file 'lib/apps/app_main/partition_locals_app__main/app_locales_main.dart'), finally pass to localization_manager through runCommonApp for merging, and get a collection that extends all app multilingual support, and is called by all APPs through the `TextKey`.tr(content) function.
2. In the APP-specific APP of main_app_xx.dart, only hardcode import the specific app language package, also pass to localization_manager through runCommonApp for merging, get a language collection that only contains the specific app, without other app keys
4. strKey in common/localization/ must have a prefix, indicating it's common. In app-specific en/zh_app_{appname}.dart, keys must have appname prefix, indicating they are app-specific.
```

## Storage Management Module Design Specification ✅ COMPLETED
Specification: lib/common/storagev2/ 


## Theme Extension Specification

### Theme System Architecture (lib/common/theme/)

```
lib/common/theme/
├── base/                            # Base theme components
│   ├── theme_colors.dart           # Unified color constant definitions (complete color system)
│   ├── theme_text_styles.dart      # Text style definitions (iOS-style text system)
│   ├── theme_dimensions.dart       # Dimension and spacing definitions (responsive dimension system)
│   ├── theme_constants.dart        # Theme constant configuration
│   ├── theme_effects.dart          # Theme effect definitions
│   ├── theme_extensions.dart       # Theme extension definitions
│   ├── theme_gradients.dart        # Gradient definitions
│   ├── theme_shadow.dart           # Shadow definitions
│   └── theme_animations.dart       # Animation definitions
├── extensions/                      # Theme extensions
│   └── gradient_extensions.dart    # Gradient extensions (merged dark/light gradients)
├── platforms/                       # Platform preset themes
│   ├── mobile/                     # Mobile theme
│   │   ├── mobile_light_theme.dart # Mobile light theme (green mint theme)
│   │   └── mobile_dark_theme.dart  # Mobile dark theme (purple gradient theme)
│   ├── web/                        # Web theme
│   │   ├── web_light_theme.dart    # Web light theme (fluorescent green theme)
│   │   └── web_dark_theme.dart     # Web dark theme (tech dark theme)
│   └── desktop/                    # Desktop theme
│       ├── desktop_light_theme.dart # Desktop light theme (Microsoft style)
│       └── desktop_dark_theme.dart # Desktop dark theme (VS Code style)
├── compatibility/                   # Compatibility layer
│   ├── theme_compatibility.dart    # Theme compatibility
│   └── gradient_compatibility.dart # Gradient compatibility
└── theme_manager.dart              # Theme manager (unified theme access)
```

### Base Theme Component Usage (lib/common/theme/base/)

#### 1. Color System (ThemeColors)
- **Location**: `lib/common/theme/base/theme_colors.dart`, **Usage**: `color: ThemeColors.blue`

#### 2. Text Styles (ThemeTextStyles)
- **Location**: `lib/common/theme/base/theme_text_styles.dart`, **Usage**: `style: ThemeTextStyles.largeTitle`

#### 3. Dimensions and Spacing (ThemeDimensions)
- **Location**: `lib/common/theme/base/theme_dimensions.dart`, **Usage**: `padding: EdgeInsets.all(ThemeDimensions.spacing16)`

### Theme Manager Usage (ThemeManager)
- **Location**: `lib/common/theme/theme_manager.dart`, **Usage**: `ThemeManager.instance.getLightTheme()`

### Gradient Extension Usage (GradientExtensions)
- **Location**: `lib/common/theme/extensions/gradient_extensions.dart`, **Usage**: `gradient: GradientExtensions.primaryLight`

### APP-Specific Theme Extensions (lib/apps/app_{name}/resources_app_{name}/)

#### 1. APP Color Extension (ColorsApp{Name})
- **Location**: `lib/apps/app_{name}/resources_app_{name}/colors_app_{name}.dart`, **Specification**: Extend APP-specific colors based on `ThemeColors`, **Usage**: `color: ColorsAppExample.examplePrimaryBrand`

#### 2. APP Theme Extension (ThemeExtensionsApp{Name})
- **Location**: `lib/apps/app_{name}/resources_app_{name}/theme_extensions_app_{name}.dart`, **Specification**: Only contains APP-specific custom theme extensions, most extensions should directly use common extensions, **Usage**: `decoration: ThemeExtensionsAppExample.appDonationCardDecoration`

#### 3. APP Text Style Extension (TextStylesApp{Name})
- **Location**: `lib/apps/app_{name}/resources_app_{name}/text_styles_app_{name}.dart`, **Specification**: Extend APP-specific text styles based on `ThemeTextStyles`, **Usage**: `style: TextStylesAppExample.exampleCustomTitle`

### Theme Usage Specification

#### 1. Direct Reference Principle
- **Priority Use**: Directly reference classes in `lib/common/theme/base/` in view files, avoid secondary wrapping or creating manager files
- **Examples**: `ThemeColors.blue`, `ThemeTextStyles.title1`, `ThemeDimensions.spacing16`

#### 2. APP Extension Principle
- **Extend Only When Needed**: If APP doesn't need special extensions, directly use common themes; APP extensions should extend based on `ThemeColors`, `ThemeTextStyles`, `ThemeDimensions`, avoid duplicating content already in common themes

#### 3. Platform Theme Selection
- **Auto Selection**: Automatically select theme based on platform through `ThemeManager`; in `runCommonApp`, can manually specify through `lightTheme` and `darkTheme` parameters; theme is affected by theme settings in `SettingsController`

#### 4. Migration Specification
- **Priority Extension**: If keys used in view don't exist in `lib/common/theme/base/`, prioritize extending in base; adaptation order: first `ThemeDimensions`, then `ThemeTextStyles`, finally `ThemeColors`; don't replace keys in view with keys already in base, but extend base

### Association with lib/common/
- **Base Theme Classes**: `lib/common/theme/base/theme_colors.dart` (color system), `theme_text_styles.dart` (text styles), `theme_dimensions.dart` (dimensions and spacing), `extensions/gradient_extensions.dart` (gradient extensions), `theme_manager.dart` (theme manager)
- **Platform Themes**: `lib/common/theme/platforms/mobile/` (mobile), `web/` (Web), `desktop/` (desktop)
- **Design Principles**: No Manager files, directly use static classes; prioritize direct reference to common theme classes, avoid secondary encapsulation; only create extension files when APP needs special customization

## Common Module Architecture (lib/common/)

Actual Module Tree Structure:
```
lib/common/
├── app/                    # Application entry (main_common.dart)
├── assets/                 # Resource management (icons/images/launch)
├── auth_v2/                # Authentication system v2 (multiple providers: Google/GitHub/WeChat/QQ/Phone)
├── cache_manager/          # Cache manager
├── constants/              # Application constants
├── controller/             # Controllers (settings_controller)
├── database/               # Database system ✅ (SQLite/IndexedDB/interface abstraction/models)
├── i18n/                   # Internationalization service
├── iframe/                 # iframe listener
├── localization/           # Localization management (multilingual/map localization)
├── map/                    # Map module ✅ (map service/location service/utilities)
├── media/                   # Audio/Video module ✅ (audio playback recording/video playback recording/utilities)
├── model/                   # Data models (user/message/vocabulary)
├── network/                 # Network framework v1 (unified client/interceptor/WebSocket/endpoints)
├── network_v2/              # Network framework v2 (authentication strategy/cache/queue/parsing)
├── provider_status/         # State providers (base/screen size/user)
├── repo/                    # Data repository
├── sdk/                     # SDK integration (Azure Maps/Tencent Maps)
├── services/                # Service layer (settings service)
├── settings/                # Settings system ✅ (models/configuration/storage)
├── storage/                 # Storage system v1 (Hive implementation/interface/migration)
├── storagev2/               # Storage system v2 (application/business/data access/DI)
├── theme/                   # Theme system (base/platform adaptation/compatibility)
├── utils/                   # Utility library (date/validation/image/display/platform/text/Web)
└── widgets/                 # Component library (65 components: buttons/inputs/dialogs/navigation/layout/common)
```

Module Description: Common modules provide core infrastructure, including network framework (dual versions), storage system (dual versions), database (cross-platform SQLite/IndexedDB), authentication system (multiple providers), map/audio-video/settings and other complete functional modules, as well as 65+ reusable components and utility libraries, supporting multiple platforms (Web/Native) and internationalization.

## Routing System and Dual Entry Mode Design
- **Specification**: `lib/apps/app_{name}/router_app_{name}/` directory contains `router_app_{name}.dart` (main routing configuration file, based on `go_router`, implements `createRouter()` method passed to runCommonApp) and `routes_provider_app_{name}.dart` (route provider, used for route definition and aggregation)
- **Main Entry**: `lib/apps/app_main/router_app_main/routes_provider_app_main.dart` hardcodes routes of all other APPs, import `lib/apps/app_{name}/router_app_{name}/router_app_{name}.dart` or `routes_provider_app_{name}.dart`

## `lib/common/utils` Utility Library Design
- **Migration**: According to the new architecture design, all utility classes and helper classes have been migrated from scattered `lib/util/` and `lib/helper/` directories to the unified `lib/common/utils/` directory
- **Legacy Code Compatibility**: `DeviceType` in `display_helper.dart` has been renamed to `DisplayDeviceType`
- **Directory Structure**: `lib/common/utils/` contains `utils.dart` (unified export file), `compatibility/` (backward compatibility layer), `date/` (date/time utilities), `validation/` (data validation utilities), `image/` (image processing utilities), `display/` (display and responsive design utilities), `platform/` (platform detection utilities), `common/` (general utility classes), `web/` (Web platform-specific utilities), `text/` (text processing utilities)
- **Recommended Import**: `import 'package:qyflutter/common/utils/utils.dart';`

## Network Usage Specification
- Usage specification: In `config_app_{name}`, define network objects (note: network object is not a url string, but an object containing url/authentication methods and other factors from `lib/common/network/models/api_config.dart`), also define data structures in the same directory, then pass the network object/data structure to `auth_controller.dart` (returns a network client object containing isLogin/getUserInfoData/post/get/put/delete methods and supporting data persistence), create files like `{name}_auth_api_service.dart` / `{name}_product_api_service.dart` in the `services_app_{name}` directory for passing, and export post / isLogin / get and other methods in server.dart method, multiple `service` methods for different pages to call

lib/common/network/controller/
└── auth_controller.dart                    # Authentication controller factory

lib/apps/app_{name}/
├── config_app_{name}/
│   ├── api_config_app_{name}.dart              # API configuration and data parsing
│   ├── api_endpoints_app_{name}.dart           # API endpoint definitions
│   └── api_data_models_app_{name}.dart             # Data model definitions
└── services_app_{name}/
    ├── auth_api_app_{name}_service.dart        # Example: Authentication API service
    ├── user_api_app_{name}_service.dart        # Example: User API service
    ├── product_api_app_{name}_service.dart     # Example: Product API service

//-------------------------------------------

## State Management
- **State Management Package**: Use `package:provider/provider.dart` / `package:flutter/foundation.dart` for state management. For data that needs persistence, use database. State management common classes are implemented in `lib/common`
- **Get Package**: This project no longer uses Get for state management. Get only provides basic functionality for getting system constants. Old code containing it should be modified. Now use provider package for state management, implement common classes in lib/common
- **UserProvider**: Any APP must provide at least one UserProvider object, implement `lib/apps/app_{appname}/models_app_{name}/user_model_app_{name}.dart` in the APP, used to store the APP's user login state, and a Setting persistence controller for each VIEW to call settings, set global settingKey, etc.


// -----------------------------------------------------------------------------------------------------

## Profile Usage Specification
- To be added

// ----------------------------------------------------------------------------------------------------------


## APP Migration Plan
- Old folders like locationze / controller in the app directory should be moved and merged according to the new naming convention {appname} (Note: old and new folders may exist simultaneously, this is caused by an AI moving halfway, you can merge "old merged into new")
- Directory structure hierarchy modified to new architecture structure... If old files and new files are duplicated (e.g., new file is correct but forgot to delete old file), you can check and confirm safety before removing old files
- No bridge files between old files and new architecture are needed, such as `legacy`. You will check if any files call such bridge code, then move all to the new architecture.

## Flutter Bloom Framework Updates
- **Prefs**: `lib/common/provider_status/prefs.dart` has been deleted, changed to provide prefs to runCommonApp from app's config, each app has independent prefs
- **UserModel**: `lib/common/modole/user_model.dart` has been deleted, user_model changed to be provided by specific APP, any APP must provide at least one UserProvider object (see "State Management" for details)


## Static Resource Usage Specification

### Resource Directory Structure
```
assets/
├── common/              # Common resources (shared by all APPs)
│   ├── icons/          # Common icons, path: assets/common/icons/
│   ├── images/         # Common images, path: assets/common/images/
│   └── launch/         # Common launch screens, path: assets/common/launch/
├── .internal_common    # Internal resources, only for restoring compilation replacement icons/background images, prohibited from writing dart code
└── apps/               # APP-specific resources
    ├── app_{name}/     # APP-specific resource directory
    │   ├── icons/      # APP icons, path: assets/apps/app_{name}/icons/
    │   ├── images/     # APP images, path: assets/apps/app_{name}/images/
    │   └── launch/     # APP launch screens, path: assets/apps/app_{name}/launch/
    └── .internal_{appname} # APP internal resources, only for replacing compilation resources, prohibited from writing dart code
```

### Common Resource Usage (lib/common/assets/)

#### 1. Common Icons (CommonAssetsIcons)
- **Location**: `lib/common/assets/common_assets_icons.dart`, **Path**: `assets/common/icons/{filename}`, **Usage**: `Image.asset(CommonAssetsIcons.logo)`

#### 2. Common Images (CommonAssetsImages)
- **Location**: `lib/common/assets/common_assets_images.dart`, **Path**: `assets/common/images/{filename}`, **Usage**: `Image.asset(CommonAssetsImages.avatarPlaceholder)`

#### 3. Common Launch Screens (CommonAssetsLaunch)
- **Location**: `lib/common/assets/common_assets_launch.dart`, **Path**: `assets/common/launch/{filename}`, **Usage**: `Image.asset(CommonAssetsLaunch.splash)`

### APP-Specific Resource Usage (lib/apps/app_{name}/resources_app_{name}/)

#### 1. APP Icons (AssetsIconsApp{Name})
- **Location**: `lib/apps/app_{name}/resources_app_{name}/assets_icons_app_{name}.dart`, **Path**: `assets/apps/app_{name}/icons/{filename}`, **Key Naming**: All constant names must have `{appname}` prefix, **Usage**: `Image.asset(AssetsIconsAppExample.exampleLogo)`

#### 2. APP Images (AssetsImagesApp{Name})
- **Location**: `lib/apps/app_{name}/resources_app_{name}/assets_images_app_{name}.dart`, **Path**: `assets/apps/app_{name}/images/{filename}`, **Key Naming**: All constant names must have `{appname}` prefix, **Usage**: `Image.asset(AssetsImagesAppExample.exampleBanner)`

#### 3. APP Launch Screens (AssetsLaunchApp{Name})
- **Location**: `lib/apps/app_{name}/resources_app_{name}/assets_launch_app_{name}.dart`, **Path**: `assets/apps/app_{name}/launch/{filename}`, **Key Naming**: All constant names must have `{appname}` prefix, **Usage**: `Image.asset(AssetsLaunchAppExample.exampleSplash)`

### Resource Usage Specification

#### 1. Import Specification
- **Common Resources**: Import from `lib/common/assets/`; **APP Resources**: Import from `lib/apps/app_{name}/resources_app_{name}/`; **Prohibited**: APP resource files are prohibited from importing common resources for secondary wrapping

#### 2. Usage Methods
- **Image.asset**: `Image.asset(CommonAssetsIcons.logo)`
- **AssetImage**: `image: AssetImage(CommonAssetsImages.backgroundLight)`
- **IconButton**: `icon: Image.asset(CommonAssetsIcons.menu)`

#### 3. Naming and Path Specification
- **Key Naming**: Common resources directly named without prefix (`logo`), APP resources must have `{appname}` prefix (`exampleLogo`), avoid resource key conflicts between different APPs
- **Path Format**: Common resources `assets/common/{type}/{filename}`, APP resources `assets/apps/app_{name}/{type}/{filename}`, types are `icons`, `images`, `launch`
- **Resource Addition**: Common resources prohibited from arbitrary addition, must be shared by all APPs. APP resources only added under `resources_app_{name}/` directory. Font resources only defined once in common

### Association with lib/common/
- **Common Resource Classes**: `lib/common/assets/common_assets_icons.dart` (common icons), `common_assets_images.dart` (common images), `common_assets_launch.dart` (common launch screens)
- **Design Principles**: No Manager files, directly use static constants in classes, no secondary encapsulation; APP resources independently encapsulated, prohibited from importing common for secondary wrapping

