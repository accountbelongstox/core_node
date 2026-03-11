library;

import 'package:flutter/material.dart';

class ColorsAppQy {
  static const Color qyPrimary = Color(0xFF0B9722);
  static const Color qySecondary = Color(0xFF34C759);
  static const Color qyAccent = Color(0xFF5AC8FA);
  static const Color qyError = Color(0xFFF44336);
  static const Color qySuccess = Color(0xFF4CAF50);
  static const Color qyWarning = Color(0xFFFF9800);
  static const Color qyInfo = Color(0xFF2196F3);

  static const Color qyPageBackground = Color(0xFFF5F5F5);
  static const Color qyTextPrimary = Color(0xFF212121);
  static const Color qyTextSecondary = Color(0xFF757575);
  static const Color qyTextTertiary = Color(0xFF9E9E9E);
  static const Color qyTextOnPrimary = Colors.white;

  static const Color qyFrostWhite = Color(0xFFFAFAFA);
  static const Color qyGlassWhite = Color(0xFFF0F0F0);
  static const Color qyFrostLight = Color(0xFFF5F5F5);
  static const Color qyFrostMedium = Color(0xFFEEEEEE);
  static const Color qyBorderLight = Color(0xFFE0E0E0);
  static const Color qyShadowLight = Color(0x1A000000);
  static const Color qyShadowMedium = Color(0x33000000);

  static const Color qyPrimaryDark = Color(0xFF086B18);
  static const Color qySecondaryDark = Color(0xFF2E9E42);
  static const Color qyAccentDark = Color(0xFF42B0D9);
  static const Color qyAccentLight = Color(0xFF7DD4FA);
  static const Color qyHolographicLight = Color(0xFFE8F5E9);

  static const LinearGradient qyPrimaryGradient = LinearGradient(
    colors: [qyPrimary, qySecondary],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
  static const LinearGradient qySecondaryGradient = LinearGradient(
    colors: [Color(0xFF2E7D32), qySecondary],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
  static const LinearGradient qyAccentGradient = LinearGradient(
    colors: [Color(0xFF0288D1), qyAccent],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
  static const LinearGradient qyTealGradient = LinearGradient(
    colors: [Color(0xFF00897B), Color(0xFF4DB6AC)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
  static const LinearGradient qyFrostedGlassGradient = LinearGradient(
    colors: [
      Color(0x1AFFFFFF),
      Color(0x0DFFFFFF),
    ],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
  static const LinearGradient qyHolographicGradient = LinearGradient(
    colors: [
      Color(0xFFE8F5E9),
      Color(0xFFC8E6C9),
      Color(0xFFA5D6A7),
    ],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static LinearGradient qyDynamicShimmerGradient(double animationValue) {
    return LinearGradient(
      begin: Alignment(-1.0 + animationValue * 2, 0),
      end: Alignment(1.0 + animationValue * 2, 0),
      colors: const [
        Color(0xFFE0E0E0),
        Color(0xFFF5F5F5),
        Color(0xFFE0E0E0),
      ],
    );
  }
}
