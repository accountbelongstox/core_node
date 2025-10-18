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
import '../../../router_app_wuy/router_app_wuy.dart';
import '../../../localization_app_wuy/localization_keys_app_wuy.dart';
import '../../../services_app_wuy/wuy_data_manager.dart';
import '../../../widgets_app_wuy/wuy_modern_input_field.dart';
import '../../../widgets_app_wuy/wuy_gradient_button.dart';

/// Add Friend Screen for Wuy App
///
/// This screen provides functionality to search and add new friends.
///
/// Localization Usage:
/// - All user-facing text uses LocalizationKeysAppWuy constants with .tr(context) method
/// - Text keys are defined in localization_keys_app_wuy.dart
/// - Translations are provided in en_app_wuy.dart and zh_app_wuy.dart
/// - Example: LocalizationKeysAppWuy.wuyAddFriendTitle.tr(context)
class WuyAddFriendScreen extends StatefulWidget {
  const WuyAddFriendScreen({super.key});

  @override
  State<WuyAddFriendScreen> createState() => _WuyAddFriendScreenState();
}

class _WuyAddFriendScreenState extends State<WuyAddFriendScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nicknameController = TextEditingController();
  final _genderController = TextEditingController();
  final _ageController = TextEditingController();
  final _heightController = TextEditingController();
  final _weightController = TextEditingController();
  bool _isLoading = false;

  @override
  void dispose() {
    _nicknameController.dispose();
    _genderController.dispose();
    _ageController.dispose();
    _heightController.dispose();
    _weightController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.lightBackground,
      appBar: AppBar(
        title: Text(
          'Add Friend',
          style: ThemeTextStyles.displayMedium,
        ),
        backgroundColor: ThemeColors.primary,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => context.go(WuyAppRouter.routeHome),
        ),
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _buildProfileSection(),
              SizedBox(height: ThemeDimensions.spacingLarge),
              _buildFormSection(),
              SizedBox(height: ThemeDimensions.spacingLarge),
              _buildAddButton(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildProfileSection() {
    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusLarge),
      ),
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              ThemeColors.orange40,
              ThemeColors.red40,
            ],
          ),
          borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusLarge),
        ),
        padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
        child: Column(
          children: [
            CircleAvatar(
              radius: 50,
              backgroundColor: Colors.white.withOpacity(0.2),
              child: Icon(
                Icons.person,
                size: 50,
                color: Colors.white,
              ),
            ),
            SizedBox(height: ThemeDimensions.spacingMedium),
            Text(
              WuyDataManager.instance.currentUser?.displayName ?? 'User',
              style: ThemeTextStyles.title2.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
            ),
            Text(
              'openAI',
              style: ThemeTextStyles.bodyLarge.copyWith(
                color: Colors.white.withOpacity(0.9),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFormSection() {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
      ),
      child: Padding(
        padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Friend Information',
              style: ThemeTextStyles.title3,
            ),
            SizedBox(height: ThemeDimensions.spacingLarge),
            _buildNicknameField(),
            SizedBox(height: ThemeDimensions.spacingMedium),
            _buildGenderField(),
            SizedBox(height: ThemeDimensions.spacingMedium),
            _buildAgeField(),
            SizedBox(height: ThemeDimensions.spacingMedium),
            _buildHeightField(),
            SizedBox(height: ThemeDimensions.spacingMedium),
            _buildWeightField(),
          ],
        ),
      ),
    );
  }

  Widget _buildNicknameField() {
    return WuyModernInputField(
      controller: _nicknameController,
      labelText: 'Nickname',
      hintText: LocalizationKeysAppWuy.wuyAddFriendEnterNickname.tr(context),
      prefixIcon: Icons.person_outline,
      validator: (value) {
        if (value == null || value.isEmpty) {
          return 'Please enter a nickname';
        }
        return null;
      },
    );
  }

  Widget _buildGenderField() {
    return WuyModernInputField(
      controller: _genderController,
      labelText: 'Gender',
      hintText: LocalizationKeysAppWuy.wuyAddFriendEnterGender.tr(context),
      prefixIcon: Icons.wc,
      validator: (value) {
        if (value == null || value.isEmpty) {
          return 'Please enter gender';
        }
        return null;
      },
    );
  }

  Widget _buildAgeField() {
    return WuyModernInputField(
      controller: _ageController,
      keyboardType: TextInputType.number,
      labelText: 'Age',
      hintText: LocalizationKeysAppWuy.wuyAddFriendEnterAge.tr(context),
      prefixIcon: Icons.cake,
      validator: (value) {
        if (value == null || value.isEmpty) {
          return 'Please enter age';
        }
        final age = int.tryParse(value);
        if (age == null || age < 1 || age > 120) {
          return 'Please enter a valid age';
        }
        return null;
      },
    );
  }

  Widget _buildHeightField() {
    return WuyModernInputField(
      controller: _heightController,
      keyboardType: TextInputType.number,
      labelText: 'Height (cm)',
      hintText: LocalizationKeysAppWuy.wuyAddFriendEnterHeight.tr(context),
      prefixIcon: Icons.height,
      validator: (value) {
        if (value == null || value.isEmpty) {
          return 'Please enter height';
        }
        final height = double.tryParse(value);
        if (height == null || height < 50 || height > 250) {
          return 'Please enter a valid height';
        }
        return null;
      },
    );
  }

  Widget _buildWeightField() {
    return WuyModernInputField(
      controller: _weightController,
      keyboardType: TextInputType.number,
      labelText: 'Weight (kg)',
      hintText: LocalizationKeysAppWuy.wuyAddFriendEnterWeight.tr(context),
      prefixIcon: Icons.monitor_weight,
      validator: (value) {
        if (value == null || value.isEmpty) {
          return 'Please enter weight';
        }
        final weight = double.tryParse(value);
        if (weight == null || weight < 20 || weight > 300) {
          return 'Please enter a valid weight';
        }
        return null;
      },
    );
  }

  Widget _buildAddButton() {
    return WuyGradientButton(
      text: 'Add Friend',
      onPressed: _handleAddFriend,
      isLoading: _isLoading,
      height: 50,
      gradientColors: [ThemeColors.green40, ThemeColors.green60],
    );
  }

  void _handleAddFriend() async {
    if (_formKey.currentState!.validate()) {
      setState(() {
        _isLoading = true;
      });

      // Simulate adding friend
      await Future.delayed(const Duration(seconds: 2));

      setState(() {
        _isLoading = false;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(LocalizationKeysAppWuy.wuyMessageFriendAdded.tr(context))),
        );
        context.go(WuyAppRouter.routeHome);
      }
    }
  }
}
