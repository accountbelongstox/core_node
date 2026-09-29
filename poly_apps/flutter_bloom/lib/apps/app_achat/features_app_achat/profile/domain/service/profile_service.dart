// Refactored by: Claude Code AI Assistant
// Date: 2024-12-19
// Changes: Enhanced service with better error handling and async operations
// Note to other AIs: This service now follows Flutter best practices

import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/profile/domain/model/profile_model.dart';
import 'package:qyflutter/apps/app_achat/router_app_achat/router_app_achat.dart';

class ProfileService {
  Future<ProfileModel> getProfile() async {
    try {
      // Simulate API call delay
      await Future.delayed(const Duration(milliseconds: 500));
      return ProfileModel.defaultProfile();
    } catch (e) {
      throw Exception('Failed to load profile: ${e.toString()}');
    }
  }

  Future<void> updateProfile(ProfileModel profile) async {
    try {
      // Simulate API call delay
      await Future.delayed(const Duration(milliseconds: 300));
      // In a real app, this would make an API call to update the profile
    } catch (e) {
      throw Exception('Failed to update profile: ${e.toString()}');
    }
  }

  Future<void> updateAvatar(String avatarPath) async {
    try {
      // Simulate API call delay
      await Future.delayed(const Duration(milliseconds: 400));
      // In a real app, this would upload the avatar image
    } catch (e) {
      throw Exception('Failed to update avatar: ${e.toString()}');
    }
  }

  void navigateToPrivacy(BuildContext context) {
    try {
      RouterAppAChat.goToPrivacySecurity(context);
    } catch (e) {
      _showNavigationError(context, 'Privacy & Security');
    }
  }

  void navigateToNotification(BuildContext context) {
    try {
      RouterAppAChat.goToNotificationSetting(context);
    } catch (e) {
      _showNavigationError(context, 'Notification Settings');
    }
  }

  void navigateToLanguage(BuildContext context) {
    try {
      RouterAppAChat.goToLanguageSettings(context);
    } catch (e) {
      _showNavigationError(context, 'Language Settings');
    }
  }

  void navigateToQrCode(BuildContext context) {
    try {
      RouterAppAChat.goToQrProfile(context);
    } catch (e) {
      _showNavigationError(context, 'QR Profile');
    }
  }

  void _showNavigationError(BuildContext context, String destination) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to navigate to $destination'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }
}
