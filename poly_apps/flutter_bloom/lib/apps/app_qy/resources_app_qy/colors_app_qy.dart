import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';

class ColorsAppQy {
  
  static const Color qyPrimary = Color(0xFF6366F1);
  static const Color qyPrimaryLight = Color(0xFF818CF8);
  static const Color qyPrimaryDark = Color(0xFF4F46E5);
  
  static const Color qySecondary = Color(0xFF14B8A6);
  static const Color qySecondaryLight = Color(0xFF2DD4BF);
  static const Color qySecondaryDark = Color(0xFF0D9488);
  
  static const Color qyAccent = Color(0xFFF472B6);
  static const Color qyAccentLight = Color(0xFFF9A8D4);
  static const Color qyAccentDark = Color(0xFFEC4899);
  
  static const Color qyHolographicWhite = Color(0xFFF8FAFC);
  static const Color qyHolographicLight = Color(0xFFF1F5F9);
  static const Color qyHolographicMedium = Color(0xFFE2E8F0);
  
  static const Color qyFrostWhite = Color(0xE6FFFFFF);
  static const Color qyFrostLight = Color(0xCCFFFFFF);
  static const Color qyFrostMedium = Color(0x99FFFFFF);
  static const Color qyFrostDark = Color(0x66FFFFFF);
  
  static const Color qyGlassWhite = Color(0xB3FFFFFF);
  static const Color qyGlassLight = Color(0x80FFFFFF);
  static const Color qyGlassMedium = Color(0x4DFFFFFF);
  static const Color qyGlassDark = Color(0x1AFFFFFF);
  
  static const Color qyTextPrimary = Color(0xFF1E293B);
  static const Color qyTextSecondary = Color(0xFF64748B);
  static const Color qyTextTertiary = Color(0xFF94A3B8);
  static const Color qyTextOnPrimary = Color(0xFFFFFFFF);
  
  static const Color qySuccess = Color(0xFF22C55E);
  static const Color qyWarning = Color(0xFFF59E0B);
  static const Color qyError = Color(0xFFEF4444);
  static const Color qyInfo = Color(0xFF3B82F6);
  
  static const Color qyBorderLight = Color(0xFFE2E8F0);
  static const Color qyBorderMedium = Color(0xFFCBD5E1);
  static const Color qyBorderDark = Color(0xFF94A3B8);
  
  static const Color qyShadowLight = Color(0x0A000000);
  static const Color qyShadowMedium = Color(0x14000000);
  static const Color qyShadowDark = Color(0x29000000);
  
  static const Color qyGradientStart = Color(0xFF6366F1);
  static const Color qyGradientMiddle = Color(0xFF8B5CF6);
  static const Color qyGradientEnd = Color(0xFFA855F7);
  
  static const Color qyGradientTealStart = Color(0xFF14B8A6);
  static const Color qyGradientTealEnd = Color(0xFF06B6D4);
  
  static const Color qyGradientPinkStart = Color(0xFFF472B6);
  static const Color qyGradientPinkEnd = Color(0xFFFB7185);
  
  static const Color qyCardBackground = qyFrostWhite;
  static const Color qyPageBackground = qyHolographicWhite;
  static const Color qyNavBackground = qyGlassWhite;
  
  static LinearGradient get qyPrimaryGradient => const LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [qyGradientStart, qyGradientMiddle, qyGradientEnd],
  );

  static LinearGradient get qySecondaryGradient => const LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [qyGradientTealStart, qyGradientTealEnd],
  );

  static LinearGradient get qyAccentGradient => const LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [qyGradientPinkStart, qyGradientPinkEnd],
  );

  static LinearGradient get qyTealGradient => const LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [qyGradientTealStart, qyGradientTealEnd],
  );

  static LinearGradient get qyPinkGradient => const LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [qyGradientPinkStart, qyGradientPinkEnd],
  );
  
  static LinearGradient get qyHolographicGradient => LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      qyHolographicWhite,
      qyHolographicLight.withOpacity(0.9),
      qyHolographicWhite,
    ],
  );
  
  static LinearGradient get qyFrostGradient => LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [
      qyFrostWhite,
      qyFrostLight,
    ],
  );

  static LinearGradient get qyFrostedGlassGradient => LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      qyGlassWhite,
      qyGlassLight,
    ],
  );
  
  static LinearGradient qyDynamicShimmerGradient(double animationValue) {
    return LinearGradient(
      begin: Alignment(-1.0 + animationValue * 2, 0),
      end: Alignment(1.0 + animationValue * 2, 0),
      colors: [
        qyHolographicWhite,
        qyPrimaryLight.withOpacity(0.1),
        qyHolographicWhite,
        qySecondaryLight.withOpacity(0.1),
        qyHolographicWhite,
      ],
      stops: const [0.0, 0.25, 0.5, 0.75, 1.0],
    );
  }
  
  static Color getColorForLanguage(String langCode) {
    switch (langCode) {
      case 'en':
        return qyPrimary;
      case 'zh':
        return qyError;
      case 'ja':
        return qyAccent;
      case 'ko':
        return qySecondary;
      case 'fr':
        return qyInfo;
      case 'de':
        return qyWarning;
      case 'es':
        return qySuccess;
      default:
        return qyTextSecondary;
    }
  }
  
  static Color getMasteryColor(double mastery) {
    if (mastery >= 80) return qySuccess;
    if (mastery >= 60) return qySecondary;
    if (mastery >= 40) return qyInfo;
    if (mastery >= 20) return qyWarning;
    return qyTextTertiary;
  }
}

