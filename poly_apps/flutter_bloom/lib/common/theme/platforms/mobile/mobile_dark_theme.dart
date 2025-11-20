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
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:chinese_font_library/chinese_font_library.dart';
import 'package:flutter_localization/flutter_localization.dart';

ThemeData getMobileDarkTheme() {
  final String langCode =
      FlutterLocalization.instance.currentLocale?.languageCode ?? 'en';
  final String fontFamily = langCode == 'zh' ? 'CN_font' : 'Roboto';
  TextTheme textTheme = TextTheme(
    displayLarge:
        TextStyle(fontWeight: FontWeight.w300, color: Color(0xFFE9DDFF)),
    displayMedium:
        TextStyle(fontWeight: FontWeight.w300, color: Color(0xFFE9DDFF)),
    displaySmall:
        TextStyle(fontWeight: FontWeight.w300, color: Color(0xFFE9DDFF)),
    bodyLarge: TextStyle(fontWeight: FontWeight.w300, color: Color(0xFFE9DDFF)),
  );
  if (!kIsWeb) {
    textTheme = langCode == 'zh'
        ? textTheme.useSystemChineseFont(Brightness.dark)
        : textTheme;
  }

  return ThemeData(
    fontFamily: fontFamily,
    primaryColor: const Color(0xFFB15EFF),
    disabledColor: const Color(0xFF5A5464),
    primaryColorDark: const Color(0xFF9A49FF),
    brightness: Brightness.dark,
    hintColor: const Color(0xFFBEA6DD),
    scaffoldBackgroundColor: const Color(0xFF1F1A2E),
    cardColor: const Color(0xFF2A2040),
    primaryColorLight: const Color(0xFF7C4DFF),
    canvasColor: const Color(0xFF261F35),
    shadowColor: const Color(0xFF0A0814),
    focusColor: const Color(0x33B15EFF),
    hoverColor: const Color(0x1AB15EFF),
    splashColor: const Color(0x33D9BAFF),
    highlightColor: const Color(0x40D9BAFF),
    secondaryHeaderColor: const Color(0xFF382D5E),
    unselectedWidgetColor: const Color(0xFF7A6A99),
    dividerColor: const Color(0xFF3F3152),
    colorScheme: const ColorScheme.dark(
        primary: Color(0xFFB15EFF),
        surface: Color(0xFF2A2040),
        error: Color(0xFFFF6B9E),
        secondary: Color(0xFFDA70D6),
        tertiary: Color(0xFFFF9DEA),
        tertiaryContainer: Color(0xFF462B59),
        secondaryContainer: Color(0xFF593976),
        onTertiary: Color(0xFFF0E6FF),
        onSecondary: Color(0xFFF0E6FF),
        onSecondaryContainer: Color(0xFFE9DDFF),
        onTertiaryContainer: Color(0xFFE9DDFF),
        outline: Color(0xFF7A58A3),
        onPrimaryContainer: Color(0xFFFFECFD),
        primaryContainer: Color(0xFF6A3DE8),
        onErrorContainer: Color(0xFFFFE6F0),
        onPrimary: Color(0xFF1F1A2E),
        surfaceTint: Color(0xFFC090FF),
        errorContainer: Color(0xFF52142E)),
    textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: const Color(0xFFD9BAFF))),
    elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFFB15EFF),
            foregroundColor: Colors.white,
            elevation: 3,
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8)))),
    textTheme: textTheme,
    appBarTheme: const AppBarTheme(
      backgroundColor: Color(0xFF2A1F3E),
      foregroundColor: Color(0xFFE9DDFF),
      elevation: 0,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: const Color(0xFF352A48),
      focusedBorder: OutlineInputBorder(
        borderSide: const BorderSide(color: Color(0xFFB15EFF), width: 1.5),
        borderRadius: BorderRadius.circular(8),
      ),
      enabledBorder: OutlineInputBorder(
        borderSide: const BorderSide(color: Color(0xFF7A58A3), width: 1.0),
        borderRadius: BorderRadius.circular(8),
      ),
      errorBorder: OutlineInputBorder(
        borderSide: const BorderSide(color: Color(0xFFFF6B9E), width: 1.0),
        borderRadius: BorderRadius.circular(8),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderSide: const BorderSide(color: Color(0xFFFF6B9E), width: 1.5),
        borderRadius: BorderRadius.circular(8),
      ),
    ),
    checkboxTheme: CheckboxThemeData(
      checkColor: WidgetStateProperty.all(Colors.white),
      fillColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return const Color(0xFFB15EFF);
        }
        return const Color(0xFF4A3863);
      }),
    ),
    floatingActionButtonTheme: const FloatingActionButtonThemeData(
      backgroundColor: Color(0xFFB15EFF),
      foregroundColor: Color(0xFFFFFFFF),
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: Color(0xFF1F1A2E),
      selectedItemColor: Color(0xFFD9BAFF),
      unselectedItemColor: Color(0xFF7A6A99),
      showSelectedLabels: true,
      showUnselectedLabels: true,
    ),
    cardTheme: CardThemeData(
      elevation: 3,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      color: const Color(0xFF2A2040),
      shadowColor: const Color(0xFF150F24),
    ),
    dividerTheme: const DividerThemeData(
      color: Color(0xFF3F3152),
      thickness: 1,
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: const Color(0xFF2A2040),
      elevation: 5,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
    tooltipTheme: TooltipThemeData(
      decoration: BoxDecoration(
        color: const Color(0xFFB15EFF).withAlpha(230),
        borderRadius: BorderRadius.circular(4),
      ),
      textStyle: const TextStyle(color: Color(0xFF1F1A2E)),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: Color(0xFFB15EFF),
      circularTrackColor: Color(0xFF4A3863),
      linearTrackColor: Color(0xFF4A3863),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return const Color(0xFFB15EFF);
        }
        return const Color(0xFF8E8E8E);
      }),
      trackColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return const Color(0xFF8A4FD1);
        }
        return const Color(0xFF484559);
      }),
    ),
    drawerTheme: const DrawerThemeData(
      backgroundColor: Color(0xFF1F1A2E),
    ),
    popupMenuTheme: PopupMenuThemeData(
      color: const Color(0xFF2A2040),
      elevation: 8,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
    ),
    snackBarTheme: const SnackBarThemeData(
      backgroundColor: Color(0xFF2A2040),
      contentTextStyle: TextStyle(color: Color(0xFFE9DDFF)),
      actionTextColor: Color(0xFFB15EFF),
    ), tabBarTheme: TabBarThemeData(indicatorColor: const Color(0xFFD9BAFF)),
  );
}
