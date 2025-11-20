import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

import 'colors_app_codemart.dart';

class CodemartTextStyles {
  static TextStyle heroTitle = ThemeTextStyles.largeTitle.copyWith(
    fontSize: 42,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.5,
    color: CodemartColors.textPrimary,
  );

  static TextStyle heroSubtitle = ThemeTextStyles.headline4.copyWith(
    fontSize: 18,
    color: CodemartColors.textSecondary,
    height: 1.4,
  );

  static TextStyle sectionTitle = ThemeTextStyles.h3.copyWith(
    fontSize: 22,
    fontWeight: FontWeight.w600,
    color: CodemartColors.textPrimary,
  );

  static TextStyle body = ThemeTextStyles.bodyMedium.copyWith(
    color: CodemartColors.textSecondary,
    height: 1.5,
  );

  static TextStyle bodyMuted = ThemeTextStyles.bodySmall.copyWith(
    color: CodemartColors.textMuted,
  );

  static TextStyle buttonLarge = ThemeTextStyles.buttonLarge.copyWith(
    letterSpacing: 0.6,
    fontWeight: FontWeight.w600,
    color: CodemartColors.textPrimary,
  );

  static TextStyle monoSmall = ThemeTextStyles.caption.copyWith(
    fontFamily: 'JetBrains Mono',
    color: CodemartColors.badgeCyan,
    letterSpacing: 0.8,
  );
}
