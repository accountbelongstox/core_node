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

import 'dart:io';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:qyflutter/common/widgets/custom_app_bar.dart';
import 'package:qyflutter/common/widgets/custom_button.dart';
import 'package:qyflutter/common/widgets/custom_text_field.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/assets/common_assets_icons.dart';
import 'package:qyflutter/apps/app_qy/controller_app_qy/profile_controller_app_qy.dart';

/// Profile Edit Screen with integrated settings and auth support
///
/// Features:
/// - Settings controller integration for user preferences
/// - Auth API service integration for user data
/// - Profile photo upload with camera/gallery options
/// - Form validation and error handling
/// - Responsive design with loading states
class ProfileEditScreenView extends StatelessWidget {
  const ProfileEditScreenView({super.key});

  @override
  Widget build(BuildContext context) {
    // Initialize controller with context
    final controller = ProfileControllerAppQy(context);
    return Scaffold(
      appBar: const CustomAppBar(title: "Edit Profile"),
      body: Obx(() {
        if (controller.isLoading) {
          return const Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                CircularProgressIndicator(),
                SizedBox(height: 16),
                Text('Loading profile...'),
              ],
            ),
          );
        }

        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: ThemeDimensions.defaultSize),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Profile Photo Section
              Center(
                child: Stack(
                  children: [
                    CircleAvatar(
                      backgroundColor: Theme.of(context).colorScheme.onTertiary,
                      radius: ThemeDimensions.fortySize,
                      backgroundImage: _getProfileImage(controller),
                      child: _getProfileImage(controller) == null
                          ? Text(
                              controller.userInitials,
                              style: TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.bold,
                                color: Theme.of(context).colorScheme.primary,
                              ),
                            )
                          : null,
                    ),
                    Positioned(
                      top: 35,
                      left: 45,
                      child: IconButton(
                        onPressed: () => _showPhotoOptions(controller),
                        icon: Icon(
                          Icons.camera_enhance,
                          color: Theme.of(context).colorScheme.surfaceTint,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: ThemeDimensions.sizeFifteen),

              // Profile Completion Indicator
              if (controller.hasUser)
                Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.primaryContainer,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.person,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Profile Completion',
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                color: Theme.of(context).colorScheme.primary,
                              ),
                            ),
                            const SizedBox(height: 4),
                            LinearProgressIndicator(
                              value: controller.profileCompletionPercentage,
                              backgroundColor: Theme.of(context).colorScheme.outline.withOpacity(0.3),
                              valueColor: AlwaysStoppedAnimation<Color>(
                                Theme.of(context).colorScheme.primary,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Text(
                        '${(controller.profileCompletionPercentage * 100).toInt()}%',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: Theme.of(context).colorScheme.primary,
                        ),
                      ),
                    ],
                  ),
                ),

