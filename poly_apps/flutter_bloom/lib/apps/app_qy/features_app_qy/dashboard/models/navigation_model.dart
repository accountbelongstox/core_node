import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class NavigationModel {
  final String name;
  final IconData activeIcon;
  final Widget screen;
  final String route;

  const NavigationModel({
    required this.name,
    required this.activeIcon,
    required this.screen,
    required this.route,
  });

  void navigate(BuildContext context) {
    context.push(route);
  }
}
