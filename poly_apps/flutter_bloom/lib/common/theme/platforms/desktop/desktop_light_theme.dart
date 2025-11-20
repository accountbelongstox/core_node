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

ThemeData getDesktopLightTheme() {
  final String langCode =
      FlutterLocalization.instance.currentLocale?.languageCode ?? 'en';
  final String fontFamily = langCode == 'zh' ? 'CN_font' : 'Roboto';

  ThemeData themeData = ThemeData(
    fontFamily: fontFamily,
    brightness: Brightness.light,
    primaryColor: const Color(0xFF0078D4), // Microsoft Blue
    primaryColorDark: const Color(0xFF005A9E),
    primaryColorLight: const Color(0xFFE3F2FD),
    scaffoldBackgroundColor: const Color(0xFFFAFAFA), // Light gray background
    cardColor: Colors.white,
    canvasColor: Colors.white,
    shadowColor: const Color(0x1F000000),
    focusColor: const Color(0xFF0078D4).withAlpha((255 * 0.12).round()),
    hoverColor: const Color(0xFF0078D4).withAlpha((255 * 0.04).round()),
    splashColor: const Color(0xFF0078D4).withAlpha((255 * 0.12).round()),
    highlightColor: const Color(0xFF0078D4).withAlpha((255 * 0.12).round()),
    disabledColor: const Color(0xFFBDBDBD),
    secondaryHeaderColor: const Color(0xFFF5F5F5),
    unselectedWidgetColor: const Color(0xFF757575),
    dividerColor: const Color(0xFFE0E0E0),
    colorScheme: const ColorScheme.light(
      primary: Color(0xFF0078D4),
      surface: Colors.white,
      error: Color(0xFFD32F2F),
      secondary: Color(0xFF00BCF2),
      tertiary: Color(0xFF00CC6A),
      tertiaryContainer: Color(0xFFE8F5E8),
      secondaryContainer: Color(0xFFE3F2FD),
      onTertiary: Colors.white,
      onSecondary: Colors.white,
      onSecondaryContainer: Color(0xFF0078D4),
      onTertiaryContainer: Color(0xFF00CC6A),
      outline: Color(0xFFBDBDBD),
      onPrimaryContainer: Color(0xFF0078D4),
      primaryContainer: Color(0xFFE3F2FD),
      onErrorContainer: Colors.white,
      onPrimary: Colors.white,
      surfaceTint: Color(0xFF0078D4),
      errorContainer: Color(0xFFFFEBEE),
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
        color: const Color(0xFF212121),
        fontSize: 32,
      ),
      displayMedium: TextStyle(
        fontFamily: fontFamily,
        fontWeight: FontWeight.w300,
        color: const Color(0xFF212121),
        fontSize: 28,
      ),
      displaySmall: TextStyle(
        fontFamily: fontFamily,
        fontWeight: FontWeight.w300,
        color: const Color(0xFF212121),
        fontSize: 24,
      ),
      bodyLarge: TextStyle(
        fontFamily: fontFamily,
        fontWeight: FontWeight.w400,
        color: const Color(0xFF424242),
        fontSize: 16,
      ),
      bodyMedium: TextStyle(
        fontFamily: fontFamily,
        fontWeight: FontWeight.w400,
        color: const Color(0xFF424242),
        fontSize: 14,
      ),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.white,
      foregroundColor: Color(0xFF212121),
      elevation: 1,
      shadowColor: Color(0x1F000000),
      titleTextStyle: TextStyle(
        color: Color(0xFF212121),
        fontSize: 20,
        fontWeight: FontWeight.w500,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: const Color(0xFFF5F5F5),
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      focusedBorder: OutlineInputBorder(
        borderSide: const BorderSide(color: Color(0xFF0078D4), width: 2.0),
        borderRadius: BorderRadius.circular(4),
      ),
      enabledBorder: OutlineInputBorder(
        borderSide: const BorderSide(color: Color(0xFFBDBDBD), width: 1.0),
        borderRadius: BorderRadius.circular(4),
      ),
      errorBorder: OutlineInputBorder(
        borderSide: const BorderSide(color: Color(0xFFD32F2F), width: 1.0),
        borderRadius: BorderRadius.circular(4),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderSide: const BorderSide(color: Color(0xFFD32F2F), width: 2.0),
        borderRadius: BorderRadius.circular(4),
      ),
    ),
    checkboxTheme: CheckboxThemeData(
      checkColor: WidgetStateProperty.all(Colors.white),
      fillColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return const Color(0xFF0078D4);
        }
        return Colors.transparent;
      }),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(2)),
    ),
    floatingActionButtonTheme: const FloatingActionButtonThemeData(
      backgroundColor: Color(0xFF0078D4),
      foregroundColor: Colors.white,
      elevation: 6,
    ),
    navigationRailTheme: const NavigationRailThemeData(
      backgroundColor: Colors.white,
      selectedIconTheme: IconThemeData(color: Color(0xFF0078D4)),
      unselectedIconTheme: IconThemeData(color: Color(0xFF757575)),
      selectedLabelTextStyle: TextStyle(color: Color(0xFF0078D4)),
      unselectedLabelTextStyle: TextStyle(color: Color(0xFF757575)),
    ),
    cardTheme: CardThemeData(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      color: Colors.white,
      shadowColor: const Color(0x1F000000),
    ),
    dividerTheme: const DividerThemeData(
      color: Color(0xFFE0E0E0),
      thickness: 1,
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: Colors.white,
      elevation: 8,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      titleTextStyle: const TextStyle(
        color: Color(0xFF212121),
        fontSize: 20,
        fontWeight: FontWeight.w500,
      ),
    ),
    tooltipTheme: TooltipThemeData(
      decoration: BoxDecoration(
        color: const Color(0xFF616161),
        borderRadius: BorderRadius.circular(4),
      ),
      textStyle: const TextStyle(color: Colors.white),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: Color(0xFF0078D4),
      circularTrackColor: Color(0xFFE0E0E0),
      linearTrackColor: Color(0xFFE0E0E0),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return const Color(0xFF0078D4);
        }
        return Colors.white;
      }),
      trackColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return const Color(0xFFE3F2FD);
        }
        return const Color(0xFFE0E0E0);
      }),
    ),
    menuTheme: MenuThemeData(
      style: MenuStyle(
        backgroundColor: WidgetStateProperty.all(Colors.white),
        elevation: WidgetStateProperty.all(4),
        shape: WidgetStateProperty.all(
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
        ),
      ),
    ),
    popupMenuTheme: PopupMenuThemeData(
      color: Colors.white,
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
      textStyle: const TextStyle(color: Color(0xFF212121)),
    ), tabBarTheme: TabBarThemeData(indicatorColor: const Color(0xFF0078D4)),
  );

  if (!kIsWeb) {
    themeData = langCode == 'zh'
        ? themeData.useSystemChineseFont(Brightness.light)
        : themeData;
  }
  return themeData;
}
