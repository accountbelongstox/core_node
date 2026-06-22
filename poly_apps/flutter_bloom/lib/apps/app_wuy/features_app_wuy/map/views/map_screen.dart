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

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/sdk/tencent_maps/tencent_maps_sdk.dart';
import 'package:qyflutter/common/widgets/cards/premium_cards.dart';
import '../../../localization_app_wuy/localization_keys_app_wuy.dart';
import '../../../config_app_wuy/app_config_app_wuy.dart';
import '../../../models_app_wuy/friend_model_app_wuy.dart';
import '../../../services_app_wuy/wuy_fake_data_generator.dart';
import '../../../widgets_app_wuy/wuy_bottom_navigation.dart';

/// Map Screen for Wuy App
///
/// 1:1 implementation matching React version MapHome.tsx
/// Features:
/// - Full screen map (no AppBar)
/// - Floating header controls (SOS, Notification buttons)
/// - Bottom friend card with glassmorphism effect
/// - Bottom navigation bar
class WuyMapScreen extends StatefulWidget {
  const WuyMapScreen({super.key});

  @override
  State<WuyMapScreen> createState() => _WuyMapScreenState();
}

class _WuyMapScreenState extends State<WuyMapScreen> {
  late TencentMapController _mapController;
  late TencentMapsService _mapService;
  FriendModelAppWuy? activeFriend;

  @override
  void initState() {
    super.initState();
    _mapService = TencentMapsService(
      apiKey: AppConfigAppWuy.getTencentMapApiKey(),
      language: AppConfigAppWuy.defaultMapLanguage,
      region: AppConfigAppWuy.defaultMapRegion,
    );

    _loadActiveFriend();

    if (activeFriend != null && activeFriend!.lastLocation != null) {
      final lat = activeFriend!.lastLocation!['lat'] as double? ?? 39.9042;
      final lng = activeFriend!.lastLocation!['lng'] as double? ?? 116.4074;

      _mapController = TencentMapController(
        service: _mapService,
        initialZoom: 15.0,
        initialStyle: TencentMapStyle.normal,
        initialLatitude: lat,
        initialLongitude: lng,
      );

      _addFriendMarker(lat, lng);
    } else {
      _mapController = TencentMapController(
        service: _mapService,
        initialZoom: 15.0,
        initialStyle: TencentMapStyle.normal,
        initialLatitude: 39.9042,
        initialLongitude: 116.4074,
      );
    }
  }

  void _loadActiveFriend() {
    final friends = WuyFakeDataGenerator.generateFakeFriends();
    if (friends.isNotEmpty) {
      setState(() {
        activeFriend = friends.first;
      });
    }
  }

  void _addFriendMarker(double lat, double lng) {
    if (activeFriend == null) return;

    _mapController.addMarker(
      TencentMapMarker(
        id: 'friend_marker',
        latitude: lat,
        longitude: lng,
        title: activeFriend!.displayName,
        snippet: activeFriend!.relationship ?? '',
        onTap: () {
          // Marker tapped
        },
      ),
    );
  }

