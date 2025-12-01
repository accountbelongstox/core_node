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


import 'package:flutter/material.dart';
import 'package:qyflutter/common/widgets/custom_app_bar.dart';
import 'package:qyflutter/common/widgets/custom_button.dart';
import 'package:qyflutter/common/widgets/custom_text_field.dart';
import 'package:qyflutter/apps/app_qy/controller_app_qy/profile_controller_app_qy.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/interest/select_interest.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/assets/common_assets_icons.dart';
import 'package:get/get.dart';
import 'package:qyflutter/apps/app_qy/localization_app_qy/localization_keys_app_qy.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';
import 'package:qyflutter/common/localization/localization_manager.dart' as LocalizationManager;

class ProfileScreenView extends StatelessWidget {
  const ProfileScreenView({super.key});

  @override
  Widget build(BuildContext context) {
    // Initialize controller with context
    final controller = ProfileControllerAppQy(context);
    return Scaffold(
      backgroundColor: Theme.of(context).cardColor,
      appBar: CustomAppBar(title: LocalizationManager.StringTranslationExtension(QyAppLocalizationKeys.qyProfileFill).tr(context)),
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
            Text(LocalizationManager.StringTranslationExtension(QyAppLocalizationKeys.qyProfileFullName).tr(context)),
            CustomTextField(
              controller: controller.nameController,
              showCountryCode: false,
              prefixIcon: CommonAssetsIcons.name,
              hintText: LocalizationManager.StringTranslationExtension(QyAppLocalizationKeys.qyProfileEnterFullName).tr(context),
            ),
            const SizedBox(height: 8),
            Text(LocalizationManager.StringTranslationExtension(QyAppLocalizationKeys.qyProfileEmail).tr(context)),
            CustomTextField(
              controller: controller.emailController,
              showCountryCode: false,
              prefixIcon: CommonAssetsIcons.email,
              hintText: LocalizationManager.StringTranslationExtension(QyAppLocalizationKeys.qyProfileEnterEmail).tr(context),
              inputType: TextInputType.emailAddress,
            ),
            const SizedBox(height: 8),
            Text(LocalizationManager.StringTranslationExtension(QyAppLocalizationKeys.qyProfilePhone).tr(context)),
            CustomTextField(
              controller: controller.phoneController,
              showCountryCode: false,
              hintText: LocalizationManager.StringTranslationExtension(QyAppLocalizationKeys.qyProfileEnterPhone).tr(context),
              prefixIcon: CommonAssetsIcons.phone,
              inputType: TextInputType.phone,
            ),
            const SizedBox(height: 8),
            Text(LocalizationManager.StringTranslationExtension(QyAppLocalizationKeys.qyBio).tr(context)),
            CustomTextField(
              controller: controller.bioController,
              showCountryCode: false,
              prefixIcon: CommonAssetsIcons.bio,
              hintText: LocalizationManager.StringTranslationExtension(QyAppLocalizationKeys.qyProfileTellAboutYourself).tr(context),
              maxLines: 2,
            ),
            const SizedBox(height: 8),
            Text(LocalizationManager.StringTranslationExtension(QyAppLocalizationKeys.qyProfileLocation).tr(context)),
            CustomTextField(
              controller: controller.locationController,
              showCountryCode: false,
              prefixIcon: CommonAssetsIcons.location,
              hintText: LocalizationManager.StringTranslationExtension(QyAppLocalizationKeys.qyProfileCityCountry).tr(context),
            ),
            // Error Message
            Obx(() {
              if (controller.errorMessage?.isNotEmpty == true) {
                return Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(
                    color: ColorsAppQy.qyError.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: ColorsAppQy.qyError.withOpacity(0.3)),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.error, color: ColorsAppQy.qyError),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          controller.errorMessage ?? '',
                          style: TextStyle(color: ColorsAppQy.qyError),
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
                buttonText: controller.isSaving 
                    ? LocalizationManager.StringTranslationExtension(QyAppLocalizationKeys.qyProfileSaving).tr(context)
                    : LocalizationManager.StringTranslationExtension(QyAppLocalizationKeys.qyProfileContinue).tr(context),
              )),
            ),
          ],
        ),
      ),
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
                LocalizationManager.StringTranslationExtension(QyAppLocalizationKeys.qyProfileSelectPhoto).tr(context),
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 20),
              ListTile(
                leading: const Icon(Icons.photo_library),
                title: Text(LocalizationManager.StringTranslationExtension(QyAppLocalizationKeys.qyProfileChooseGallery).tr(context)),
                onTap: () {
                  Navigator.pop(context);
                  controller.pickProfilePhotoFromGallery();
                },
              ),
              ListTile(
                leading: const Icon(Icons.camera_alt),
                title: Text(LocalizationManager.StringTranslationExtension(QyAppLocalizationKeys.qyProfileTakePhoto).tr(context)),
                onTap: () {
                  Navigator.pop(context);
                  controller.takeProfilePhoto();
                },
              ),
              ListTile(
                leading: const Icon(Icons.cancel),
                title: Text(LocalizationManager.StringTranslationExtension(QyAppLocalizationKeys.qyCancel).tr(context)),
                onTap: () => Navigator.pop(context),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Handle continue button press
  Future<void> _handleContinue(ProfileControllerAppQy controller) async {
    final success = await controller.saveProfile();
    if (success) {
      Get.to(const SelectInsterestScreenView());
    }
  }
}
