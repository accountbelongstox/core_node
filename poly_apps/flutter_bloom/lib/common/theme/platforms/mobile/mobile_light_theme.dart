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

ThemeData getMobileLightTheme() {
  final String langCode =
      FlutterLocalization.instance.currentLocale?.languageCode ?? 'en';
  final String fontFamily = langCode == 'zh' ? 'CN_font' : 'Roboto';
  // final String fontFamily = 'SFProText';
  ThemeData themeData = ThemeData(
    fontFamily: fontFamily,
    primaryColor: const Color(0xFF4CAF50), // Mint Green
    disabledColor: const Color(0xFFAED581),
    primaryColorDark: const Color(0xFF2E7D32),
    brightness: Brightness.light,
    hintColor: const Color(0xFF81C784),
    scaffoldBackgroundColor: const Color(0xFFF1F8E9),
    cardColor: Colors.white,
    primaryColorLight: const Color(0xFFC8E6C9),
    canvasColor: const Color(0xFFF9FBE7),
    shadowColor: const Color(0x55CDDC39),
    focusColor: const Color(0x1F4CAF50),
    hoverColor: const Color(0x0D4CAF50),
    splashColor: const Color(0x334CAF50),
    highlightColor: const Color(0x66CDDC39),
    secondaryHeaderColor: const Color(0xFFF0F4C3),
    unselectedWidgetColor: const Color(0xFF9E9E9E),
    dividerColor: const Color(0xFFE6EE9C),
    colorScheme: const ColorScheme.light(
        primary: Color(0xFF4CAF50),
        surface: Color(0xFFF1F8E9),
        error: Color(0xFFFF5252),
        secondary: Color(0xFFCDDC39),
        tertiary: Color(0xFF8BC34A),
        tertiaryContainer: Color(0xFFF1F8E9),
        secondaryContainer: Color(0xFFF9FBE7),
        onTertiary: Color(0xFF33691E),
        onSecondary: Color(0xFF33691E),
        onSecondaryContainer: Color(0xFF33691E),
        onTertiaryContainer: Color(0xFF33691E),
        outline: Color(0xFFAED581),
        onPrimaryContainer: Color(0xFFFFFFFF),
        primaryContainer: Color(0xFF81C784),
        onErrorContainer: Color(0xFFFFFFFF),
        onPrimary: Color(0xFFFFFFFF),
        surfaceTint: Color(0xFF66BB6A),
        errorContainer: Color(0xFFFFCDD2)),
    textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: const Color(0xFF4CAF50))),
    elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF4CAF50),
            foregroundColor: Colors.white,
            elevation: 3,
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8)))),
    textTheme: TextTheme(
      displayLarge: TextStyle(
          fontFamily: fontFamily,
          fontWeight: FontWeight.w300,
          color: const Color(0xFF33691E)),
      displayMedium: TextStyle(
          fontFamily: fontFamily,
          fontWeight: FontWeight.w300,
          color: const Color(0xFF33691E)),
      displaySmall: TextStyle(
          fontFamily: fontFamily,
          fontWeight: FontWeight.w300,
          color: const Color(0xFF33691E)),
      bodyLarge: TextStyle(
          fontFamily: fontFamily,
          fontWeight: FontWeight.w300,
          color: const Color(0xFF33691E)),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: Color(0xFF4CAF50),
      foregroundColor: Colors.white,
      elevation: 0,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: const Color(0xFFF1F8E9),
      focusedBorder: OutlineInputBorder(
        borderSide: const BorderSide(color: Color(0xFF4CAF50), width: 1.5),
        borderRadius: BorderRadius.circular(8),
      ),
      enabledBorder: OutlineInputBorder(
        borderSide: const BorderSide(color: Color(0xFFAED581), width: 1.0),
        borderRadius: BorderRadius.circular(8),
      ),
      errorBorder: OutlineInputBorder(
        borderSide: const BorderSide(color: Color(0xFFFF5252), width: 1.0),
        borderRadius: BorderRadius.circular(8),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderSide: const BorderSide(color: Color(0xFFFF5252), width: 1.5),
        borderRadius: BorderRadius.circular(8),
      ),
    ),
    checkboxTheme: CheckboxThemeData(
      checkColor: WidgetStateProperty.all(Colors.white),
      fillColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return const Color(0xFF4CAF50);
        }
        return null;
      }),
    ),
    floatingActionButtonTheme: const FloatingActionButtonThemeData(
      backgroundColor: Color(0xFF4CAF50),
      foregroundColor: Colors.white,
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      selectedItemColor: Color(0xFF4CAF50),
      unselectedItemColor: Color(0xFF9E9E9E),
      showSelectedLabels: true,
      showUnselectedLabels: true,
    ),
    cardTheme: CardThemeData(
      elevation: 3,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      color: Colors.white,
      shadowColor: const Color(0xFFDCEDC8),
    ),
    dividerTheme: const DividerThemeData(
      color: Color(0xFFE6EE9C),
      thickness: 1,
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: Colors.white,
      elevation: 5,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
    tooltipTheme: TooltipThemeData(
      decoration: BoxDecoration(
        color: const Color(0xFF4CAF50).withAlpha(230),
        borderRadius: BorderRadius.circular(4),
      ),
      textStyle: const TextStyle(color: Colors.white),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: Color(0xFF4CAF50),
      circularTrackColor: Color(0xFFC8E6C9),
      linearTrackColor: Color(0xFFC8E6C9),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return const Color(0xFF4CAF50);
        }
        return Colors.white;
      }),
      trackColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return const Color(0xFFAED581);
        }
        return const Color(0xFFE0E0E0);
      }),
    ), tabBarTheme: TabBarThemeData(indicatorColor: const Color(0xFF4CAF50)),
  );
  if (!kIsWeb) {
    themeData = langCode == 'zh'
        ? themeData.useSystemChineseFont(Brightness.light)
        : themeData;
  }
  return themeData;
}