  @override
  void dispose() {
    _mapController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final currentRoute = GoRouterState.of(context).uri.toString();

    return Scaffold(
      body: Stack(
        children: [
          // Full screen map
          Positioned.fill(
            child: TencentMapWidget(
              controller: _mapController,
              showMyLocation: true,
              showCompass: true,
              showScale: true,
              enableZoomControls: false,
              enableRotation: true,
              enableScrolling: true,
              onTap: (latitude, longitude) {
                debugPrint('Map tapped: $latitude, $longitude');
              },
            ),
          ),

          // Floating header controls (top right)
          Positioned(
            top: 48,
            right: 20,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _buildFloatingButton(
                  icon: Icons.warning_amber_rounded,
                  color: ThemeColors.red,
                  onTap: _handleSosTap,
                  isPulsing: true,
                ),
                const SizedBox(width: 12),
                _buildFloatingButton(
                  icon: Icons.notifications_outlined,
                  color: ThemeColors.blue,
                  onTap: _handleNotificationTap,
                ),
              ],
            ),
          ),

          // Bottom friend card (above navigation)
          if (activeFriend != null)
            Positioned(
              bottom: 96,
              left: 16,
              right: 16,
              child: _buildFriendCard(context),
            ),

          // Bottom navigation (Positioned for Stack layout)
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: WuyBottomNavigation(currentRoute: currentRoute),
          ),
        ],
      ),
    );
  }

  Widget _buildFloatingButton({
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
    bool isPulsing = false,
  }) {
    Widget button = Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: ThemeColors.white.withOpacity(0.9),
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.1),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: ClipOval(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: onTap,
              child: Icon(
                icon,
                color: color,
                size: 20,
              ),
            ),
          ),
        ),
      ),
    );

    if (isPulsing) {
      return TweenAnimationBuilder<double>(
        tween: Tween(begin: 1.0, end: 1.1),
        duration: const Duration(milliseconds: 1000),
        curve: Curves.easeInOut,
        builder: (context, value, child) {
          return Transform.scale(
            scale: value,
            child: button,
          );
        },
        onEnd: () {
          // Restart animation
          setState(() {});
        },
      );
    }

    return button;
  }

  void _handleSosTap() {
    // Handle SOS button tap
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(LocalizationKeysAppWuy.wuyHomeSos.tr(context)),
      ),
    );
  }

  void _handleNotificationTap() {
    // Handle notification button tap
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Notifications'),
      ),
    );
  }

  Widget _buildFriendCard(BuildContext context) {
    if (activeFriend == null) return const SizedBox.shrink();

    final friend = activeFriend!;
    final daysConnected = friend.daysTogether ?? 0;
    final batteryLevel = 85; // Mock battery level

    return GlassCard(
      padding: EdgeInsets.zero,
      borderRadius: BorderRadius.circular(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Friend info section
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                // Avatar with online indicator
                Stack(
                  children: [
                    CircleAvatar(
                      radius: 28,
                      backgroundColor: ThemeColors.grey200,
                      backgroundImage: friend.avatarUrl != null
                          ? NetworkImage(friend.avatarUrl!)
                          : null,
                      child: friend.avatarUrl == null
                          ? Icon(Icons.person,
                              size: 28, color: ThemeColors.grey600)
                          : null,
                    ),
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: Container(
                        width: 12,
                        height: 12,
                        decoration: BoxDecoration(
                          color: ThemeColors.green,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: ThemeColors.white,
                            width: 2,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            friend.displayName,
                            style: ThemeTextStyles.title3Bold.copyWith(
                              fontWeight: FontWeight.bold,
                              fontSize: 18,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: ThemeColors.blue.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              friend.relationship ?? '',
                              style: ThemeTextStyles.caption1.copyWith(
                                color: ThemeColors.blue,
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Icon(
                            Icons.favorite,
                            size: 12,
                            color: ThemeColors.pink,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            '${LocalizationKeysAppWuy.wuyHomeDays.tr(context)}: $daysConnected',
                            style: ThemeTextStyles.caption2.copyWith(
                              color: ThemeColors.grey600,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                // Battery indicator
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      LocalizationKeysAppWuy.wuyHomeBattery.tr(context),
                      style: ThemeTextStyles.caption2.copyWith(
                        color: ThemeColors.grey400,
                        fontSize: 10,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '$batteryLevel%',
                      style: ThemeTextStyles.bodyMedium.copyWith(
                        fontFamily: 'monospace',
                        fontWeight: FontWeight.bold,
                        color: ThemeColors.green,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Action buttons section
          Container(
            decoration: BoxDecoration(
              color: ThemeColors.white.withOpacity(0.3),
              border: Border(
                top: BorderSide(
                  color: ThemeColors.white.withOpacity(0.4),
                  width: 1,
                ),
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: _buildActionButton(
                    icon: Icons.warning_amber_rounded,
                    label: LocalizationKeysAppWuy.wuyHomeSos.tr(context),
                    color: ThemeColors.red,
                    onTap: _handleSosTap,
                  ),
                ),
                Container(
                  width: 1,
                  height: 40,
                  color: ThemeColors.white.withOpacity(0.4),
                ),
                Expanded(
                  child: _buildActionButton(
                    icon: Icons.track_changes,
                    label: LocalizationKeysAppWuy.wuyHomeFence.tr(context),
                    color: ThemeColors.blue,
                    onTap: _handleFenceTap,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButton({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 16, color: color),
              const SizedBox(width: 8),
              Text(
                label,
                style: ThemeTextStyles.bodySmall.copyWith(
                  color: color,
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _handleFenceTap() {
    // Handle fence button tap
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(LocalizationKeysAppWuy.wuyHomeFence.tr(context)),
      ),
    );
  }
}
