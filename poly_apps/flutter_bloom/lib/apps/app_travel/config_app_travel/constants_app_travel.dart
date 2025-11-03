// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

/// Travel App Constants
/// Contains app-specific constants and enums
class TravelAppConstants {
  // Route Names
  static const String routeHome = '/travel/home';
  static const String routeCity = '/travel/city';
  static const String routeSight = '/travel/sight';
  static const String routeSightDetail = '/travel/sight/:id';
  static const String routeSearch = '/travel/search';
  static const String routeFavorites = '/travel/favorites';
  static const String routeBookmarks = '/travel/bookmarks';
  static const String routeMap = '/travel/map';
  static const String routeSettings = '/travel/settings';
  static const String routeAbout = '/travel/about';

  // Storage Keys
  static const String keyUserFavorites = 'travel_user_favorites';
  static const String keyUserBookmarks = 'travel_user_bookmarks';
  static const String keySearchHistory = 'travel_search_history';
  static const String keyCurrentCity = 'travel_current_city';
  static const String keyLastViewedSights = 'travel_last_viewed_sights';
  static const String keyAppSettings = 'travel_app_settings';
  static const String keyThemePreference = 'travel_theme_preference';
  static const String keyLanguagePreference = 'travel_language_preference';
  static const String keyCachedData = 'travel_cached_data';
  static const String keyOfflineData = 'travel_offline_data';

  // Data File Paths
  static const String dataPathHome = 'assets/apps/app_travel/innerdata/home.json';
  static const String dataPathCity = 'assets/apps/app_travel/innerdata/city.json';
  static const String dataPathSight0 = 'assets/apps/app_travel/innerdata/sight0.json';
  static const String dataPathSight1 = 'assets/apps/app_travel/innerdata/sight1.json';

  // Asset Paths
  static const String assetPathImages = 'assets/apps/app_travel/images';
  static const String assetPathUpload = 'assets/apps/app_travel/images/upload';
  static const String assetPathNav = 'assets/apps/app_travel/images/nav';
  static const String assetPathFonts = 'assets/apps/app_travel/fonts';

  // Navigation Icons
  static const String iconHotel = 'assets/apps/app_travel/images/nav/grid-nav-items-hotel@v7.15.png';
  static const String iconFlight = 'assets/apps/app_travel/images/nav/grid-nav-items-flight@v7.15.png';
  static const String iconTravel = 'assets/apps/app_travel/images/nav/grid-nav-items-travel@v7.15.png';
  static const String iconTrain = 'assets/apps/app_travel/images/nav/grid-nav-items-train.png';
  static const String iconMinsu = 'assets/apps/app_travel/images/nav/grid-nav-items-minsu@v7.15.png';
  static const String iconCustom = 'assets/apps/app_travel/images/nav/grid-nav-items-dingzhi@v7.15.png';

  // Error Messages
  static const String errorNetworkConnection = 'Network connection error';
  static const String errorDataLoading = 'Failed to load data';
  static const String errorLocationPermission = 'Location permission denied';
  static const String errorMapLoading = 'Failed to load map';
  static const String errorSearchFailed = 'Search failed';
  static const String errorCityNotFound = 'City not found';
  static const String errorSightNotFound = 'Sight not found';

  // Success Messages
  static const String successFavoriteAdded = 'Added to favorites';
  static const String successFavoriteRemoved = 'Removed from favorites';
  static const String successBookmarkAdded = 'Added to bookmarks';
  static const String successBookmarkRemoved = 'Removed from bookmarks';
  static const String successDataSynced = 'Data synced successfully';

  // UI Constants
  static const double defaultPadding = 16.0;
  static const double smallPadding = 8.0;
  static const double largePadding = 24.0;
  static const double defaultBorderRadius = 8.0;
  static const double smallBorderRadius = 4.0;
  static const double largeBorderRadius = 16.0;
  static const double defaultElevation = 2.0;
  static const double highElevation = 8.0;

  // Swiper Configuration
  static const int swiperAutoplayDelay = 3000;
  static const double swiperHeight = 200.0;
  static const double swiperAspectRatio = 16 / 9;

  // List Configuration
  static const int defaultPageSize = 20;
  static const int maxPageSize = 100;
  static const double listItemHeight = 80.0;
  static const double gridItemAspectRatio = 0.75;

  // Animation Durations
  static const int shortAnimationDuration = 200;
  static const int normalAnimationDuration = 300;
  static const int longAnimationDuration = 500;

  // Cache Configuration
  static const int defaultCacheExpiry = 3600; // 1 hour in seconds
  static const int longCacheExpiry = 86400; // 24 hours in seconds
  static const int shortCacheExpiry = 300; // 5 minutes in seconds

  // Search Configuration
  static const int maxSearchHistoryItems = 20;
  static const int minSearchLength = 2;
  static const int searchDebounceMs = 300;

  // Limits
  static const int maxFavorites = 500;
  static const int maxBookmarks = 500;
  static const int maxSearchResults = 100;
  static const int maxRecentViews = 50;

  // Date Formats
  static const String dateFormatShort = 'MM/dd/yyyy';
  static const String dateFormatLong = 'MMMM dd, yyyy';
  static const String dateTimeFormat = 'MM/dd/yyyy HH:mm';
  static const String timeFormat = 'HH:mm';

  // Default Values
  static const String defaultCityName = 'Luoyang';
  static const String defaultLanguage = 'en';
  static const String defaultTheme = 'light';
  static const String defaultCurrency = 'CNY';

  // SharedPreferences configuration
  static const String prefsPrefix = 'travel_';
  static const String prefsName = 'travel_prefs';
}

/// Travel App Enums
enum TravelContentType {
  sight,
  hotel,
  restaurant,
  shopping,
  entertainment,
}

enum TravelSortOrder {
  popularity,
  distance,
  rating,
  price,
  newest,
}

enum TravelViewMode {
  list,
  grid,
  map,
}

enum TravelFilterType {
  all,
  nearby,
  topRated,
  popular,
  recommended,
}