              // Error Message
              if (controller.errorMessage?.isNotEmpty == true)
                Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.red.shade200),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.error, color: Colors.red.shade700),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          controller.errorMessage ?? '',
                          style: TextStyle(color: Colors.red.shade700),
                        ),
                      ),
                    ],
                  ),
                ),

              // Form Fields
              Expanded(
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildFormField(
                        context: context,
                        label: 'Full Name',
                        controller: controller.nameController,
                        prefixIcon: CommonAssetsIcons.name,
                        required: true,
                      ),
                      _buildFormField(
                        context: context,
                        label: 'Email',
                        controller: controller.emailController,
                        prefixIcon: CommonAssetsIcons.email,
                        required: true,
                        keyboardType: TextInputType.emailAddress,
                      ),
                      _buildFormField(
                        context: context,
                        label: 'Phone Number',
                        controller: controller.phoneController,
                        prefixIcon: CommonAssetsIcons.phone,
                        keyboardType: TextInputType.phone,
                      ),
                      _buildFormField(
                        context: context,
                        label: 'Bio',
                        controller: controller.bioController,
                        prefixIcon: CommonAssetsIcons.placeholder,
                        maxLines: 3,
                        hintText: 'Tell us about yourself...',
                      ),
                      _buildFormField(
                        context: context,
                        label: 'Location',
                        controller: controller.locationController,
                        prefixIcon: CommonAssetsIcons.location,
                        hintText: 'City, Country',
                      ),

                      // Settings Integration Section
                      const SizedBox(height: 20),
                      Text(
                        'Privacy Settings',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Notifications Toggle
                      Card(
                        child: SwitchListTile(
                          title: const Text('Enable Notifications'),
                          subtitle: const Text('Receive updates and messages'),
                          value: controller.notificationsEnabled,
                          onChanged: (value) => controller.toggleNotifications(),
                          secondary: const Icon(Icons.notifications),
                        ),
                      ),

                      // Privacy Level Dropdown
                      Card(
                        child: ListTile(
                          leading: const Icon(Icons.privacy_tip),
                          title: const Text('Profile Visibility'),
                          subtitle: Text('Current: ${controller.privacyLevel}'),
                          trailing: DropdownButton<String>(
                            value: controller.privacyLevel,
                            items: const [
                              DropdownMenuItem(value: 'public', child: Text('Public')),
                              DropdownMenuItem(value: 'friends', child: Text('Friends Only')),
                              DropdownMenuItem(value: 'private', child: Text('Private')),
                            ],
                            onChanged: (value) {
                              if (value != null) {
                                controller.setPrivacyLevel(value);
                              }
                            },
                          ),
                        ),
                      ),

                      const SizedBox(height: 30),
                    ],
                  ),
                ),
              ),

              // Update Button
              CustomButton(
                buttonText: controller.isSaving ? "Updating..." : "Update Profile",
                onPressed: controller.isSaving || !controller.isFormValid ? null : () => _handleUpdateProfile(controller),
                backgroundColor: controller.isFormValid
                    ? Theme.of(context).colorScheme.primary
                    : Theme.of(context).colorScheme.outline,
              ),
              const SizedBox(height: 20),
            ],
          ),
        );
      }),
    );
  }

  // Helper Methods

  /// Get profile image for display
  ImageProvider? _getProfileImage(ProfileControllerAppQy controller) {
    if (controller.profilePhotoFile != null) {
      return FileImage(controller.profilePhotoFile!);
    }
    if (controller.currentProfile?.avatar != null &&
        controller.currentProfile!.avatar!.isNotEmpty) {
      return NetworkImage(controller.currentProfile!.avatar!);
    }
    return null;
  }

  /// Show photo selection options
  void _showPhotoOptions(ProfileControllerAppQy controller) {
    showModalBottomSheet(
      context: Get.context!,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Select Profile Photo',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 20),
              ListTile(
                leading: const Icon(Icons.photo_library),
                title: const Text('Choose from Gallery'),
                onTap: () {
                  Navigator.pop(context);
                  controller.pickProfilePhotoFromGallery();
                },
              ),
              ListTile(
                leading: const Icon(Icons.camera_alt),
                title: const Text('Take Photo'),
                onTap: () {
                  Navigator.pop(context);
                  controller.takeProfilePhoto();
                },
              ),
              ListTile(
                leading: const Icon(Icons.cancel),
                title: const Text('Cancel'),
                onTap: () => Navigator.pop(context),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Build form field widget
  Widget _buildFormField({
    required BuildContext context,
    required String label,
    required TextEditingController controller,
    required String prefixIcon,
    bool required = false,
    TextInputType? keyboardType,
    int maxLines = 1,
    String? hintText,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8.0),
          child: Text(
            required ? '$label *' : label,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              fontWeight: required ? FontWeight.w600 : FontWeight.normal,
              color: required
                  ? Theme.of(context).colorScheme.primary
                  : Theme.of(context).colorScheme.onSurface,
            ),
          ),
        ),
        CustomTextField(
          controller: controller,
          showCountryCode: false,
          prefixIcon: prefixIcon,
          inputType: keyboardType ?? TextInputType.text,
          maxLines: maxLines,
          hintText: hintText ?? label,
        ),
        const SizedBox(height: ThemeDimensions.sizeFifteen),
      ],
    );
  }

  /// Handle profile update
  Future<void> _handleUpdateProfile(ProfileControllerAppQy controller) async {
    final success = await controller.saveProfile();
    if (success) {
      Navigator.pop(Get.context!);
    }
  }
}
