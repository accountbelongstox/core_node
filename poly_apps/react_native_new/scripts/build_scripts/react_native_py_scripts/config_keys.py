"""
Configuration Keys Standard
Defines all standard key names for build_config.ini
All keys are flattened from [section] to direct key access
"""

# ============ [app_info] Keys ============
KEY_APP_NAME = "app_name"
KEY_DISPLAY_NAME_CHINESE = "display_name_chinese"
KEY_DISPLAY_NAME_ENGLISH = "display_name_english"
KEY_DESCRIPTION = "description"

# ============ [package_settings] Keys ============
KEY_RANDOM_PACKAGE_ID = "random_package_id"
KEY_DEFAULT_PACKAGE_ID = "default_package_id"
KEY_RANDOM_DISPLAY_NAME = "random_display_name"

# ============ [build_settings] Keys ============
KEY_BUILD_PLATFORMS = "build_platforms"
KEY_USE_EXTERNAL_RESOURCES = "use_external_resources"
KEY_OPTIMIZE_IMAGES = "optimize_images"
KEY_USE_EXTERNAL_SAFE_BUILD = "use_external_safe_build"

# ============ [resources] Keys ============
KEY_ICON_FILE = "icon_file"
KEY_SMALL_ICON_FILE = "small_icon_file"
KEY_SPLASH_SCREEN_FILE = "splash_screen_file"
KEY_BACKGROUND_IMAGE_FILE = "background_image_file"

# ============ [splash_config] Keys ============
KEY_SPLASH_COLOR = "color"
KEY_SPLASH_COLOR_DARK = "color_dark"
KEY_SPLASH_BACKGROUND_IMAGE = "background_image"
KEY_SPLASH_BACKGROUND_IMAGE_DARK = "background_image_dark"
KEY_SPLASH_ANDROID = "android"
KEY_SPLASH_IOS = "ios"
KEY_SPLASH_WEB = "web"
KEY_SPLASH_FULLSCREEN = "fullscreen"
KEY_SPLASH_COLOR_ANDROID = "color_android"
KEY_SPLASH_COLOR_DARK_ANDROID = "color_dark_android"

# ============ [api] Keys ============
KEY_API_BASE_URL = "base_url"
KEY_API_HEALTH_CHECK_PATH = "health_check_path"
KEY_API_TIMEOUT = "timeout"
KEY_API_BASE_URL_SECONDARY = "base_url_secondary"
KEY_API_BASE_URL_FALLBACK = "base_url_fallback"

# ============ Fallback/Default Keys (from default_config.py) ============
# These are legacy keys for backward compatibility
FALLBACK_NAMESPACE = "namespace"
FALLBACK_DISPLAY_NAME = "displayName"
FALLBACK_DISPLAY_NAME_EN = "displayNameEn"
FALLBACK_DISPLAY_NAME_ZH = "displayNameZh"
FALLBACK_BUNDLE_ID = "bundleId"
FALLBACK_PACKAGE_ID = "packageId"
