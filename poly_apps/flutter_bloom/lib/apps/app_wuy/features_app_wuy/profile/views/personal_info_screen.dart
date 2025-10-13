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
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/widgets/floating_avatar_header.dart';
import 'package:qyflutter/common/assets/common_assets_images.dart';
import '../../../router_app_wuy/router_app_wuy.dart';
import '../../../localization_app_wuy/localization_keys_app_wuy.dart';
import '../../../services_app_wuy/wuy_data_manager.dart';

/// Personal Info Screen for Wuy App
///
/// This screen allows users to view and edit their personal information.
///
/// Localization Usage:
/// - All user-facing text uses LocalizationKeysAppWuy constants with .tr(context) method
/// - Text keys are defined in localization_keys_app_wuy.dart
/// - Translations are provided in en_app_wuy.dart and zh_app_wuy.dart
/// - Example: LocalizationKeysAppWuy.wuyProfilePersonalInfo.tr(context)
class WuyPersonalInfoScreen extends StatefulWidget {
  const WuyPersonalInfoScreen({super.key});

  @override
  State<WuyPersonalInfoScreen> createState() => _WuyPersonalInfoScreenState();
}

class _WuyPersonalInfoScreenState extends State<WuyPersonalInfoScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nicknameController = TextEditingController();
  final _signatureController = TextEditingController();
  final _phoneController = TextEditingController();
  final _birthdayController = TextEditingController();
  final _addressController = TextEditingController();
  final _emailController = TextEditingController();
  final _idController = TextEditingController();

  String _selectedGender = 'male';
  bool _isEditing = false;

  @override
  void initState() {
    super.initState();
    _initializeFormData();
  }

  void _initializeFormData() {
    // Initialize form data from data manager
    final dataManager = WuyDataManager.instance;
    final user = dataManager.currentUser;

    _nicknameController.text = user?.displayName ?? user?.name ?? '';
    _signatureController.text = user?.about ?? '';
    _phoneController.text = user?.phoneNumber ?? user?.phone ?? '';
    _birthdayController.text = user?.birthday ?? '';
    _addressController.text = user?.city ?? '';
    _emailController.text = user?.email ?? '';
    _idController.text = user?.meta['id_number']?.toString() ?? '';
    _selectedGender = user?.gender ?? 'male';
  }

  @override
  void dispose() {
    _nicknameController.dispose();
    _signatureController.dispose();
    _phoneController.dispose();
    _birthdayController.dispose();
    _addressController.dispose();
    _emailController.dispose();
    _idController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dataManager = WuyDataManager.instance;
    final user = dataManager.currentUser;

    return Scaffold(
      backgroundColor: ThemeColors.lightBackground,
      body: Column(
        children: [
          // Floating avatar header with background2
          FloatingAvatarHeader(
            backgroundImage: CommonAssetsImages.wuyBackground2,
            avatarImage: user?.avatarUrl ?? user?.avatar,
            displayName: user?.displayName ?? user?.name ?? '',
            subtitle: user?.about ?? '',
            onBackTap: () => context.go(WuyAppRouter.getProfileRoute()),
            onAvatarTap: () {
              // Handle avatar tap - could open image picker
            },
            showBackButton: true,
            backgroundHeight: 200.0,
            avatarSize: 120.0,
          ),
          // Form content with space for floating avatar
          Expanded(
            child: Container(
              margin: EdgeInsets.only(top: 60), // Space for floating avatar
              child: SingleChildScrollView(
                child: Padding(
                  padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
                  child: Column(
                    children: [
                      _buildFormSection(),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFormSection() {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 10,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildInfoField(
                LocalizationKeysAppWuy.wuyProfileNickname.tr(context),
                _nicknameController,
                Icons.person_outline),
            _buildInfoField(
                LocalizationKeysAppWuy.wuyProfileSignature.tr(context),
                _signatureController,
                Icons.edit),
            _buildGenderField(),
            _buildInfoField(LocalizationKeysAppWuy.wuyProfilePhone.tr(context),
                _phoneController, Icons.phone),
            _buildInfoField(
                LocalizationKeysAppWuy.wuyProfileBirthday.tr(context),
                _birthdayController,
                Icons.cake),
            _buildInfoField(
                LocalizationKeysAppWuy.wuyProfileAddress.tr(context),
                _addressController,
                Icons.location_on),
            _buildInfoField(LocalizationKeysAppWuy.wuyProfileEmail.tr(context),
                _emailController, Icons.email),
            _buildInfoField(
                LocalizationKeysAppWuy.wuyProfileIdNumber.tr(context),
                _idController,
                Icons.credit_card),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoField(
      String label, TextEditingController controller, IconData icon) {
    return Padding(
      padding: EdgeInsets.only(bottom: ThemeDimensions.spacingMedium),
      child: TextFormField(
        controller: controller,
        enabled: _isEditing,
        decoration: InputDecoration(
          labelText: label,
          prefixIcon: Icon(icon, color: ThemeColors.primary),
          border: OutlineInputBorder(
            borderRadius:
                BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius:
                BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
            borderSide: BorderSide(color: ThemeColors.primary, width: 2),
          ),
          filled: !_isEditing,
          fillColor: _isEditing ? null : Colors.grey.shade100,
        ),
        validator: (value) {
          if (value == null || value.isEmpty) {
            return 'Please enter $label';
          }
          return null;
        },
      ),
    );
  }

  Widget _buildGenderField() {
    return Padding(
      padding: EdgeInsets.only(bottom: ThemeDimensions.spacingMedium),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            LocalizationKeysAppWuy.wuyProfileGender.tr(context),
            style: ThemeTextStyles.bodyMedium.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingSmall),
          Row(
            children: [
              Expanded(
                child: RadioListTile<String>(
                  title: Text(LocalizationKeysAppWuy.wuySearchMale.tr(context)),
                  value: 'male',
                  groupValue: _selectedGender,
                  onChanged: _isEditing
                      ? (value) {
                          setState(() {
                            _selectedGender = value!;
                          });
                        }
                      : null,
                ),
              ),
              Expanded(
                child: RadioListTile<String>(
                  title:
                      Text(LocalizationKeysAppWuy.wuySearchFemale.tr(context)),
                  value: 'female',
                  groupValue: _selectedGender,
                  onChanged: _isEditing
                      ? (value) {
                          setState(() {
                            _selectedGender = value!;
                          });
                        }
                      : null,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
