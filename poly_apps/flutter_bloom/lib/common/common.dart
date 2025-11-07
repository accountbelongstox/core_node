/// Flutter Bloom Common Library
///
/// Unified entry point for all common functionality across Flutter Bloom apps.
/// Import this single file to access centralized modules:
/// - Theme System (colors, text styles, dimensions, managers)
/// - Network Layer (v2 with auth, caching, queueing)
/// - Localization (multi-language support)
/// - Widgets (common UI components)
/// - Utils (date, validation, display, platform helpers)
/// - Settings (app settings management)
/// - Storage (unified storage system)
/// - Controllers (settings, auth, etc.)
///
/// Usage:
/// ```dart
/// import 'package:qyflutter/common/common.dart';
/// ```
library;

// Core App Entry
export 'app/main_common.dart';

// Theme System (Centralized)
export 'theme/theme.dart';

// Network Layer v2 (Recommended - Centralized API)
export 'network_v2/network_v2.dart';

// Network Layer v1 (Legacy)
export 'network/network.dart';

// Localization (Centralized)
export 'localization/localization.dart';

// Widgets (Centralized)
export 'widgets/widgets.dart';

// Utils (Centralized)
export 'utils/utils.dart';

// Settings System
export 'settings/models/setting_item.dart';
export 'settings/configs/base_settings.dart';
export 'settings/storage/settings_storage_manager.dart';

// Storage System (Centralized Data)
export 'storage/storage_manager.dart';
export 'storage/unified_storage.dart';
export 'storage/app_prefs_base.dart';

// Controllers (Centralized)
export 'controller/settings_controller.dart';

// Database (Centralized Data)
export 'database/database_manager.dart';
export 'database/interfaces/database_interface.dart';

// Providers (Centralized State)
export 'provider_status/base_provider.dart';
export 'provider_status/user_provider.dart';
export 'provider_status/screen_size_provider.dart';

// Assets
export 'assets/common_assets_icons.dart';
export 'assets/common_assets_launch.dart';

// Map Services
export 'map/map_service.dart';
export 'map/location_service.dart';

// Media Services
export 'media/audio/audio_player.dart';
export 'media/audio/audio_recorder.dart';
export 'media/video/video_player.dart';
export 'media/video/video_recorder.dart';

// Constants
export 'constants/app_constants.dart';

// Auth v2
export 'auth_v2/auth_v2.dart';

// I18n (Legacy - prefer localization/)
export 'i18n/i18n_service.dart';
export 'i18n/translations.dart';

// Services (Legacy - prefer specific exports above)
export 'services/settings_service.dart';