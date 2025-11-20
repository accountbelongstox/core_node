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
import 'package:chinese_font_library/chinese_font_library.dart';
import 'package:flutter_localization/flutter_localization.dart';
import 'package:flutter/foundation.dart' show kIsWeb;

ThemeData getDesktopDarkTheme() {
  final String langCode =
      FlutterLocalization.instance.currentLocale?.languageCode ?? 'en';
  final String fontFamily = langCode == 'zh' ? 'CN_font' : 'Roboto';

  ThemeData themeData = ThemeData(
    fontFamily: fontFamily,
    brightness: Brightness.dark,
    primaryColor: const Color(0xFF0078D4), // Microsoft Blue
    primaryColorDark: const Color(0xFF005A9E),
    primaryColorLight: const Color(0xFF40E0FF),
    scaffoldBackgroundColor: const Color(0xFF1E1E1E), // VS Code dark background
    cardColor: const Color(0xFF2D2D30), // VS Code card color
    canvasColor: const Color(0xFF252526), // VS Code canvas
    shadowColor: const Color(0xFF000000),
    focusColor: const Color(0xFF0078D4).withAlpha((255 * 0.12).round()),
    hoverColor: const Color(0xFF0078D4).withAlpha((255 * 0.08).round()),
    splashColor: const Color(0xFF0078D4).withAlpha((255 * 0.16).round()),
    highlightColor: const Color(0xFF0078D4).withAlpha((255 * 0.24).round()),
    disabledColor: const Color(0xFF6E6E6E),
    secondaryHeaderColor: const Color(0xFF3C3C3C),
    unselectedWidgetColor: const Color(0xFF9E9E9E),
    dividerColor: const Color(0xFF3C3C3C),
    colorScheme: const ColorScheme.dark(
      primary: Color(0xFF0078D4),
      surface: Color(0xFF2D2D30),
      error: Color(0xFFE74856),
      secondary: Color(0xFF00BCF2),
      tertiary: Color(0xFF00CC6A),
      tertiaryContainer: Color(0xFF3C3C3C),
      secondaryContainer: Color(0xFF3C3C3C),
      onTertiary: Color(0xFF1E1E1E),
      onSecondary: Color(0xFF1E1E1E),
      onSecondaryContainer: Color(0xFFE1E1E1),
      onTertiaryContainer: Color(0xFFE1E1E1),
      outline: Color(0xFF6E6E6E),
      onPrimaryContainer: Color(0xFFFFFFFF),
      primaryContainer: Color(0xFF005A9E),
      onErrorContainer: Color(0xFFFFFFFF),
      onPrimary: Color(0xFFFFFFFF),
      surfaceTint: Color(0xFF40E0FF),
      errorContainer: Color(0xFFB91C1C),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: const Color(0xFF0078D4),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: const Color(0xFF0078D4),
        foregroundColor: Colors.white,
        elevation: 2,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(4),
        ),
      ),
    ),
    textTheme: TextTheme(
      displayLarge: TextStyle(
        fontFamily: fontFamily,
        fontWeight: FontWeight.w300,
        color: const Color(0xFFE1E1E1),
        fontSize: 32,
      ),
      displayMedium: TextStyle(
        fontFamily: fontFamily,
        fontWeight: FontWeight.w300,
        color: const Color(0xFFE1E1E1),
        fontSize: 28,
      ),
      displaySmall: TextStyle(
        fontFamily: fontFamily,
        fontWeight: FontWeight.w300,
        color: const Color(0xFFE1E1E1),
        fontSize: 24,
      ),
      bodyLarge: TextStyle(
        fontFamily: fontFamily,
        fontWeight: FontWeight.w400,
        color: const Color(0xFFCCCCCC),
        fontSize: 16,
      ),
      bodyMedium: TextStyle(
        fontFamily: fontFamily,
        fontWeight: FontWeight.w400,
        color: const Color(0xFFCCCCCC),
        fontSize: 14,
      ),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: Color(0xFF2D2D30),
      foregroundColor: Color(0xFFE1E1E1),
      elevation: 0,
      titleTextStyle: TextStyle(
        color: Color(0xFFE1E1E1),
        fontSize: 20,
        fontWeight: FontWeight.w500,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: const Color(0xFF3C3C3C),
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      focusedBorder: OutlineInputBorder(
        borderSide: const BorderSide(color: Color(0xFF0078D4), width: 2.0),
        borderRadius: BorderRadius.circular(4),
      ),
      enabledBorder: OutlineInputBorder(
        borderSide: const BorderSide(color: Color(0xFF6E6E6E), width: 1.0),
        borderRadius: BorderRadius.circular(4),
      ),
      errorBorder: OutlineInputBorder(
        borderSide: const BorderSide(color: Color(0xFFE74856), width: 1.0),
        borderRadius: BorderRadius.circular(4),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderSide: const BorderSide(color: Color(0xFFE74856), width: 2.0),
        borderRadius: BorderRadius.circular(4),
      ),
    ),
    checkboxTheme: CheckboxThemeData(
      checkColor: WidgetStateProperty.all(Colors.white),
      fillColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return const Color(0xFF0078D4);
        }
        return const Color(0xFF6E6E6E);
      }),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(2)),
    ),
    floatingActionButtonTheme: const FloatingActionButtonThemeData(
      backgroundColor: Color(0xFF0078D4),
      foregroundColor: Colors.white,
      elevation: 4,
    ),
    navigationRailTheme: const NavigationRailThemeData(
      backgroundColor: Color(0xFF2D2D30),
      selectedIconTheme: IconThemeData(color: Color(0xFF0078D4)),
      unselectedIconTheme: IconThemeData(color: Color(0xFF9E9E9E)),
      selectedLabelTextStyle: TextStyle(color: Color(0xFF0078D4)),
      unselectedLabelTextStyle: TextStyle(color: Color(0xFF9E9E9E)),
    ),
    cardTheme: CardThemeData(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      color: const Color(0xFF2D2D30),
      shadowColor: const Color(0xFF000000),
    ),
    dividerTheme: const DividerThemeData(
      color: Color(0xFF3C3C3C),
      thickness: 1,
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: const Color(0xFF2D2D30),
      elevation: 8,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      titleTextStyle: const TextStyle(
        color: Color(0xFFE1E1E1),
        fontSize: 20,
        fontWeight: FontWeight.w500,
      ),
    ),
    tooltipTheme: TooltipThemeData(
      decoration: BoxDecoration(
        color: const Color(0xFF3C3C3C),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: const Color(0xFF6E6E6E)),
      ),
      textStyle: const TextStyle(color: Color(0xFFE1E1E1)),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: Color(0xFF0078D4),
      circularTrackColor: Color(0xFF6E6E6E),
      linearTrackColor: Color(0xFF6E6E6E),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return const Color(0xFF0078D4);
        }
        return const Color(0xFF9E9E9E);
      }),
      trackColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return const Color(0xFF005A9E);
        }
        return const Color(0xFF6E6E6E);
      }),
    ),
    menuTheme: MenuThemeData(
      style: MenuStyle(
        backgroundColor: WidgetStateProperty.all(const Color(0xFF2D2D30)),
        elevation: WidgetStateProperty.all(4),
        shape: WidgetStateProperty.all(
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
        ),
      ),
    ),
    popupMenuTheme: PopupMenuThemeData(
      color: const Color(0xFF2D2D30),
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
      textStyle: const TextStyle(color: Color(0xFFE1E1E1)),
    ), tabBarTheme: TabBarThemeData(indicatorColor: const Color(0xFF0078D4)),
  );

  if (!kIsWeb) {
    themeData = langCode == 'zh'
        ? themeData.useSystemChineseFont(Brightness.dark)
        : themeData;
  }
  return themeData;
}
