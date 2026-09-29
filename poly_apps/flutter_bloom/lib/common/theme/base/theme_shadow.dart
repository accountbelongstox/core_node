import 'package:flutter/material.dart';

class ThemeShadow {
  static const Color _shadowColor = Color(0xFF000000);

  static List<BoxShadow> none = const [];

  static List<BoxShadow> small = [
    BoxShadow(
      color: _shadowColor.withOpacity(0.05),
      offset: const Offset(0, 1),
      blurRadius: 2,
      spreadRadius: 0,
    ),
  ];

  static List<BoxShadow> medium = [
    BoxShadow(
      color: _shadowColor.withOpacity(0.08),
      offset: const Offset(0, 2),
      blurRadius: 4,
      spreadRadius: 0,
    ),
    BoxShadow(
      color: _shadowColor.withOpacity(0.04),
      offset: const Offset(0, 1),
      blurRadius: 2,
      spreadRadius: 0,
    ),
  ];

  static List<BoxShadow> large = [
    BoxShadow(
      color: _shadowColor.withOpacity(0.10),
      offset: const Offset(0, 4),
      blurRadius: 8,
      spreadRadius: 0,
    ),
    BoxShadow(
      color: _shadowColor.withOpacity(0.06),
      offset: const Offset(0, 2),
      blurRadius: 4,
      spreadRadius: 0,
    ),
  ];

  static List<BoxShadow> extraLarge = [
    BoxShadow(
      color: _shadowColor.withOpacity(0.12),
      offset: const Offset(0, 8),
      blurRadius: 16,
      spreadRadius: 0,
    ),
    BoxShadow(
      color: _shadowColor.withOpacity(0.08),
      offset: const Offset(0, 4),
      blurRadius: 8,
      spreadRadius: 0,
    ),
  ];

  static List<BoxShadow> premium = [
    BoxShadow(
      color: _shadowColor.withOpacity(0.15),
      offset: const Offset(0, 12),
      blurRadius: 24,
      spreadRadius: 0,
    ),
    BoxShadow(
      color: _shadowColor.withOpacity(0.10),
      offset: const Offset(0, 6),
      blurRadius: 12,
      spreadRadius: 0,
    ),
    BoxShadow(
      color: _shadowColor.withOpacity(0.05),
      offset: const Offset(0, 3),
      blurRadius: 6,
      spreadRadius: 0,
    ),
  ];

  static List<BoxShadow> card = [
    BoxShadow(
      color: _shadowColor.withOpacity(0.08),
      offset: const Offset(0, 2),
      blurRadius: 8,
      spreadRadius: 0,
    ),
  ];

  static List<BoxShadow> button = [
    BoxShadow(
      color: _shadowColor.withOpacity(0.10),
      offset: const Offset(0, 2),
      blurRadius: 4,
      spreadRadius: 0,
    ),
  ];

  static List<BoxShadow> modal = [
    BoxShadow(
      color: _shadowColor.withOpacity(0.20),
      offset: const Offset(0, 16),
      blurRadius: 32,
      spreadRadius: 0,
    ),
    BoxShadow(
      color: _shadowColor.withOpacity(0.10),
      offset: const Offset(0, 8),
      blurRadius: 16,
      spreadRadius: 0,
    ),
  ];

  static List<BoxShadow> floating = [
    BoxShadow(
      color: _shadowColor.withOpacity(0.15),
      offset: const Offset(0, 8),
      blurRadius: 16,
      spreadRadius: -4,
    ),
  ];

  static List<BoxShadow> getColoredShadow(Color color, {double opacity = 0.3}) {
    return [
      BoxShadow(
        color: color.withOpacity(opacity),
        offset: const Offset(0, 4),
        blurRadius: 12,
        spreadRadius: 0,
      ),
      BoxShadow(
        color: color.withOpacity(opacity * 0.5),
        offset: const Offset(0, 2),
        blurRadius: 6,
        spreadRadius: 0,
      ),
    ];
  }

  static List<BoxShadow> getGlowShadow(Color color, {double intensity = 0.5}) {
    return [
      BoxShadow(
        color: color.withOpacity(intensity * 0.6),
        offset: const Offset(0, 0),
        blurRadius: 20,
        spreadRadius: 2,
      ),
      BoxShadow(
        color: color.withOpacity(intensity * 0.3),
        offset: const Offset(0, 0),
        blurRadius: 10,
        spreadRadius: 0,
      ),
    ];
  }

  static List<BoxShadow> innerShadow = [
    BoxShadow(
      color: _shadowColor.withOpacity(0.1),
      offset: const Offset(0, 2),
      blurRadius: 4,
      spreadRadius: -2,
    ),
  ];

  static List<BoxShadow> getShadow(BuildContext context) => medium;
  static List<BoxShadow> getLightShadow(BuildContext context) => small;
  static List<BoxShadow> getHeavyShadow(BuildContext context) => large;
}
