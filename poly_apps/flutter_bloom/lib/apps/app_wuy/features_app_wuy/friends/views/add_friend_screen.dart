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
import '../../../services_app_wuy/wuy_unified_service.dart';
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
  final _greetingController = TextEditingController(text: 'Hello');
  final _remarkController = TextEditingController();
  final _relationshipController = TextEditingController();
  bool _isLoading = false;
  String _selectedRelationship = 'Friend';

  final List<String> _relationshipOptions = [
    'Friend',
    'Family',
    'Partner',
    'Colleague',
    'Other',
  ];

  @override
  void dispose() {
    _greetingController.dispose();
    _remarkController.dispose();
    _relationshipController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.lightBackground,
      appBar: AppBar(
        title: Text(
          'Add Friend',
          style: ThemeTextStyles.displayMedium.copyWith(
            fontWeight: FontWeight.w700,
            fontSize: 22,
            letterSpacing: -0.5,
          ),
        ),
        backgroundColor: ThemeColors.primary,
        elevation: 0,
        centerTitle: true,
        flexibleSpace: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                ThemeColors.primary,
                ThemeColors.primary.withOpacity(0.9),
              ],
            ),
          ),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => context.pop(),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 8),
              _buildProfileSection(),
              const SizedBox(height: 24),
              _buildFormSection(),
              const SizedBox(height: 28),
              _buildAddButton(),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildProfileSection() {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            ThemeColors.orange40,
            ThemeColors.red40,
          ],
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.orange40.withOpacity(0.3),
            blurRadius: 16,
            offset: const Offset(0, 6),
            spreadRadius: 0,
          ),
          BoxShadow(
            color: ThemeColors.red40.withOpacity(0.2),
            blurRadius: 24,
            offset: const Offset(0, 10),
            spreadRadius: -4,
          ),
        ],
      ),
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          Container(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: Colors.white.withOpacity(0.3),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: CircleAvatar(
              radius: 54,
              backgroundColor: Colors.white.withOpacity(0.25),
              child: const Icon(
                Icons.person,
                size: 52,
                color: Colors.white,
              ),
            ),
          ),
          const SizedBox(height: 18),
          Text(
            WuyUnifiedService().currentUser?.displayName ?? 'User',
            style: ThemeTextStyles.title2.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w800,
              fontSize: 24,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'openAI',
            style: ThemeTextStyles.bodyLarge.copyWith(
              color: Colors.white.withOpacity(0.9),
              fontSize: 16,
              letterSpacing: 0.2,
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
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Friend Information',
            style: ThemeTextStyles.title3.copyWith(
              fontWeight: FontWeight.w700,
              fontSize: 19,
              letterSpacing: -0.4,
            ),
          ),
          const SizedBox(height: 20),
          _buildGreetingField(),
          const SizedBox(height: 16),
          _buildRemarkField(),
          const SizedBox(height: 16),
          _buildRelationshipField(),
        ],
      ),
    );
  }

  Widget _buildGreetingField() {
    return WuyModernInputField(
      controller: _greetingController,
      labelText: 'Greeting Message',
      hintText: 'Enter your greeting message',
      prefixIcon: Icons.chat_bubble_outline,
      maxLines: 3,
      validator: (value) {
        if (value == null || value.isEmpty) {
          return 'Please enter a greeting message';
        }
        return null;
      },
    );
  }

  Widget _buildRemarkField() {
    return WuyModernInputField(
      controller: _remarkController,
      labelText: 'Remark',
      hintText: 'Enter friend remark',
      prefixIcon: Icons.note_outlined,
      validator: (value) {
        if (value == null || value.isEmpty) {
          return 'Please enter a remark';
        }
        return null;
      },
    );
  }

  Widget _buildRelationshipField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Relationship',
          style: ThemeTextStyles.subhead.copyWith(
            color: ThemeColors.label,
            fontWeight: FontWeight.w600,
          ),
        ),
        SizedBox(height: ThemeDimensions.spacing8),
        Container(
          padding: EdgeInsets.symmetric(
            horizontal: ThemeDimensions.paddingSizeDefault,
            vertical: ThemeDimensions.spacing4,
          ),
          decoration: BoxDecoration(
            color: ThemeColors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: ThemeColors.grey300),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: _selectedRelationship,
              isExpanded: true,
              icon: Icon(Icons.keyboard_arrow_down, color: ThemeColors.primary),
              items: _relationshipOptions.map((String value) {
                return DropdownMenuItem<String>(
                  value: value,
                  child: Row(
                    children: [
                      Icon(_getRelationshipIcon(value), size: 20, color: ThemeColors.primary),
                      SizedBox(width: ThemeDimensions.spacing8),
                      Text(value, style: ThemeTextStyles.body),
                    ],
                  ),
                );
              }).toList(),
              onChanged: (String? newValue) {
                if (newValue != null) {
                  setState(() {
                    _selectedRelationship = newValue;
                  });
                }
              },
            ),
          ),
        ),
      ],
    );
  }

  IconData _getRelationshipIcon(String relationship) {
    switch (relationship) {
      case 'Friend':
        return Icons.people;
      case 'Family':
        return Icons.family_restroom;
      case 'Partner':
        return Icons.favorite;
      case 'Colleague':
        return Icons.work;
      default:
        return Icons.person;
    }
  }

  Widget _buildAddButton() {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.green40.withOpacity(0.3),
            blurRadius: 16,
            offset: const Offset(0, 6),
            spreadRadius: 0,
          ),
          BoxShadow(
            color: ThemeColors.green60.withOpacity(0.2),
            blurRadius: 24,
            offset: const Offset(0, 10),
            spreadRadius: -4,
          ),
        ],
      ),
      child: WuyGradientButton(
        text: 'Add Friend',
        onPressed: _handleAddFriend,
        isLoading: _isLoading,
        height: 54,
        borderRadius: 28.0,
        fontSize: 17,
        fontWeight: FontWeight.w700,
        gradientColors: [ThemeColors.green40, ThemeColors.green60],
      ),
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
          SnackBar(
              content: Text(
                  LocalizationKeysAppWuy.wuyMessageFriendAdded.tr(context))),
        );
        context.go(WuyAppRouter.getFriendsRoute());
      }
    }
  }
}
