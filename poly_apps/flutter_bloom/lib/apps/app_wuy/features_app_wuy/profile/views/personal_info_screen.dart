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
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/widgets/floating_avatar_header.dart';
import 'package:qyflutter/common/assets/common_assets_images.dart';
import '../../../providers_app_wuy/wu_user_provider.dart';
import '../../../router_app_wuy/router_app_wuy.dart';
import '../../../localization_app_wuy/localization_keys_app_wuy.dart';
import '../../../services_app_wuy/wuy_unified_service.dart';
import '../../../services_app_wuy/wuy_avatar_service.dart';
import '../../../services_app_wuy/wuy_auth_state_manager.dart';
import '../../../models_app_wuy/user_model_app_wuy.dart';
import '../../../resources_app_wuy/assets_icons_app_wuy.dart';

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
  final _avatarService = WuyAvatarService();
  final _unifiedService = WuyUnifiedService();

  String _selectedGender = 'male';
  bool _isEditing = false;
  bool _isSaving = false;
  String? _currentAvatarPath;

  @override
  void initState() {
    super.initState();
    _initializeFormData();
  }

  void _initializeFormData() {
    // Initialize form data from user provider
    final userProvider = Provider.of<WuUserProvider>(context, listen: false);
    final user = userProvider.user as UserModelAppWuy?;

    _nicknameController.text = user?.displayName ?? '';
    _signatureController.text = user?.about ?? '';
    _phoneController.text = user?.unifiedPhoneNumber ?? '';
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
    final userProvider = Provider.of<WuUserProvider>(context);
    final user = userProvider.user as UserModelAppWuy?;

    return Scaffold(
      backgroundColor: ThemeColors.grey50,
      body: CustomScrollView(
        physics: BouncingScrollPhysics(),
        slivers: [
          SliverToBoxAdapter(
            child: FloatingAvatarHeader(
              backgroundImage: CommonAssetsImages.wuyBackground1,
              avatarImage: user?.unifiedAvatarUrl.isEmpty ?? true ? WuyAppAssetsIcons.avatarPlaceholder : user!.unifiedAvatarUrl,
              displayName: user?.displayName ?? '',
              subtitle: user?.about ?? '',
              onBackTap: () => context.pop(),
              onAvatarTap: () => _handleAvatarTap(),
              showBackButton: true,
              backgroundHeight: 180.0,
              avatarSize: 90.0,
              gradientColors: [
                ThemeColors.teal.withOpacity(0.85),
                ThemeColors.green.withOpacity(0.75),
                ThemeColors.blue60.withOpacity(0.65),
              ],
              gradientOpacity: 0.4,
            ),
          ),
          SliverToBoxAdapter(
            child: SizedBox(height: 35),
          ),
          SliverToBoxAdapter(
            child: Center(
              child: Column(
                children: [
                  Text(
                    user?.displayName ?? '',
                    style: ThemeTextStyles.title3.copyWith(
                      fontWeight: FontWeight.w600,
                      color: ThemeColors.black,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  if (user?.about != null && user!.about!.isNotEmpty) ...[
                    SizedBox(height: 6),
                    Text(
                      user.about!,
                      style: ThemeTextStyles.subhead.copyWith(
                        color: ThemeColors.textSecondary,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ],
              ),
            ),
          ),
          SliverPadding(
            padding: EdgeInsets.symmetric(
              horizontal: ThemeDimensions.defaultPadding,
              vertical: ThemeDimensions.spacingMedium,
            ),
            sliver: SliverToBoxAdapter(
              child: Column(
                children: [
                  _buildFormSection(),
                  SizedBox(height: 16),
                  _buildActionButtons(),
                  SizedBox(height: ThemeDimensions.spacingLarge),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFormSection() {
    return Container(
      decoration: BoxDecoration(
        color: ThemeColors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.04),
            blurRadius: 14,
            offset: const Offset(0, 4),
            spreadRadius: 0,
          ),
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
            spreadRadius: 0,
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
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
      ),
    );
  }

  Widget _buildInfoField(
      String label, TextEditingController controller, IconData icon) {
    final fieldColors = [
      ThemeColors.blue,
      ThemeColors.teal,
      ThemeColors.green,
      ThemeColors.purple,
      ThemeColors.orange,
      ThemeColors.pink,
      ThemeColors.indigo,
      ThemeColors.red,
    ];

    final colorIndex = label.hashCode.abs() % fieldColors.length;
    final fieldColor = fieldColors[colorIndex];

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: SizedBox(
        height: 56,
        child: TextFormField(
          controller: controller,
          enabled: _isEditing,
          style: ThemeTextStyles.callout.copyWith(
            fontSize: 15,
            letterSpacing: 0.1,
          ),
          decoration: InputDecoration(
            labelText: label,
            labelStyle: ThemeTextStyles.footnote.copyWith(
              color: _isEditing ? fieldColor : ThemeColors.grey600,
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
            prefixIcon: Icon(
              icon,
              color: _isEditing ? fieldColor : ThemeColors.grey500,
              size: 22,
            ),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide(color: ThemeColors.grey300, width: 1),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide(color: ThemeColors.grey300, width: 1),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide(color: fieldColor, width: 2),
            ),
            disabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide(color: ThemeColors.grey200, width: 1),
            ),
            filled: true,
            fillColor: _isEditing ? ThemeColors.white : ThemeColors.grey50,
          ),
          validator: (value) {
            if (value == null || value.isEmpty) {
              return 'Please enter $label';
            }
            return null;
          },
        ),
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

  Future<void> _handleAvatarTap() async {
    if (!_isEditing) {
      setState(() => _isEditing = true);
      return;
    }

    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(LocalizationKeysAppWuy.wuyProfileEditProfile.tr(context)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: Icon(Icons.photo_library),
              title: Text('Gallery'),
              onTap: () => Navigator.pop(context, 'gallery'),
            ),
            ListTile(
              leading: Icon(Icons.camera_alt),
              title: Text('Camera'),
              onTap: () => Navigator.pop(context, 'camera'),
            ),
          ],
        ),
      ),
    );

    if (result == null) return;

    File? imageFile;
    if (result == 'gallery') {
      imageFile = await _avatarService.pickImageFromGallery();
    } else if (result == 'camera') {
      imageFile = await _avatarService.pickImageFromCamera();
    }

    if (imageFile == null) return;

    final user = _unifiedService.currentUser;
    if (user == null) return;

    final success = await _avatarService.updateUserAvatar(imageFile, user);
    if (success && mounted) {
      setState(() {
        _currentAvatarPath = imageFile?.path;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Avatar updated successfully')),
      );
    }
  }

  Future<void> _toggleEditMode() async {
    if (_isEditing) {
      await _saveProfile();
    } else {
      setState(() => _isEditing = true);
    }
  }

  Future<void> _saveProfile() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSaving = true);

    try {
      final userProvider = Provider.of<WuUserProvider>(context, listen: false);
      final user = userProvider.user as UserModelAppWuy?;
      if (user == null) {
        throw Exception('No user logged in');
      }

      final updatedUser = user.copyWith(
        nickname: _nicknameController.text,
        about: _signatureController.text,
        gender: _selectedGender,
        phoneNumber: _phoneController.text,
        birthday: _birthdayController.text,
        city: _addressController.text,
        email: _emailController.text,
        meta: {
          ...user.meta,
          'id_number': _idController.text,
        },
        updatedAt: DateTime.now(),
      );

      final authStateManager = WuyAuthStateManager.instance;
      await authStateManager.setAuthenticatedUser(updatedUser);

      setState(() {
        _isEditing = false;
        _isSaving = false;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Profile updated successfully')),
        );
      }
    } catch (e) {
      setState(() => _isSaving = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to update profile: $e')),
        );
      }
    }
  }

  Widget _buildActionButtons() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          if (_isEditing) ...[
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(28),
                  boxShadow: [
                    BoxShadow(
                      color: ThemeColors.grey400.withOpacity(0.15),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                      spreadRadius: 0,
                    ),
                  ],
                ),
                child: OutlinedButton(
                  onPressed: _isSaving
                      ? null
                      : () {
                          _initializeFormData();
                          setState(() => _isEditing = false);
                        },
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(double.infinity, 54),
                    side: BorderSide(
                      color: ThemeColors.grey400.withOpacity(0.4),
                      width: 1.5,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(28),
                    ),
                  ),
                  child: Text(
                    'Cancel',
                    style: ThemeTextStyles.bodyMedium.copyWith(
                      color: ThemeColors.grey700,
                      fontSize: 17,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.2,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 16),
          ],
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(28),
                boxShadow: [
                  BoxShadow(
                    color: (_isEditing ? ThemeColors.green : ThemeColors.blue)
                        .withOpacity(0.3),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                    spreadRadius: 0,
                  ),
                  BoxShadow(
                    color: (_isEditing ? ThemeColors.green : ThemeColors.blue)
                        .withOpacity(0.15),
                    blurRadius: 24,
                    offset: const Offset(0, 10),
                    spreadRadius: -4,
                  ),
                ],
              ),
              child: ElevatedButton(
                onPressed: _isSaving ? null : _toggleEditMode,
                style: ElevatedButton.styleFrom(
                  backgroundColor:
                      _isEditing ? ThemeColors.green : ThemeColors.blue,
                  foregroundColor: ThemeColors.white,
                  minimumSize: const Size(double.infinity, 54),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(28),
                  ),
                  elevation: 0,
                ),
                child: _isSaving
                    ? const SizedBox(
                        height: 24,
                        width: 24,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.5,
                          valueColor:
                              AlwaysStoppedAnimation<Color>(ThemeColors.white),
                        ),
                      )
                    : Text(
                        _isEditing ? 'Save' : 'Edit',
                        style: ThemeTextStyles.bodyMedium.copyWith(
                          color: ThemeColors.white,
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.2,
                        ),
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
