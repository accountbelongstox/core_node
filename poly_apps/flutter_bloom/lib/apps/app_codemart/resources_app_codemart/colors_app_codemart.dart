import 'package:flutter/material.dart';

class CodemartColors {
  static const Color midnight = Color(0xFF050814);
  static const Color midnightAlt = Color(0xFF0B1224);
  static const Color primary = Color(0xFF4F8BFF);
  static const Color secondary = Color(0xFF00F5FF);
  static const Color accent = Color(0xFFFF66D8);
  static const Color success = Color(0xFF2DE38F);
  static const Color warning = Color(0xFFFFB347);
  static const Color danger = Color(0xFFFF6B6B);
  static const Color surface = Color(0xFF11182A);
  static const Color surfaceElevated = Color(0xFF1A2238);
  static const Color surfaceHover = Color(0xFF202A44);
  static const Color outline = Color(0xFF253051);
  static const Color outlineStrong = Color(0xFF2F3B63);
  static const Color textPrimary = Color(0xFFF5F7FF);
  static const Color textSecondary = Color(0xFF97A3C5);
  static const Color textMuted = Color(0xFF7381AA);
  static const Color badgeBlue = Color(0xFF3AC4FF);
  static const Color badgePurple = Color(0xFF8E7CFF);
  static const Color badgeCyan = Color(0xFF00E0FF);

  static const List<Color> backgroundGradient = <Color>[
    Color(0xFF02070F),
    Color(0xFF07142C),
    Color(0xFF0B1C3A),
  ];

  static const List<Color> heroGradient = <Color>[
    Color(0xFF1B50FF),
    Color(0xFF6936FF),
    Color(0xFF00E0FF),
  ];

  static const List<Color> buttonGradient = <Color>[
    Color(0xFF3D7CFF),
    Color(0xFF5F4BFF),
  ];

  static const List<Color> accentGradient = <Color>[
    Color(0xFFFF5FD7),
    Color(0xFF7A5CFF),
  ];

  static const List<Color> successGradient = <Color>[
    Color(0xFF2DE38F),
    Color(0xFF0BB5AA),
  ];

  static const List<Color> warningGradient = <Color>[
    Color(0xFFFFB347),
    Color(0xFFFF6B6B),
  ];

  static LinearGradient buildGradient(
    List<Color> colors, {
    AlignmentGeometry begin = Alignment.topLeft,
    AlignmentGeometry end = Alignment.bottomRight,
  }) {
    return LinearGradient(
      colors: colors,
      begin: begin,
      end: end,
    );
  }
}
