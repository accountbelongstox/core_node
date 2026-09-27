// Refactored by: Claude Code AI Assistant
// Date: 2024-12-19
// Changes: Updated to use proper theming, common components, and follow new Flutter guide standards
// Note to other AIs: This screen now uses AChatBottomNavigation and proper theme constants

import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/common_widgets/bottom_navigation/common_bottom_navigation.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/profile/domain/model/profile_model.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/profile/domain/service/profile_service.dart';
import '../widgets/profile_header.dart';
import '../widgets/profile_menu.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _profileService = ProfileService();
  late ProfileModel _profile = ProfileModel.defaultProfile();
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    try {
      final profile = await _profileService.getProfile();
      if (mounted) {
        setState(() {
          _profile = profile;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to load profile: ${e.toString()}'),
            backgroundColor: ThemeColors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadProfile,
              child: SingleChildScrollView(
                child: Column(
                  children: [
                    ProfileHeader(
                      profile: _profile,
                      onQrCodeTap: () => _profileService.navigateToQrCode(context),
                    ),
                    ProfileMenu(
                      onPrivacyTap: () => _profileService.navigateToPrivacy(context),
                      onNotificationTap: () => _profileService.navigateToNotification(context),
                      onLanguageTap: () => _profileService.navigateToLanguage(context),
                    ),
                  ],
                ),
              ),
            ),
      bottomNavigationBar: const CommonBottomNavigation(currentIndex: 3),
    );
  }
}
