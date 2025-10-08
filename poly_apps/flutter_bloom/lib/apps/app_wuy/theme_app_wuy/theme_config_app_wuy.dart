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

import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import '../config_app_wuy/app_config_app_wuy.dart';

/// Wuy App Theme Configuration
/// Extends the common theme system with Wuy-specific customizations
class WuyAppThemeConfig {
  
  // Wuy App specific color overrides
  static const Color wuyPrimaryColor = Color(0xFF2196F3); // Blue
  static const Color wuySecondaryColor = Color(0xFFFF9800); // Orange
  static const Color wuyAccentColor = Color(0xFF4CAF50); // Green
  static const Color wuyBackgroundColor = Color(0xFFF5F5F5);
  static const Color wuySurfaceColor = Color(0xFFFFFFFF);
  static const Color wuyCardColor = Color(0xFFFFFFFF);
  
  // Wuy App specific text colors
  static const Color wuyTextPrimary = Color(0xFF212121);
  static const Color wuyTextSecondary = Color(0xFF757575);
  static const Color wuyTextHint = Color(0xFF9E9E9E);
  
  // Wuy App specific status colors
  static const Color wuyOnlineColor = Color(0xFF4CAF50);
  static const Color wuyOfflineColor = Color(0xFF9E9E9E);
  static const Color wuyErrorColor = Color(0xFFD32F2F);
  static const Color wuyWarningColor = Color(0xFFFF9800);
  static const Color wuySuccessColor = Color(0xFF4CAF50);
  
  // Wuy App specific dimensions
  static const double wuyBorderRadius = 8.0;
  static const double wuyCardBorderRadius = 12.0;
  static const double wuyButtonBorderRadius = 8.0;
  static const double wuyAvatarRadius = 20.0;
  static const double wuyBottomNavHeight = 60.0;
  
  // Wuy App specific spacing
  static const double wuyDefaultPadding = 16.0;
  static const double wuySmallPadding = 8.0;
  static const double wuyLargePadding = 24.0;
  static const double wuyCardPadding = 16.0;
  
  // Wuy App specific shadows
  static List<BoxShadow> get wuyCardShadow => [
    BoxShadow(
      color: ThemeColors.black.withOpacity(0.05),
      blurRadius: 4,
      offset: const Offset(0, 2),
    ),
  ];
  
  static List<BoxShadow> get wuyBottomNavShadow => [
    BoxShadow(
      color: ThemeColors.black.withOpacity(0.1),
      blurRadius: 8,
      offset: const Offset(0, -2),
    ),
  ];
  
