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
import '../resources_app_wuy/assets_images_app_wuy.dart';

/// Wuy App Theme Configuration
/// Extends the common theme system with Wuy-specific customizations
class WuyAppThemeConfig {
  
  // Wuy App specific color overrides - matching the login entry screen design
  static const Color wuyPrimaryColor = Color(0xFF2196F3); // Blue
  static const Color wuySecondaryColor = Color(0xFFFF9800); // Orange
  static const Color wuyAccentColor = Color(0xFF4CAF50); // Green
  static const Color wuyBackgroundColor = Color(0xFFFFFFFF); // Pure white background
  static const Color wuySurfaceColor = Color(0xFFFFFFFF);
  static const Color wuyCardColor = Color(0xFFFFFFFF);
  
  // Gradient colors for login entry screen - more colorful
  static const Color wuyGradientStart = Color(0xFFE1F5FE); // Very light blue
  static const Color wuyGradientMiddle = Color(0xFFB3E5FC); // Light blue
  static const Color wuyGradientEnd = Color(0xFF81D4FA); // Medium blue
  
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
  
  // Input field colors for login-register page
  static const Color wuyInputBorderDefault = Color(0xFFE0E0E0); // Light gray border
  static const Color wuyInputBorderFocused = Color(0xFFB0BEC5); // Darker border when focused
  static const Color wuyInputFillDefault = Color(0xFFFAFAFA); // Light background
  static const Color wuyInputFillFocused = Color(0xFFF5F5F5); // Light background when focused
  
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
  
  // Login entry screen gradient background - more colorful with multiple stops
  static const LinearGradient wuyLoginEntryGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    stops: [0.0, 0.5, 1.0],
    colors: [
      wuyGradientStart,
      wuyGradientMiddle,
      wuyGradientEnd,
    ],
  );
  
  // Logo gradient
  static const LinearGradient wuyLogoGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFF2196F3),
      Color(0xFF1976D2),
    ],
  );
  
  // Background image decoration - matching HTML design
  static BoxDecoration get wuyBackgroundDecoration => BoxDecoration(
    color: Colors.white, // White background color
    image: const DecorationImage(
      image: AssetImage(WuyAppAssetsImages.background),
      fit: BoxFit.contain, // Match HTML background-size: contain
      alignment: Alignment.topCenter, // Top 0, centered
      repeat: ImageRepeat.noRepeat, // No repeat
    ),
  );
  
  // Login entry specific colors matching HTML
  static const Color wuyTextMain = Color(0xFF222222); // --text-main
  static const Color wuyTextSub = Color(0xFF555555); // --text-sub
  static const Color wuyMuted = Color(0xFF8FA3B8); // --muted
  static const Color wuyBorder = Color(0xFFE6EDF5); // --border
  static const Color wuyPrimaryEnd = Color(0xFF2F7BF3); // --primary-end
  
  // Login entry specific gradients matching HTML
  static const LinearGradient wuyLoginButtonGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      wuyPrimaryColor, // #1a73e8
      wuyPrimaryEnd,   // #2f7bf3
    ],
  );
  
  // Button gradients for login-register page
  static const LinearGradient wuyButtonGradientEnabled = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFF2196F3), // Blue
      Color(0xFF1976D2), // Dark blue
      Color(0xFF4CAF50), // Green
    ],
    stops: [0.0, 0.6, 1.0],
  );
  
  static const LinearGradient wuyButtonGradientDisabled = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFFBBDEFB), // Light blue
      Color(0xFFE3F2FD), // Lighter blue
      Color(0xFFC8E6C9), // Light green
    ],
    stops: [0.0, 0.6, 1.0],
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
    thumbColor: WidgetStateProperty.resolveWith<Color>((states) {
      if (states.contains(WidgetState.selected)) {
        return wuyPrimaryColor;
      }
      return ThemeColors.greyColor;
    }),
    trackColor: WidgetStateProperty.resolveWith<Color>((states) {
      if (states.contains(WidgetState.selected)) {
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
    error: wuyErrorColor,
    onPrimary: Colors.white,
    onSecondary: Colors.white,
    onSurface: wuyTextPrimary,
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
      onSurface: Colors.white,
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
