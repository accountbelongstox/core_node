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

ThemeData getWebDarkTheme() {
  final String langCode =
      FlutterLocalization.instance.currentLocale?.languageCode ?? 'en';
  final String fontFamily = langCode == 'zh' ? 'CN_font' : 'Roboto';

  ThemeData themeData = ThemeData(
    fontFamily: fontFamily,
    brightness: Brightness.dark,
    primaryColor: const Color(0xFF8AFF00),
    primaryColorDark: const Color(0xFF1A1A2E),
    primaryColorLight: const Color(0xFF23233A),
    scaffoldBackgroundColor: const Color(0xFF10101A),
    cardColor: const Color(0xFF181828),
    canvasColor: const Color(0xFF181828),
    shadowColor: const Color(0xFF23233A),
    focusColor: const Color(0xFF8AFF00).withAlpha((255 * 0.12).round()),
    hoverColor: const Color(0xFF8AFF00).withAlpha((255 * 0.08).round()),
    splashColor: const Color(0xFF8AFF00).withAlpha((255 * 0.16).round()),
    highlightColor: const Color(0xFF8AFF00).withAlpha((255 * 0.24).round()),
    disabledColor: const Color(0xFF44445A),
    secondaryHeaderColor: const Color(0xFF23233A),
    unselectedWidgetColor: const Color(0xFF8888A0),
    dividerColor: const Color(0xFF23233A),
    colorScheme: const ColorScheme.dark(
      primary: Color(0xFF8AFF00),
      surface: Color(0xFF181828),
      error: Color(0xFFFF4081),
      secondary: Color(0xFF00E0FF),
      tertiary: Color(0xFF8AFF00),
      tertiaryContainer: Color(0xFF23233A),
      secondaryContainer: Color(0xFF23233A),
      onTertiary: Color(0xFF8AFF00),
      onSecondary: Color(0xFF00E0FF),
      onSecondaryContainer: Color(0xFF23233A),
      onTertiaryContainer: Color(0xFF23233A),
      outline: Color(0xFF23233A),
      onPrimaryContainer: Color(0xFF10101A),
      primaryContainer: Color(0xFF23233A),
      onErrorContainer: Color(0xFF23233A),
      onPrimary: Color(0xFF10101A),
      surfaceTint: Color(0xFF8AFF00),
      errorContainer: Color(0xFFFF4081),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: const Color(0xFF8AFF00)),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: const Color(0xFF8AFF00),
        foregroundColor: Colors.black,
        elevation: 3,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
        ),
      ),
    ),
    textTheme: TextTheme(
      displayLarge: TextStyle(
        fontFamily: fontFamily,
        fontWeight: FontWeight.w300,
        color: const Color(0xFFE0E0E0),
      ),
      displayMedium: TextStyle(
        fontFamily: fontFamily,
        fontWeight: FontWeight.w300,
        color: const Color(0xFFE0E0E0),
      ),
      displaySmall: TextStyle(
        fontFamily: fontFamily,
        fontWeight: FontWeight.w300,
        color: const Color(0xFFE0E0E0),
      ),
      bodyLarge: TextStyle(
        fontFamily: fontFamily,
        fontWeight: FontWeight.w300,
        color: const Color(0xFFB0B0C0),
      ),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: Color(0xFF181828),
      foregroundColor: Colors.white,
      elevation: 0,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: const Color(0xFF23233A),
      focusedBorder: OutlineInputBorder(
        borderSide: const BorderSide(color: Color(0xFF8AFF00), width: 1.5),
        borderRadius: BorderRadius.circular(8),
      ),
      enabledBorder: OutlineInputBorder(
        borderSide: const BorderSide(color: Color(0xFF23233A), width: 1.0),
        borderRadius: BorderRadius.circular(8),
      ),
      errorBorder: OutlineInputBorder(
        borderSide: const BorderSide(color: Color(0xFFFF4081), width: 1.0),
        borderRadius: BorderRadius.circular(8),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderSide: const BorderSide(color: Color(0xFFFF4081), width: 1.5),
        borderRadius: BorderRadius.circular(8),
      ),
    ),
    checkboxTheme: CheckboxThemeData(
      checkColor: WidgetStateProperty.all(Colors.black),
      fillColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return const Color(0xFF8AFF00);
        }
        return null;
      }),
    ),
    floatingActionButtonTheme: const FloatingActionButtonThemeData(
      backgroundColor: Color(0xFF8AFF00),
      foregroundColor: Colors.black,
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: Color(0xFF181828),
      selectedItemColor: Color(0xFF8AFF00),
      unselectedItemColor: Color(0xFF8888A0),
      showSelectedLabels: true,
      showUnselectedLabels: true,
    ),
    cardTheme: CardThemeData(
      elevation: 3,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      color: const Color(0xFF181828),
      shadowColor: const Color(0xFF23233A),
    ),
    dividerTheme: const DividerThemeData(
      color: Color(0xFF23233A),
      thickness: 1,
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: const Color(0xFF181828),
      elevation: 5,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
    tooltipTheme: TooltipThemeData(
      decoration: BoxDecoration(
        color: const Color(0xFF23233A).withAlpha(230),
        borderRadius: BorderRadius.circular(4),
      ),
      textStyle: const TextStyle(color: Colors.white),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: Color(0xFF8AFF00),
      circularTrackColor: Color(0xFF23233A),
      linearTrackColor: Color(0xFF23233A),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return const Color(0xFF8AFF00);
        }
        return Colors.white;
      }),
      trackColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return const Color(0xFF23233A);
        }
        return const Color(0xFF23233A);
      }),
    ),
    tabBarTheme: TabBarThemeData(indicatorColor: const Color(0xFF8AFF00)),
  );
  if (!kIsWeb) {
    themeData = langCode == 'zh'
        ? themeData.useSystemChineseFont(Brightness.dark)
        : themeData;
  }
  return themeData;
}
