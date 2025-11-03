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
import 'package:provider/provider.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/sdk/tencent_maps/tencent_maps_sdk.dart';
import '../../../router_app_wuy/router_app_wuy.dart';
import '../../../localization_app_wuy/localization_keys_app_wuy.dart';
import '../../../providers_app_wuy/wu_user_provider.dart';
import '../../../config_app_wuy/app_config_app_wuy.dart';
import '../../../theme_app_wuy/theme_config_app_wuy.dart';
import '../../../models_app_wuy/friend_model_app_wuy.dart';
import '../../../services_app_wuy/wuy_fake_data_generator.dart';

/// Map Screen for Wuy App
///
/// This screen displays map functionality and location services.
///
/// Localization Usage:
/// - All user-facing text uses LocalizationKeysAppWuy constants with .tr(context) method
/// - Text keys are defined in localization_keys_app_wuy.dart
/// - Translations are provided in en_app_wuy.dart and zh_app_wuy.dart
/// - Example: LocalizationKeysAppWuy.wuyMapTitle.tr(context)
class WuyMapScreen extends StatefulWidget {
  const WuyMapScreen({super.key});

  @override
  State<WuyMapScreen> createState() => _WuyMapScreenState();
}

class _WuyMapScreenState extends State<WuyMapScreen> {
  late TencentMapController _mapController;
  late TencentMapsService _mapService;
  FriendModelAppWuy? selectedFriend;

  @override
  void initState() {
    super.initState();
    _mapService = TencentMapsService(
      apiKey: AppConfigAppWuy.getTencentMapApiKey(),
      language: AppConfigAppWuy.defaultMapLanguage,
      region: AppConfigAppWuy.defaultMapRegion,
    );

    _mapController = TencentMapController(
      service: _mapService,
      initialZoom: 15.0,
      initialStyle: TencentMapStyle.normal,
      initialLatitude: 39.908823,
      initialLongitude: 116.397470,
    );

    _loadSelectedFriend();
    _addSampleMarkers();
  }

  void _loadSelectedFriend() {
    final friends = WuyFakeDataGenerator.generateFakeFriends();
    if (friends.isNotEmpty) {
      selectedFriend = friends.first;
    }
  }

  @override
  void dispose() {
    _mapController.dispose();
    super.dispose();
  }

  void _addSampleMarkers() {
    _mapController.addMarker(
      TencentMapMarker(
        id: 'marker_1',
        latitude: 39.908823,
        longitude: 116.397470,
        title: LocalizationKeysAppWuy.wuyMapBeijing.tr(context),
        snippet: LocalizationKeysAppWuy.wuyMapCapitalOfChina.tr(context),
        onTap: () {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                '${LocalizationKeysAppWuy.wuyMapBeijing.tr(context)} ${LocalizationKeysAppWuy.wuyMapMarkerTapped.tr(context)}',
              ),
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.lightBackground,
      appBar: AppBar(
        title: Text(
          LocalizationKeysAppWuy.wuyMapTitle.tr(context),
          style: ThemeTextStyles.displayMedium,
        ),
        backgroundColor: ThemeColors.primary,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.my_location, color: ThemeColors.white),
            onPressed: _centerOnCurrentLocation,
          ),
          IconButton(
            icon: const Icon(Icons.layers, color: ThemeColors.white),
            onPressed: _showMapStyleDialog,
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

  void _centerOnCurrentLocation() {
    _mapController.animateCamera(
      latitude: 39.908823,
      longitude: 116.397470,
      zoom: 15.0,
    );
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(LocalizationKeysAppWuy.wuyMapCenterLocation.tr(context)),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  void _showMapStyleDialog() {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: Text(LocalizationKeysAppWuy.wuyMapStyleTitle.tr(context)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildMapStyleOption(TencentMapStyle.normal, LocalizationKeysAppWuy.wuyMapStyleNormal.tr(context)),
              _buildMapStyleOption(TencentMapStyle.satellite, LocalizationKeysAppWuy.wuyMapStyleSatellite.tr(context)),
              _buildMapStyleOption(TencentMapStyle.dark, LocalizationKeysAppWuy.wuyMapStyleDark.tr(context)),
              _buildMapStyleOption(TencentMapStyle.light, LocalizationKeysAppWuy.wuyMapStyleLight.tr(context)),
              _buildMapStyleOption(TencentMapStyle.traffic, LocalizationKeysAppWuy.wuyMapStyleTraffic.tr(context)),
            ],
          ),
        );
      },
    );
  }

