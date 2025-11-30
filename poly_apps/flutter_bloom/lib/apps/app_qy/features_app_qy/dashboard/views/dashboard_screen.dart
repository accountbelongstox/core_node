// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

// ============================================================================
// [DEPRECATED - MS] This screen is deprecated and should not be used
// ============================================================================
// This old screen has been replaced by refactored MVC architecture screens.
// Please use the refactored screens located in:
//   - features_app_qy/home/views/home_study_screen_refactored_app_qy.dart
// This file is kept for reference only and is not connected to the app routes.
// ============================================================================

import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/views/home_screen.dart';
import 'package:qyflutter/common/widgets/enhanced_bottom_navigation.dart';
import 'package:qyflutter/apps/app_qy/router_app_qy/routes_provider_app_qy.dart';
// AI: Claude Code - Replaced app-specific HomeBottomNavigationBar with common EnhancedBottomNavigation

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      resizeToAvoidBottomInset: false,
      body: Stack(
        children: [
          HomeScreen(),
          Positioned(
            child: Align(
              alignment: Alignment.bottomCenter,
              child: EnhancedBottomNavigation(
                currentIndex: 0,
                useRoundedDesign: true,
                showLabels: false,
                items: [
                  NavigationItem(
                    icon: Icons.home_filled,
                    label: 'home',
                    route: QyAppRoutesProvider.routeHome,
                  ),
                  NavigationItem(
                    icon: Icons.archive_outlined,
                    label: 'activity',
                    route: QyAppRoutesProvider.routeDonation,
                  ),
                  NavigationItem(
                    icon: Icons.list_outlined,
                    label: 'notification',
                    route: QyAppRoutesProvider.routeFundraising,
                    isCenter: true,
                  ),
                  NavigationItem(
                    icon: Icons.sms_outlined,
                    label: 'chat',
                    route: QyAppRoutesProvider.routeChat,
                  ),
                  NavigationItem(
                    icon: Icons.person_outline,
                    label: 'profile',
                    route: QyAppRoutesProvider.routeProfile,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
