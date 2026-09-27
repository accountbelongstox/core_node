import 'package:go_router/go_router.dart';
import '../features_app_travel/main_scaffold/main_scaffold.dart';
import '../features_app_travel/city/views/city_screen.dart';
import '../features_app_travel/sight/views/sight_detail_screen.dart';
import '../features_app_travel/authentication/views/login_screen.dart';
import '../features_app_travel/profile/views/profile_screen.dart';
import '../features_app_travel/settings/views/settings_screen.dart';
import '../features_app_travel/search/views/search_screen.dart';
import '../features_app_travel/favorites/views/favorites_screen.dart';
import '../features_app_travel/bookmarks/views/bookmarks_screen.dart';

class TravelAppRoutesProvider {
  static const String routeHome = '/travel/home';
  static const String routeLogin = '/travel/login';
  static const String routeProfile = '/travel/profile';
  static const String routeCity = '/travel/city';
  static const String routeSight = '/travel/sight';
  static const String routeSightDetail = '/travel/sight/:id';
  static const String routeSearch = '/travel/search';
  static const String routeFavorites = '/travel/favorites';
  static const String routeBookmarks = '/travel/bookmarks';
  static const String routeSettings = '/travel/settings';
  static const String routeAbout = '/travel/about';

  static String getHomeRoute() => routeHome;
  static String getLoginRoute() => routeLogin;
  static String getProfileRoute() => routeProfile;
  static String getCityRoute() => routeCity;
  static String getSightRoute() => routeSight;
  static String getSightDetailRoute(String id) => '/travel/sight/$id';
  static String getSearchRoute() => routeSearch;
  static String getFavoritesRoute() => routeFavorites;
  static String getBookmarksRoute() => routeBookmarks;
  static String getSettingsRoute() => routeSettings;
  static String getAboutRoute() => routeAbout;

  static String getDefaultRoute() => routeLogin;

  static List<RouteBase> getTravelAppRoutes() {
    return [
      GoRoute(
        path: routeLogin,
        name: 'travel_login',
        builder: (context, state) => const LoginScreen(),
      ),

      GoRoute(
        path: routeProfile,
        name: 'travel_profile',
        builder: (context, state) => const ProfileScreen(),
      ),

      GoRoute(
        path: routeHome,
        name: 'travel_home',
        builder: (context, state) => const MainScaffold(),
      ),

      GoRoute(
        path: routeCity,
        name: 'travel_city',
        builder: (context, state) => const CityScreen(),
      ),

      GoRoute(
        path: routeSightDetail,
        name: 'travel_sight_detail',
        builder: (context, state) {
          final String? id = state.pathParameters['id'];
          return SightDetailScreen(sightId: id);
        },
      ),

      GoRoute(
        path: routeSettings,
        name: 'travel_settings',
        builder: (context, state) => const SettingsScreen(),
      ),

      GoRoute(
        path: routeSearch,
        name: 'travel_search',
        builder: (context, state) => const SearchScreen(),
      ),

      GoRoute(
        path: routeFavorites,
        name: 'travel_favorites',
        builder: (context, state) => const FavoritesScreen(),
      ),

      GoRoute(
        path: routeBookmarks,
        name: 'travel_bookmarks',
        builder: (context, state) => const BookmarksScreen(),
      ),
    ];
  }

  static bool isTravelRoute(String path) {
    return path.startsWith('/travel');
  }

  static Map<String, dynamic> getRouteInfo() {
    return {
      'app': 'travel',
      'routes': [
        routeLogin,
        routeProfile,
        routeHome,
        routeCity,
        routeSightDetail,
        routeSearch,
        routeFavorites,
        routeBookmarks,
        routeSettings,
        routeAbout,
      ],
      'default': routeLogin,
    };
  }
}
