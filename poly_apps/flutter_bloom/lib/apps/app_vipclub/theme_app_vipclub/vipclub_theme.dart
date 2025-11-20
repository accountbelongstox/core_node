import 'package:chinese_font_library/chinese_font_library.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_localization/flutter_localization.dart';
import 'package:qyflutter/common/theme/compatibility/gradient_compatibility.dart';

const Color _vipCamoDeep = Color(0xFF0D1B1E);
const Color _vipCamoDark = Color(0xFF142327);
const Color _vipCamoOlive = Color(0xFF1F2F24);
const Color _vipCamoSage = Color(0xFF3A4B38);
const Color _vipCamoField = Color(0xFF4B6043);
const Color _vipSand = Color(0xFFC0A676);
const Color _vipSandSoft = Color(0xFF9B8B67);
const Color _vipAir = Color(0xFF4DA1A9);
const Color _vipGold = Color(0xFFF7D488);
const Color _vipAmber = Color(0xFFFCCC62);
const Color _vipAlert = Color(0xFFF0544F);
const Color _vipGlow = Color(0xFF8FE388);
const Color _vipSurfaceDark = Color(0xFF101A1C);
const Color _vipSurfaceLight = Color(0xFFF5F1E8);
const Color _vipTextPrimary = Color(0xFFF5F1E8);
const Color _vipTextSecondary = Color(0xFFD3CDBF);
const Color _vipTextMuted = Color(0xFF9BA6A3);
const Color _vipOutline = Color(0xFF2F3C34);
const double _vipBaseRadius = 18.0;
const double _vipCardRadius = 26.0;
const double _vipButtonHeight = 48.0;
const double _vipBorderWidth = 1.2;

class VipClubTheme {
  const VipClubTheme._();

  static ThemeData light() {
    return _buildTheme(Brightness.light);
  }

  static ThemeData dark() {
    return _buildTheme(Brightness.dark);
  }