  Widget _buildMapStyleOption(TencentMapStyle style, String label) {
    return ListTile(
      title: Text(label),
      onTap: () {
        _mapController.setMapStyle(style);
        Navigator.pop(context);
      },
    );
  }

  Widget _buildMapView() {
    return TencentMapWidget(
      controller: _mapController,
      showMyLocation: true,
      showCompass: true,
      showScale: true,
      enableZoomControls: true,
      enableRotation: true,
      enableScrolling: true,
      onTap: (latitude, longitude) {
        debugPrint('Map tapped: $latitude, $longitude');
      },
    );
  }

  Widget _buildFloatingProfileCard() {
    if (selectedFriend == null) {
      return const SizedBox.shrink();
    }

    final friend = selectedFriend!;

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
                      color: ThemeColors.white,
                    ),
                  ),
                  SizedBox(width: ThemeDimensions.spacingMedium),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              friend.displayName,
                              style: ThemeTextStyles.title3Bold,
                            ),
                            if (friend.daysTogether != null) ...[
                              SizedBox(width: ThemeDimensions.spacing8),
                              Container(
                                padding: EdgeInsets.symmetric(
                                  horizontal: ThemeDimensions.spacing8,
                                  vertical: ThemeDimensions.spacing4,
                                ),
                                decoration: BoxDecoration(
                                  color: ThemeColors.orange.withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  '${friend.daysTogether} days',
                                  style: ThemeTextStyles.caption1.copyWith(
                                    color: ThemeColors.orange,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                        SizedBox(height: ThemeDimensions.spacing4),
                        Row(
                          children: [
                            if (friend.relationship != null) ...[
                              Icon(
                                _getRelationshipIcon(friend.relationship!),
                                size: 14,
                                color: ThemeColors.primary,
                              ),
                              SizedBox(width: ThemeDimensions.spacing4),
                              Text(
                                friend.relationship!,
                                style: ThemeTextStyles.subhead.copyWith(
                                  color: ThemeColors.primary,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              SizedBox(width: ThemeDimensions.spacing8),
                            ],
                            Expanded(
                              child: Text(
                                friend.bio ?? '',
                                style: ThemeTextStyles.footnote.copyWith(
                                  color: ThemeColors.secondaryLabel,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: Icon(Icons.info_outline, color: ThemeColors.primary),
                    onPressed: () {
                      context.go(WuyAppRouter.getFriendInfoRoute(friend.id));
                    },
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  IconData _getRelationshipIcon(String relationship) {
    switch (relationship.toLowerCase()) {
      case 'partner':
      case 'boyfriend':
      case 'girlfriend':
        return Icons.favorite;
      case 'family':
        return Icons.family_restroom;
      case 'colleague':
        return Icons.work;
      default:
        return Icons.people;
    }
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
          color: ThemeColors.white,
          boxShadow: [
            BoxShadow(
              color: ThemeColors.black.withOpacity(0.1),
              blurRadius: 10,
              offset: Offset(0, -2),
            ),
          ],
        ),
        child: SafeArea(
          child: Container(
            height: 60,
            padding: EdgeInsets.symmetric(
                horizontal: ThemeDimensions.defaultPadding),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildNavItem(
                  Icons.map,
                  LocalizationKeysAppWuy.wuyMapTitle.tr(context),
                  true,
                  null,
                ),
                _buildNavItem(
                  Icons.people,
                  LocalizationKeysAppWuy.wuyMapFriends.tr(context),
                  false,
                  () => context.go(WuyAppRouter.getFriendsRoute()),
                ),
                _buildNavItem(
                  Icons.person,
                  LocalizationKeysAppWuy.wuyMapMine.tr(context),
                  false,
                  () => context.go(WuyAppRouter.getProfileRoute()),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(
      IconData icon, String label, bool isSelected, VoidCallback? onTap) {
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
              color:
                  isSelected ? ThemeColors.primary : ThemeColors.textSecondary,
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
