import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import 'app_state.dart';
import 'screens/about_screen.dart';
import 'screens/add_friend_screen.dart';
import 'screens/edit_profile_screen.dart';
import 'screens/friend_detail_screen.dart';
import 'screens/friends_list_screen.dart';
import 'screens/history_screen.dart';
import 'screens/login_screen.dart';
import 'screens/map_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/send_request_screen.dart';

void main() {
  runApp(const GanCodexFlutterApp());
}

class GanCodexFlutterApp extends StatelessWidget {
  const GanCodexFlutterApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AppState(),
      child: Consumer<AppState>(
        builder: (context, appState, _) {
          return MaterialApp(
            title: 'SafeGuardian',
            debugShowCheckedModeBanner: false,
            themeMode: appState.themeMode,
            theme: ThemeData(
              colorScheme: ColorScheme.fromSeed(seedColor: Colors.teal),
              textTheme: GoogleFonts.notoSansTextTheme(),
              useMaterial3: true,
            ),
            darkTheme: ThemeData(
              colorScheme: ColorScheme.fromSeed(
                seedColor: Colors.teal,
                brightness: Brightness.dark,
              ),
              textTheme: GoogleFonts.notoSansTextTheme(
                ThemeData.dark().textTheme,
              ),
              useMaterial3: true,
            ),
            initialRoute: appState.isAuthenticated ? '/map' : '/login',
            onGenerateRoute: (settings) {
              final name = settings.name ?? '/map';
              final shouldShowLogin =
                  !appState.isAuthenticated && name != '/login';
              if (shouldShowLogin) {
                return MaterialPageRoute(
                  builder: (_) => const LoginScreen(),
                  settings: settings,
                );
              }

              if (appState.isAuthenticated && name == '/login') {
                return MaterialPageRoute(
                  builder: (_) => const MapScreen(),
                  settings: settings,
                );
              }

              Widget page;
              switch (name) {
                case '/login':
                  page = const LoginScreen();
                  break;
                case '/map':
                  page = const MapScreen();
                  break;
                case '/friends':
                  page = const FriendsListScreen();
                  break;
                case '/friends/add':
                  page = const AddFriendScreen();
                  break;
                case '/friends/request':
                  page = const SendRequestScreen();
                  break;
                case '/friends/detail':
                  final friendId = settings.arguments as String?;
                  page = FriendDetailScreen(friendId: friendId ?? '');
                  break;
                case '/history':
                  page = const HistoryScreen();
                  break;
                case '/profile':
                  page = const ProfileScreen();
                  break;
                case '/profile/edit':
                  page = const EditProfileScreen();
                  break;
                case '/about':
                  page = const AboutScreen();
                  break;
                default:
                  page = appState.isAuthenticated
                      ? const MapScreen()
                      : const LoginScreen();
              }
              return MaterialPageRoute(
                builder: (_) => page,
                settings: settings,
              );
            },
          );
        },
      ),
    );
  }
}
