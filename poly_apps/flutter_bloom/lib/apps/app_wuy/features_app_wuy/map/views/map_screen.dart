// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import '../../../router_app_wuy/router_app_wuy.dart';

class WuyMapScreen extends StatefulWidget {
  const WuyMapScreen({super.key});

  @override
  State<WuyMapScreen> createState() => _WuyMapScreenState();
}

class _WuyMapScreenState extends State<WuyMapScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.lightBackground,
      appBar: AppBar(
        title: Text(
          'Map',
          style: ThemeTextStyles.displayMedium,
        ),
        backgroundColor: ThemeColors.primary,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.my_location, color: Colors.white),
            onPressed: () {
              // Handle location center
            },
          ),
        ],
      ),
      body: Stack(
        children: [
          _buildMapView(),
          _buildFloatingProfileCard(),
          _buildBottomNavigation(),
        ],
      ),
    );
  }

  Widget _buildMapView() {
    return Container(
      width: double.infinity,
      height: double.infinity,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Colors.green.shade200,
            Colors.blue.shade200,
            Colors.green.shade300,
          ],
        ),
      ),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.map,
              size: 100,
              color: Colors.white.withOpacity(0.8),
            ),
            SizedBox(height: ThemeDimensions.spacingMedium),
            Text(
              'Map View',
              style: ThemeTextStyles.displayMedium.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
            ),
            Text(
              'Interactive map with friend locations',
              style: ThemeTextStyles.bodyLarge.copyWith(
                color: Colors.white.withOpacity(0.9),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFloatingProfileCard() {
    return Positioned(
      top: 100,
      left: 20,
      right: 20,
      child: Card(
        elevation: 8,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusLarge),
        ),
        child: Padding(
          padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
          child: Column(
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 30,
                    backgroundColor: ThemeColors.primary,
                    child: Icon(
                      Icons.person,
                      size: 30,
                      color: Colors.white,
                    ),
                  ),
                  SizedBox(width: ThemeDimensions.spacingMedium),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '小飞侠',
                          style: ThemeTextStyles.title3,
                        ),
                        Text(
                          '守护的未来',
                          style: ThemeTextStyles.bodyMedium.copyWith(
                            color: ThemeColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: Icon(Icons.info_outline, color: ThemeColors.primary),
                    onPressed: () {
                      context.go('/wuy/friend/1');
                    },
                  ),
                ],
              ),
              SizedBox(height: ThemeDimensions.spacingMedium),
              Container(
                padding: EdgeInsets.all(ThemeDimensions.spacingMedium),
                decoration: BoxDecoration(
                  color: Colors.blue.shade50,
                  borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildInfoItem(Icons.directions_walk, 'Steps', '8,432'),
                    _buildInfoItem(Icons.favorite, 'Heart Rate', '72'),
                    _buildInfoItem(Icons.thermostat, 'Temperature', '36.5°C'),
                    _buildInfoItem(Icons.local_fire_department, 'Calories', '245'),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInfoItem(IconData icon, String label, String value) {
    return Column(
      children: [
        Icon(icon, color: ThemeColors.primary, size: 20),
        SizedBox(height: ThemeDimensions.spacingSmall),
        Text(
          value,
          style: ThemeTextStyles.bodyMedium.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        Text(
          label,
          style: ThemeTextStyles.bodySmall.copyWith(
            color: ThemeColors.textSecondary,
          ),
        ),
      ],
    );
  }

  Widget _buildBottomNavigation() {
    return Positioned(
      bottom: 0,
      left: 0,
      right: 0,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.1),
              blurRadius: 10,
              offset: Offset(0, -2),
            ),
          ],
        ),
        child: SafeArea(
          child: Container(
            height: 60,
            padding: EdgeInsets.symmetric(horizontal: ThemeDimensions.defaultPadding),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildNavItem(Icons.map, 'Map', true, null),
                _buildNavItem(Icons.people, 'Friends', false, () => context.go(WuyAppRouter.routeFriends)),
                _buildNavItem(Icons.person, 'Mine', false, () => context.go(WuyAppRouter.routeProfile)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(IconData icon, String label, bool isSelected, VoidCallback? onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: ThemeDimensions.spacing12,
          vertical: ThemeDimensions.spacingSmall,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              color: isSelected 
                  ? ThemeColors.primary 
                  : ThemeColors.textSecondary,
              size: 24,
            ),
            SizedBox(height: ThemeDimensions.spacing4),
            Text(
              label,
              style: ThemeTextStyles.bodySmall.copyWith(
                color: isSelected 
                    ? ThemeColors.primary 
                    : ThemeColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