  static List<ThemeExtension<dynamic>> lightExtensions() {
    return <ThemeExtension<dynamic>>[
      GradientLight(
        primaryVertical: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: <Color>[_vipGold, _vipAir],
        ),
        primaryHorizontal: const LinearGradient(
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
          colors: <Color>[_vipGold, _vipGlow],
        ),
        buttonGradient: const LinearGradient(
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
          colors: <Color>[_vipGlow, _vipAir],
        ),
        cardGradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: <Color>[_vipSurfaceLight, Color(0xFFE3DCCB)],
        ),
        subtleBackground: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: <Color>[Color(0xFFF6F2E6), Color(0xFFEAE4D4)],
        ),
        purpleToPink: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: <Color>[_vipAir, _vipGold],
        ),
        purpleToBlue: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: <Color>[_vipAir, _vipGlow],
        ),
        tripleGradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          stops: <double>[0.0, 0.5, 1.0],
          colors: <Color>[_vipGlow, _vipGold, _vipAir],
        ),
      ),
    ];
  }

  static List<ThemeExtension<dynamic>> darkExtensions() {
    return <ThemeExtension<dynamic>>[
      GradientDark(
        primaryVertical: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: <Color>[_vipCamoOlive, _vipCamoDark],
        ),
        primaryHorizontal: const LinearGradient(
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
          colors: <Color>[_vipGlow, _vipGold],
        ),
        buttonGradient: const LinearGradient(
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
          colors: <Color>[_vipGlow, _vipGold],
        ),
        cardGradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: <Color>[_vipCamoDark, _vipCamoOlive],
        ),
        subtleBackground: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: <Color>[_vipCamoDeep, _vipSurfaceDark],
        ),
        purpleToPink: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: <Color>[_vipAir, _vipAlert],
        ),
        purpleToBlue: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: <Color>[_vipAir, _vipGlow],
        ),
        tripleGradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          stops: <double>[0.0, 0.5, 1.0],
          colors: <Color>[_vipCamoOlive, _vipGlow, _vipGold],
        ),
      ),
    ];
  }

  static ThemeData _buildTheme(Brightness brightness) {
    final bool isDark = brightness == Brightness.dark;
    final Color backgroundColor = isDark ? _vipCamoDeep : _vipSurfaceLight;
    final Color surfaceColor = isDark ? _vipSurfaceDark : Colors.white;
    final Color onSurface = isDark ? _vipTextPrimary : _vipCamoDark;
    final Color secondarySurface = isDark ? _vipCamoDark : const Color(0xFFF4EEE0);
    final String langCode =
        FlutterLocalization.instance.currentLocale?.languageCode ?? 'en';
    final String fontFamily = langCode == 'zh' ? 'CN_font' : 'Roboto';
    TextTheme textTheme = _buildTextTheme(
      brightness: brightness,
      fontFamily: fontFamily,
      textColor: onSurface,
    );
    if (!kIsWeb && langCode == 'zh') {
      textTheme = textTheme.useSystemChineseFont(brightness);
    }

    final ColorScheme scheme = _buildColorScheme(brightness);
    final ButtonStyle filledButtonStyle = ButtonStyle(
      minimumSize:
          WidgetStateProperty.all(const Size.fromHeight(_vipButtonHeight)),
      padding: WidgetStateProperty.all(
        const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
      ),
      shape: WidgetStateProperty.all(
        RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      ),
      backgroundColor: WidgetStateProperty.resolveWith((Set<WidgetState> s) {
        if (s.contains(WidgetState.disabled)) {
          return _vipTextMuted.withOpacity(0.25);
        }
        return _vipGold;
      }),
      foregroundColor: WidgetStateProperty.all(_vipCamoDark),
      overlayColor: WidgetStateProperty.all(_vipGlow.withOpacity(0.16)),
      elevation: WidgetStateProperty.all(isDark ? 6 : 2),
    );

    final ButtonStyle outlinedButtonStyle = ButtonStyle(
      minimumSize:
          WidgetStateProperty.all(const Size.fromHeight(_vipButtonHeight)),
      padding: WidgetStateProperty.all(
        const EdgeInsets.symmetric(horizontal: 26, vertical: 14),
      ),
      shape: WidgetStateProperty.all(
        RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      ),
      side: WidgetStateProperty.resolveWith((Set<WidgetState> s) {
        if (s.contains(WidgetState.disabled)) {
          return BorderSide(color: _vipTextMuted.withOpacity(0.3));
        }
        return const BorderSide(color: _vipGlow, width: _vipBorderWidth);
      }),
      foregroundColor: WidgetStateProperty.all(_vipGlow),
      overlayColor: WidgetStateProperty.all(_vipGlow.withOpacity(0.08)),
    );

    final ButtonStyle textButtonStyle = ButtonStyle(
      padding: WidgetStateProperty.all(
        const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      ),
      foregroundColor: WidgetStateProperty.all(_vipGold),
      overlayColor: WidgetStateProperty.all(_vipGlow.withOpacity(0.1)),
    );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      fontFamily: fontFamily,
      textTheme: textTheme,
      scaffoldBackgroundColor: backgroundColor,
      canvasColor: surfaceColor,
      primaryColor: _vipGold,
      colorScheme: scheme,
      appBarTheme: AppBarTheme(
        backgroundColor: secondarySurface,
        foregroundColor: onSurface,
        elevation: 0,
        toolbarHeight: 64,
        titleTextStyle: textTheme.titleLarge?.copyWith(
          letterSpacing: 3,
          fontWeight: FontWeight.w600,
        ),
      ),
      cardTheme: CardTheme(
        color: surfaceColor,
        surfaceTintColor: Colors.transparent,
        elevation: isDark ? 2 : 4,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(_vipCardRadius),
          side: BorderSide(color: _vipOutline.withOpacity(0.35)),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: secondarySurface,
        disabledColor: _vipTextMuted.withOpacity(0.2),
        selectedColor: _vipGlow.withOpacity(0.16),
        secondarySelectedColor: _vipGlow.withOpacity(0.32),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        labelStyle: textTheme.labelLarge?.copyWith(letterSpacing: 2),
        secondaryLabelStyle:
            textTheme.labelMedium?.copyWith(color: _vipGlow),
        shape: StadiumBorder(
          side: BorderSide(color: _vipOutline.withOpacity(0.4)),
        ),
      ),
      dividerTheme: DividerThemeData(
        color: _vipOutline.withOpacity(isDark ? 0.4 : 0.2),
        thickness: 1,
        space: 24,
      ),
      dialogTheme: DialogTheme(
        backgroundColor: surfaceColor,
        surfaceTintColor: Colors.transparent,
        elevation: 6,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(_vipCardRadius),
          side: BorderSide(color: _vipOutline.withOpacity(0.4)),
        ),
        titleTextStyle: textTheme.titleLarge,
        contentTextStyle: textTheme.bodyLarge,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(style: filledButtonStyle),
      outlinedButtonTheme: OutlinedButtonThemeData(style: outlinedButtonStyle),
      textButtonTheme: TextButtonThemeData(style: textButtonStyle),
      iconButtonTheme: IconButtonThemeData(
        style: ButtonStyle(
          foregroundColor: WidgetStateProperty.all(_vipTextSecondary),
          overlayColor: WidgetStateProperty.all(_vipGlow.withOpacity(0.12)),
          shape: WidgetStateProperty.all(
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          ),
        ),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: _vipGlow,
        foregroundColor: _vipCamoDark,
        elevation: 4,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: secondarySurface,
        elevation: 0,
        selectedItemColor: _vipGold,
        unselectedItemColor: _vipTextMuted,
        showSelectedLabels: true,
        showUnselectedLabels: true,
        selectedLabelStyle: textTheme.labelMedium?.copyWith(letterSpacing: 2),
        unselectedLabelStyle:
            textTheme.bodySmall?.copyWith(letterSpacing: 1.5),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: secondarySurface,
        indicatorColor: _vipGlow.withOpacity(0.18),
        iconTheme: WidgetStateProperty.all(
          IconThemeData(color: _vipTextPrimary),
        ),
        labelTextStyle: WidgetStateProperty.all(
          textTheme.labelMedium?.copyWith(letterSpacing: 2),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: secondarySurface,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
        hintStyle: textTheme.bodyMedium?.copyWith(color: _vipTextMuted),
        labelStyle: textTheme.labelLarge,
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(_vipBaseRadius),
          borderSide: BorderSide(color: _vipOutline.withOpacity(0.4)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(_vipBaseRadius),
          borderSide: const BorderSide(color: _vipGlow, width: 1.6),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(_vipBaseRadius),
          borderSide: const BorderSide(color: _vipAlert, width: 1.4),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(_vipBaseRadius),
          borderSide: const BorderSide(color: _vipAlert, width: 1.6),
        ),
      ),
      checkboxTheme: CheckboxThemeData(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(6),
        ),
        fillColor: WidgetStateProperty.resolveWith((Set<WidgetState> s) {
          if (s.contains(WidgetState.selected)) {
            return _vipGlow;
          }
          return _vipOutline.withOpacity(0.6);
        }),
        checkColor: WidgetStateProperty.all(_vipCamoDark),
      ),
      radioTheme: RadioThemeData(
        fillColor: WidgetStateProperty.resolveWith((Set<WidgetState> s) {
          if (s.contains(WidgetState.selected)) {
            return _vipGlow;
          }
          return _vipOutline;
        }),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((Set<WidgetState> s) {
          if (s.contains(WidgetState.selected)) {
            return _vipGlow;
          }
          return _vipOutline;
        }),
        trackColor: WidgetStateProperty.resolveWith((Set<WidgetState> s) {
          if (s.contains(WidgetState.selected)) {
            return _vipGlow.withOpacity(0.4);
          }
          return _vipOutline.withOpacity(0.3);
        }),
      ),
      listTileTheme: ListTileThemeData(
        tileColor: secondarySurface,
        selectedTileColor: _vipGlow.withOpacity(0.14),
        textColor: onSurface,
        iconColor: _vipGlow,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(_vipBaseRadius),
          side: BorderSide(color: _vipOutline.withOpacity(0.3)),
        ),
      ),
      sliderTheme: SliderThemeData(
        activeTrackColor: _vipGlow,
        inactiveTrackColor: _vipOutline.withOpacity(0.5),
        thumbColor: _vipGold,
        overlayColor: _vipGlow.withOpacity(0.1),
        trackHeight: 4,
        thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 12),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: _vipGlow,
        linearTrackColor: _vipOutline.withOpacity(0.4),
        circularTrackColor: _vipOutline.withOpacity(0.5),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: secondarySurface,
        contentTextStyle: textTheme.bodyMedium,
        behavior: SnackBarBehavior.floating,
        elevation: 4,
        actionTextColor: _vipGold,
      ),
      tooltipTheme: TooltipThemeData(
        decoration: BoxDecoration(
          color: _vipCamoDark.withOpacity(0.95),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: _vipOutline.withOpacity(0.5)),
        ),
        textStyle: textTheme.labelLarge,
      ),
    );
  }

  static TextTheme _buildTextTheme({
    required Brightness brightness,
    required String fontFamily,
    required Color textColor,
  }) {
    final TextTheme base = brightness == Brightness.dark
        ? ThemeData.dark().textTheme
        : ThemeData.light().textTheme;
    final TextTheme themed = base
        .apply(
          fontFamily: fontFamily,
          bodyColor: textColor,
          displayColor: textColor,
        )
        .copyWith(
          headlineMedium: base.headlineMedium?.copyWith(
            fontWeight: FontWeight.w600,
            letterSpacing: 6,
          ),
          titleLarge: base.titleLarge?.copyWith(
            fontWeight: FontWeight.w600,
            letterSpacing: 4,
          ),
          labelLarge: base.labelLarge?.copyWith(
            letterSpacing: 2.5,
            fontWeight: FontWeight.w600,
          ),
          bodySmall: base.bodySmall?.copyWith(
            letterSpacing: 1.4,
            color: _vipTextMuted,
          ),
        );
    return themed;
  }

  static ColorScheme _buildColorScheme(Brightness brightness) {
    if (brightness == Brightness.dark) {
      return const ColorScheme(
        brightness: Brightness.dark,
        primary: _vipGold,
        onPrimary: _vipCamoDark,
        primaryContainer: _vipCamoOlive,
        onPrimaryContainer: _vipGold,
        secondary: _vipAir,
        onSecondary: _vipCamoDark,
        secondaryContainer: _vipCamoDark,
        onSecondaryContainer: _vipTextPrimary,
        tertiary: _vipGlow,
        onTertiary: _vipCamoDark,
        tertiaryContainer: _vipCamoOlive,
        onTertiaryContainer: _vipTextPrimary,
        error: _vipAlert,
        onError: _vipCamoDark,
        errorContainer: Color(0xFF5E1B1B),
        onErrorContainer: _vipTextPrimary,
        background: _vipCamoDeep,
        onBackground: _vipTextPrimary,
        surface: _vipSurfaceDark,
        onSurface: _vipTextPrimary,
        surfaceVariant: _vipCamoDark,
        onSurfaceVariant: _vipTextSecondary,
        outline: _vipOutline,
        outlineVariant: _vipOutline,
        shadow: Colors.black,
        scrim: Colors.black54,
        inverseSurface: _vipTextPrimary,
        onInverseSurface: _vipCamoDark,
        inversePrimary: _vipGlow,
      );
    }
    return const ColorScheme(
      brightness: Brightness.light,
      primary: _vipCamoDark,
      onPrimary: _vipTextPrimary,
      primaryContainer: _vipGlow,
      onPrimaryContainer: _vipCamoDark,
      secondary: _vipAir,
      onSecondary: _vipCamoDark,
      secondaryContainer: _vipGlow,
      onSecondaryContainer: _vipCamoDark,
      tertiary: _vipGold,
      onTertiary: _vipCamoDark,
      tertiaryContainer: _vipSand,
      onTertiaryContainer: _vipCamoDark,
      error: _vipAlert,
      onError: _vipTextPrimary,
      errorContainer: Color(0xFFFFE3DF),
      onErrorContainer: _vipAlert,
      background: _vipSurfaceLight,
      onBackground: _vipCamoDark,
      surface: Colors.white,
      onSurface: _vipCamoDark,
      surfaceVariant: Color(0xFFF0E8D9),
      onSurfaceVariant: _vipSandSoft,
      outline: Color(0xFFB6A68A),
      outlineVariant: Color(0xFFE5D7BE),
      shadow: Color(0x33000000),
      scrim: Color(0x66000000),
      inverseSurface: _vipCamoDark,
      onInverseSurface: _vipTextPrimary,
      inversePrimary: _vipGlow,
    );
  }
}
