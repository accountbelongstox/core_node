import 'package:flutter/material.dart';
import 'theme_colors.dart';

class ThemeGradients {
  static const LinearGradient primaryBlue = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      ThemeColors.primaryBlue,
      Color(0xFF1E88E5),
    ],
  );

  static const LinearGradient primaryGold = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      ThemeColors.accentGold,
      Color(0xFFFFA726),
    ],
  );

  static const LinearGradient vipGold = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFFFFD700),
      Color(0xFFFFA500),
      Color(0xFFFF8C00),
    ],
    stops: [0.0, 0.5, 1.0],
  );

  static const LinearGradient vipPlatinum = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFFE5E4E2),
      Color(0xFFC0C0C0),
      Color(0xFF808080),
    ],
    stops: [0.0, 0.5, 1.0],
  );

  static const LinearGradient vipDiamond = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFFB9F2FF),
      Color(0xFF00D4FF),
      Color(0xFF0099CC),
    ],
    stops: [0.0, 0.5, 1.0],
  );

  static const LinearGradient oceanBlue = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [
      Color(0xFF667EEA),
      Color(0xFF764BA2),
    ],
  );

  static const LinearGradient sunsetOrange = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFFFF6B6B),
      Color(0xFFFFE66D),
    ],
  );

  static const LinearGradient forestGreen = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFF11998E),
      Color(0xFF38EF7D),
    ],
  );

  static const LinearGradient royalPurple = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFF6A11CB),
      Color(0xFF2575FC),
    ],
  );

  static const LinearGradient cherryRed = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFFEB3349),
      Color(0xFFF45C43),
    ],
  );

  static const LinearGradient mintGreen = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFF00F260),
      Color(0xFF0575E6),
    ],
  );

  static const LinearGradient peachy = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFFFFEDBC),
      Color(0xFFED4264),
    ],
  );

  static const LinearGradient skyBlue = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [
      Color(0xFF56CCF2),
      Color(0xFF2F80ED),
    ],
  );

  static const LinearGradient premium = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFF434343),
      Color(0xFF000000),
    ],
  );

  static const LinearGradient success = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      ThemeColors.successGreen,
      Color(0xFF66BB6A),
    ],
  );

  static const LinearGradient warning = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      ThemeColors.warningYellow,
      Color(0xFFFFA726),
    ],
  );

  static const LinearGradient error = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      ThemeColors.errorRed,
      Color(0xFFEF5350),
    ],
  );

  static const LinearGradient info = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      ThemeColors.primaryBlue,
      Color(0xFF42A5F5),
    ],
  );

  static const RadialGradient spotlight = RadialGradient(
    center: Alignment.center,
    radius: 1.0,
    colors: [
      Color(0xFFFFFFFF),
      Color(0x00FFFFFF),
    ],
    stops: [0.0, 1.0],
  );

  static const SweepGradient rainbow = SweepGradient(
    colors: [
      Color(0xFFFF0000),
      Color(0xFFFFFF00),
      Color(0xFF00FF00),
      Color(0xFF00FFFF),
      Color(0xFF0000FF),
      Color(0xFFFF00FF),
      Color(0xFFFF0000),
    ],
  );

  static LinearGradient shimmer({
    Color baseColor = const Color(0xFFE0E0E0),
    Color highlightColor = const Color(0xFFF5F5F5),
  }) {
    return LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [
        baseColor,
        highlightColor,
        baseColor,
      ],
      stops: const [0.0, 0.5, 1.0],
    );
  }

  static LinearGradient overlay({
    Color startColor = Colors.black,
    Color endColor = Colors.transparent,
    Alignment begin = Alignment.topCenter,
    Alignment end = Alignment.bottomCenter,
    double startOpacity = 0.7,
    double endOpacity = 0.0,
  }) {
    return LinearGradient(
      begin: begin,
      end: end,
      colors: [
        startColor.withOpacity(startOpacity),
        endColor.withOpacity(endOpacity),
      ],
    );
  }

  static LinearGradient glass({
    Color color = Colors.white,
    double opacity = 0.2,
  }) {
    return LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [
        color.withOpacity(opacity * 1.2),
        color.withOpacity(opacity * 0.8),
      ],
    );
  }

  static LinearGradient metal({
    Color baseColor = const Color(0xFFB0B0B0),
  }) {
    return LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [
        baseColor.withOpacity(0.8),
        baseColor,
        baseColor.withOpacity(0.6),
        baseColor,
      ],
      stops: const [0.0, 0.33, 0.66, 1.0],
    );
  }

  static LinearGradient frosted({
    Color color = Colors.white,
  }) {
    return LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [
        color.withOpacity(0.3),
        color.withOpacity(0.1),
      ],
    );
  }

  static LinearGradient neon(Color color) {
    return LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [
        color,
        color.withOpacity(0.7),
        color,
      ],
      stops: const [0.0, 0.5, 1.0],
    );
  }

  static LinearGradient glow(Color color) {
    return LinearGradient(
      begin: Alignment.center,
      end: Alignment.bottomRight,
      colors: [
        color.withOpacity(0.8),
        color.withOpacity(0.4),
        color.withOpacity(0.1),
      ],
    );
  }

  static LinearGradient getVipTierGradient(String tier) {
    switch (tier.toLowerCase()) {
      case 'gold':
        return vipGold;
      case 'platinum':
        return vipPlatinum;
      case 'diamond':
        return vipDiamond;
      default:
        return primaryBlue;
    }
  }

  static LinearGradient getSemanticGradient(String type) {
    switch (type.toLowerCase()) {
      case 'success':
        return success;
      case 'warning':
        return warning;
      case 'error':
        return error;
      case 'info':
        return info;
      default:
        return primaryBlue;
    }
  }
}
