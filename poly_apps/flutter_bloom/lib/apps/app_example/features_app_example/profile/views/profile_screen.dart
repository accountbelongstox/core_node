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

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:qyflutter/common/widgets/custom_app_bar.dart';
import 'package:qyflutter/common/widgets/custom_button.dart';
import 'package:qyflutter/common/widgets/custom_text_field.dart';
import 'package:qyflutter/apps/app_example/controller_app_example/profile_controller_app_example.dart';
import 'package:qyflutter/apps/app_example/features_app_example/interest/select_interest.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/assets/common_assets_icons.dart';
import 'package:get/get.dart';

class ProfileScreenView extends StatelessWidget {
  const ProfileScreenView({super.key});

  @override
  Widget build(BuildContext context) {
    // Initialize controller with context
    final controller = ProfileControllerAppExample(context);
    return Scaffold(
      backgroundColor: Theme.of(context).cardColor,
      appBar: const CustomAppBar(title: "Fill Your Profile"),
      body: Padding(
        padding: const EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Obx(() => Stack(
                    children: [
                      CircleAvatar(
                        backgroundColor: Theme.of(context).colorScheme.onTertiary,
                        radius: ThemeDimensions.radiusBig,
                        backgroundImage: _getProfileImage(controller),
                        child: _getProfileImage(controller) == null
                            ? Text(
                                controller.userInitials,
                                style: TextStyle(
                                  fontSize: 32,
                                  fontWeight: FontWeight.bold,
                                  color: Theme.of(context).colorScheme.primary,
                                ),
                              )
                            : null,
                      ),
                      Positioned(
                        top: 60,
                        left: 60,
                        child: IconButton(
                          onPressed: () => _showPhotoOptions(controller),
                          icon: Icon(
                            Icons.camera_enhance,
                            color: Theme.of(context).colorScheme.surfaceTint,
                          ),
                        ),
                      ),
                    ],
                  )),
            ),
            const SizedBox(
              height: ThemeDimensions.sizeTwentyFive,
            ),
            const Text('Full Name *'),
            CustomTextField(
              controller: controller.nameController,
              showCountryCode: false,
              prefixIcon: CommonAssetsIcons.name,
              hintText: "Enter your full name",
            ),
            const SizedBox(height: 8),
            const Text('Email *'),
            CustomTextField(
              controller: controller.emailController,
              showCountryCode: false,
              prefixIcon: CommonAssetsIcons.email,
              hintText: "Enter your email",
              inputType: TextInputType.emailAddress,
            ),
            const SizedBox(height: 8),
            const Text("Phone Number"),
            CustomTextField(
              controller: controller.phoneController,
              showCountryCode: false,
              hintText: "Enter phone number",
              prefixIcon: CommonAssetsIcons.phone,
              inputType: TextInputType.phone,
            ),
            const SizedBox(height: 8),
            const Text("Bio"),
            CustomTextField(
              controller: controller.bioController,
              showCountryCode: false,
              prefixIcon: CommonAssetsIcons.bio,
              hintText: "Tell us about yourself",
              maxLines: 2,
            ),
            const SizedBox(height: 8),
            const Text("Location"),
            CustomTextField(
              controller: controller.locationController,
              showCountryCode: false,
              prefixIcon: CommonAssetsIcons.location,
              hintText: "City, Country",
            ),
            // Error Message
            Obx(() {
              if (controller.errorMessage?.isNotEmpty == true) {
                return Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.symmetric(vertical: 8),
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
                );
              }
              return const SizedBox.shrink();
            }),

            Padding(
              padding: const EdgeInsets.symmetric(
                  vertical: ThemeDimensions.paddingSizeDefault),
              child: Obx(() => CustomButton(
                onPressed: controller.isSaving || !controller.isFormValid
                    ? null
                    : () => _handleContinue(controller),
                radius: ThemeDimensions.radiusBig,
                backgroundColor: controller.isFormValid
                    ? Theme.of(context).colorScheme.surfaceTint
                    : Theme.of(context).colorScheme.outline,
                borderColor: controller.isFormValid
                    ? Theme.of(context).colorScheme.surfaceTint
                    : Theme.of(context).colorScheme.outline,
                height: ThemeDimensions.largeExtraSize,
                width: double.infinity,
                buttonText: controller.isSaving ? "Saving..." : "Continue",
              )),
            ),
          ],
        ),
      ),
    );
  }

  // Helper Methods

  /// Get profile image for display
  ImageProvider? _getProfileImage(ProfileControllerAppExample controller) {
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
  void _showPhotoOptions(ProfileControllerAppExample controller) {
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

  /// Handle continue button press
  Future<void> _handleContinue(ProfileControllerAppExample controller) async {
    final success = await controller.saveProfile();
    if (success) {
      Get.to(const SelectInsterestScreenView());
    }
  }
}
