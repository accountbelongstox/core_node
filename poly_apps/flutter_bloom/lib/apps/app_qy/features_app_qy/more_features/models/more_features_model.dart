/// More features data models
library;

import 'package:flutter/material.dart';

class FeatureGroupModel {
  final String titleKey;
  final IconData? icon;
  final String? emojiIcon;
  final Color color;
  final List<FeatureItemModel> features;

  const FeatureGroupModel({
    required this.titleKey,
    this.icon,
    this.emojiIcon,
    required this.color,
    required this.features,
  });
}

class FeatureItemModel {
  final String titleKey;
  final String subtitleKey;
  final IconData icon;
  final Color color;
  final String route;
  final bool locked;

  const FeatureItemModel({
    required this.titleKey,
    required this.subtitleKey,
    required this.icon,
    required this.color,
    required this.route,
    this.locked = false,
  });
}

