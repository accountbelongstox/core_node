import 'package:flutter/material.dart';

import 'colors_app_codemart.dart';
import 'text_styles_app_codemart.dart';

class CodemartTheme {
  static ThemeData light() {
    return _buildTheme(Brightness.light);
  }

  static ThemeData dark() {
    return _buildTheme(Brightness.dark);
  }

  static ThemeData _buildTheme(Brightness brightness) {
    final bool isDark = brightness == Brightness.dark;
    final Color backgroundColor = isDark ? CodemartColors.midnight : const Color(0xFFF4F7FF);
    final Color surfaceColor = isDark ? CodemartColors.surface : Colors.white;
    final Color elevatedSurface = isDark ? CodemartColors.surfaceElevated : const Color(0xFFE7EDFF);

    final ColorScheme scheme = ColorScheme(
      brightness: brightness,
      primary: CodemartColors.primary,
      onPrimary: CodemartColors.textPrimary,
      secondary: CodemartColors.secondary,
      onSecondary: CodemartColors.midnight,
      error: CodemartColors.danger,
      onError: CodemartColors.textPrimary,
      background: backgroundColor,
      onBackground: isDark ? CodemartColors.textPrimary : const Color(0xFF0F172A),
      surface: surfaceColor,
      onSurface: isDark ? CodemartColors.textPrimary : const Color(0xFF11172C),
      surfaceVariant: elevatedSurface,
      onSurfaceVariant: CodemartColors.textSecondary,
      tertiary: CodemartColors.accent,
      onTertiary: CodemartColors.textPrimary,
      outline: CodemartColors.outline,
    );

    final TextTheme baseText = ThemeData(brightness: brightness).textTheme;

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      fontFamily: 'Inter',
      colorScheme: scheme,
      scaffoldBackgroundColor: backgroundColor,
      appBarTheme: AppBarTheme(
        elevation: 0,
        centerTitle: false,
        backgroundColor: Colors.transparent,
        foregroundColor: scheme.onBackground,
        titleTextStyle: CodemartTextStyles.sectionTitle.copyWith(fontSize: 20),
      ),
      textTheme: baseText.copyWith(
        displayLarge: CodemartTextStyles.heroTitle,
        displayMedium: CodemartTextStyles.sectionTitle,
        titleLarge: CodemartTextStyles.sectionTitle,
        bodyLarge: CodemartTextStyles.body,
        bodyMedium: CodemartTextStyles.body,
        labelLarge: CodemartTextStyles.buttonLarge,
      ),
      cardTheme: CardThemeData(
        color: surfaceColor.withOpacity(isDark ? 0.9 : 1),
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(
            color: CodemartColors.outline.withOpacity(isDark ? 0.6 : 0.2),
          ),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ButtonStyle(
          padding: const MaterialStatePropertyAll<EdgeInsets>(
            EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          ),
          elevation: const MaterialStatePropertyAll<double>(0),
          shape: MaterialStatePropertyAll<RoundedRectangleBorder>(
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          ),
          backgroundColor: MaterialStatePropertyAll<Color>(CodemartColors.primary),
          foregroundColor: MaterialStatePropertyAll<Color>(CodemartColors.textPrimary),
          overlayColor: MaterialStatePropertyAll<Color>(
            CodemartColors.textPrimary.withOpacity(0.08),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: ButtonStyle(
          padding: const MaterialStatePropertyAll<EdgeInsets>(
            EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          ),
          shape: MaterialStatePropertyAll<RoundedRectangleBorder>(
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          ),
          side: MaterialStatePropertyAll<BorderSide>(
            BorderSide(color: CodemartColors.outline),
          ),
          foregroundColor: MaterialStatePropertyAll<Color>(CodemartColors.textPrimary),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: ButtonStyle(
          foregroundColor: MaterialStatePropertyAll<Color>(CodemartColors.secondary),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surfaceColor.withOpacity(isDark ? 0.9 : 0.7),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: CodemartColors.outline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: CodemartColors.outline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(
            color: CodemartColors.secondary,
            width: 1.6,
          ),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
        labelStyle: CodemartTextStyles.bodyMuted,
        hintStyle: CodemartTextStyles.bodyMuted,
      ),
      chipTheme: ChipThemeData(
        backgroundColor: CodemartColors.surfaceHover,
        selectedColor: CodemartColors.primary,
        labelStyle: CodemartTextStyles.bodyMuted,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(30),
          side: BorderSide(color: CodemartColors.outline),
        ),
      ),
      dividerColor: CodemartColors.outline.withOpacity(0.5),
      switchTheme: SwitchThemeData(
        thumbColor: MaterialStateProperty.resolveWith<Color>(
          (Set<MaterialState> states) =>
              states.contains(MaterialState.selected) ? CodemartColors.secondary : CodemartColors.textSecondary,
        ),
        trackColor: MaterialStateProperty.resolveWith<Color>(
          (Set<MaterialState> states) => states.contains(MaterialState.selected)
              ? CodemartColors.secondary.withOpacity(0.4)
              : CodemartColors.outline.withOpacity(0.5),
        ),
      ),
    );
  }
}