  // Wuy App specific gradients
  static const LinearGradient wuyPrimaryGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      wuyPrimaryColor,
      Color(0xFF1976D2),
    ],
  );
  
  static const LinearGradient wuySecondaryGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      wuySecondaryColor,
      Color(0xFFE65100),
    ],
  );
  
  // Wuy App specific text styles
  static TextStyle get wuyAppBarTitle => ThemeTextStyles.headline3.copyWith(
    color: Colors.white,
    fontWeight: FontWeight.w600,
  );
  
  static TextStyle get wuyFriendName => ThemeTextStyles.bodyText1.copyWith(
    fontWeight: FontWeight.w500,
    color: wuyTextPrimary,
  );
  
  static TextStyle get wuyNavLabel => ThemeTextStyles.caption1.copyWith(
    fontSize: 10,
  );
  
  // Wuy App specific button styles
  static ButtonStyle get wuyPrimaryButton => ElevatedButton.styleFrom(
    backgroundColor: wuyPrimaryColor,
    foregroundColor: Colors.white,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(wuyButtonBorderRadius),
    ),
    padding: EdgeInsets.symmetric(
      horizontal: wuyDefaultPadding,
      vertical: wuySmallPadding,
    ),
  );
  
  static ButtonStyle get wuySecondaryButton => OutlinedButton.styleFrom(
    foregroundColor: wuyPrimaryColor,
    side: const BorderSide(color: wuyPrimaryColor, width: 1.5),
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(wuyButtonBorderRadius),
    ),
    padding: EdgeInsets.symmetric(
      horizontal: wuyDefaultPadding,
      vertical: wuySmallPadding,
    ),
  );
  
  // Wuy App specific card decoration
  static BoxDecoration get wuyCardDecoration => BoxDecoration(
    color: wuyCardColor,
    borderRadius: BorderRadius.circular(wuyCardBorderRadius),
    boxShadow: wuyCardShadow,
  );
  
  // Wuy App specific bottom navigation decoration
  static BoxDecoration get wuyBottomNavDecoration => BoxDecoration(
    color: wuySurfaceColor,
    boxShadow: wuyBottomNavShadow,
  );
  
  // Wuy App specific avatar decoration
  static BoxDecoration get wuyOnlineAvatarDecoration => BoxDecoration(
    color: wuyOnlineColor,
    shape: BoxShape.circle,
  );
  
  static BoxDecoration get wuyOfflineAvatarDecoration => BoxDecoration(
    color: wuyOfflineColor,
    shape: BoxShape.circle,
  );
  
  // Wuy App specific switch style
  static SwitchThemeData get wuySwitchTheme => SwitchThemeData(
    thumbColor: MaterialStateProperty.resolveWith<Color>((states) {
      if (states.contains(MaterialState.selected)) {
        return wuyPrimaryColor;
      }
      return ThemeColors.greyColor;
    }),
    trackColor: MaterialStateProperty.resolveWith<Color>((states) {
      if (states.contains(MaterialState.selected)) {
        return wuyPrimaryColor.withOpacity(0.3);
      }
      return ThemeColors.greyColor.withOpacity(0.3);
    }),
  );
  
  // Wuy App specific app bar theme
  static AppBarTheme get wuyAppBarTheme => AppBarTheme(
    backgroundColor: wuyPrimaryColor,
    foregroundColor: Colors.white,
    elevation: 0,
    centerTitle: true,
    titleTextStyle: wuyAppBarTitle,
  );
  
  // Wuy App specific bottom navigation bar theme
  static BottomNavigationBarThemeData get wuyBottomNavTheme => BottomNavigationBarThemeData(
    backgroundColor: wuySurfaceColor,
    selectedItemColor: wuyPrimaryColor,
    unselectedItemColor: wuyTextSecondary,
    type: BottomNavigationBarType.fixed,
    elevation: 8,
  );
  
  // Wuy App specific card theme
  static CardThemeData get wuyCardTheme => CardThemeData(
    color: wuyCardColor,
    elevation: 2,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(wuyCardBorderRadius),
    ),
    margin: EdgeInsets.symmetric(
      horizontal: wuyDefaultPadding,
      vertical: wuySmallPadding,
    ),
  );
  
  // Wuy App specific list tile theme
  static ListTileThemeData get wuyListTileTheme => ListTileThemeData(
    contentPadding: EdgeInsets.symmetric(
      horizontal: wuyDefaultPadding,
      vertical: wuySmallPadding,
    ),
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(wuyBorderRadius),
    ),
  );
  
  // Wuy App specific input decoration theme
  static InputDecorationTheme get wuyInputDecorationTheme => InputDecorationTheme(
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(wuyBorderRadius),
      borderSide: BorderSide(color: wuyTextSecondary),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(wuyBorderRadius),
      borderSide: BorderSide(color: wuyPrimaryColor, width: 2),
    ),
    contentPadding: EdgeInsets.symmetric(
      horizontal: wuyDefaultPadding,
      vertical: wuySmallPadding,
    ),
  );
  
  // Wuy App specific floating action button theme
  static FloatingActionButtonThemeData get wuyFabTheme => FloatingActionButtonThemeData(
    backgroundColor: wuyPrimaryColor,
    foregroundColor: Colors.white,
    elevation: 4,
  );
  
  // Wuy App specific divider theme
  static DividerThemeData get wuyDividerTheme => DividerThemeData(
    color: wuyTextSecondary.withOpacity(0.2),
    thickness: 1,
    space: 1,
  );
  
  // Wuy App specific icon theme
  static IconThemeData get wuyIconTheme => IconThemeData(
    color: wuyTextPrimary,
    size: 24,
  );
  
  static IconThemeData get wuyPrimaryIconTheme => IconThemeData(
    color: wuyPrimaryColor,
    size: 24,
  );
  
  static IconThemeData get wuySecondaryIconTheme => IconThemeData(
    color: wuyTextSecondary,
    size: 24,
  );
  
  // Wuy App specific text theme
  static TextTheme get wuyTextTheme => ThemeTextStyles.lightTextTheme.copyWith(
    bodyLarge: wuyFriendName,
    bodyMedium: ThemeTextStyles.bodyText2.copyWith(color: wuyTextSecondary),
    bodySmall: wuyNavLabel,
  );
  
  // Wuy App specific color scheme
  static ColorScheme get wuyColorScheme => ColorScheme.light(
    primary: wuyPrimaryColor,
    secondary: wuySecondaryColor,
    surface: wuySurfaceColor,
    background: wuyBackgroundColor,
    error: wuyErrorColor,
    onPrimary: Colors.white,
    onSecondary: Colors.white,
    onSurface: wuyTextPrimary,
    onBackground: wuyTextPrimary,
    onError: Colors.white,
  );
  
  // Wuy App specific theme data
  static ThemeData get wuyLightTheme => ThemeData(
    useMaterial3: true,
    colorScheme: wuyColorScheme,
    textTheme: wuyTextTheme,
    appBarTheme: wuyAppBarTheme,
    bottomNavigationBarTheme: wuyBottomNavTheme,
    cardTheme: wuyCardTheme,
    listTileTheme: wuyListTileTheme,
    inputDecorationTheme: wuyInputDecorationTheme,
    floatingActionButtonTheme: wuyFabTheme,
    dividerTheme: wuyDividerTheme,
    iconTheme: wuyIconTheme,
    primaryIconTheme: wuyPrimaryIconTheme,
    switchTheme: wuySwitchTheme,
    scaffoldBackgroundColor: wuyBackgroundColor,
    fontFamily: 'SF Pro Text',
  );
  
  // Wuy App specific dark theme
  static ThemeData get wuyDarkTheme => ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: wuyColorScheme.copyWith(
      brightness: Brightness.dark,
      surface: const Color(0xFF1C1C1E),
      background: const Color(0xFF000000),
      onSurface: Colors.white,
      onBackground: Colors.white,
    ),
    textTheme: ThemeTextStyles.darkTextTheme,
    appBarTheme: wuyAppBarTheme.copyWith(
      backgroundColor: const Color(0xFF1C1C1E),
    ),
    bottomNavigationBarTheme: wuyBottomNavTheme.copyWith(
      backgroundColor: const Color(0xFF1C1C1E),
    ),
    cardTheme: wuyCardTheme.copyWith(
      color: const Color(0xFF2C2C2E),
    ),
    scaffoldBackgroundColor: const Color(0xFF000000),
    fontFamily: 'SF Pro Text',
  );
  
  // Wuy App specific theme getter
  static ThemeData getWuyTheme({bool isDark = false}) {
    return isDark ? wuyDarkTheme : wuyLightTheme;
  }
  
  // Wuy App specific animation settings
  static bool get animationsEnabled => AppConfigAppWuy.enableAnimations;
  static int get animationDurationMs => AppConfigAppWuy.animationDurationMs;
}
