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
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../../../widgets_app_wuy/wuy_bottom_navigation.dart';
import '../../../widgets_app_wuy/wuy_modern_input_field.dart';
import '../../../widgets_app_wuy/wuy_gradient_button.dart';
import '../../../theme_app_wuy/theme_config_app_wuy.dart';
import '../../../models_app_wuy/search_filter_model_app_wuy.dart';
import '../../../models_app_wuy/friend_model_app_wuy.dart';
import '../../../localization_app_wuy/localization_keys_app_wuy.dart';
import '../../../router_app_wuy/router_app_wuy.dart';
import '../../../services_app_wuy/wuy_unified_service.dart';

/// Search Screen for Wuy App
///
/// This screen provides search functionality for finding friends.
/// Users can search by name, phone number, or other criteria.
///
/// Localization Usage:
/// - All user-facing text uses LocalizationKeysAppWuy constants with .tr(context) method
/// - Text keys are defined in localization_keys_app_wuy.dart
/// - Translations are provided in en_app_wuy.dart and zh_app_wuy.dart
/// - Example: LocalizationKeysAppWuy.wuySearchTitle.tr(context)
class WuySearchScreen extends StatefulWidget {
  const WuySearchScreen({super.key});

  @override
  State<WuySearchScreen> createState() => _WuySearchScreenState();
}

class _WuySearchScreenState extends State<WuySearchScreen> {
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _signatureController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();

  SearchFilterModelAppWuy _searchFilter = const SearchFilterModelAppWuy();
  String? _selectedGender;
  bool _isSearching = false;
  List<FriendModelAppWuy> _searchResults = [];

  @override
  void dispose() {
    _nameController.dispose();
    _signatureController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  void _performSearch() async {
    setState(() {
      _isSearching = true;
    });

    // Update search filter
    _searchFilter = _searchFilter.copyWith(
      name: _nameController.text.trim().isEmpty
          ? null
          : _nameController.text.trim(),
      signature: _signatureController.text.trim().isEmpty
          ? null
          : _signatureController.text.trim(),
      phone: _phoneController.text.trim().isEmpty
          ? null
          : _phoneController.text.trim(),
      gender: _selectedGender,
    );

    try {
      // Load all friends from data manager
      final dataManager = WuyUnifiedService();
      final response = await dataManager.getFriends();
      final allFriends = response.data ?? [];

      // Filter friends based on search criteria
      final filteredResults = allFriends.where((friend) {
        // Filter by name
        if (_searchFilter.name != null &&
            _searchFilter.name!.isNotEmpty &&
            !friend.displayName
                .toLowerCase()
                .contains(_searchFilter.name!.toLowerCase())) {
          return false;
        }

        // Filter by signature/bio
        if (_searchFilter.signature != null &&
            _searchFilter.signature!.isNotEmpty &&
            (friend.bio == null ||
                !friend.bio!
                    .toLowerCase()
                    .contains(_searchFilter.signature!.toLowerCase()))) {
          return false;
        }

        // Filter by phone
        if (_searchFilter.phone != null &&
            _searchFilter.phone!.isNotEmpty &&
            (friend.phoneNumber == null ||
                !friend.phoneNumber!.contains(_searchFilter.phone!))) {
          return false;
        }

        // Filter by gender
        if (_searchFilter.gender != null &&
            _searchFilter.gender!.isNotEmpty &&
            friend.gender != _searchFilter.gender) {
          return false;
        }

        return true;
      }).toList();

      if (mounted) {
        setState(() {
          _isSearching = false;
          _searchResults = filteredResults;
        });
      }
    } catch (e) {
      debugPrint('Search error: $e');
      if (mounted) {
        setState(() {
          _isSearching = false;
          _searchResults = [];
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: WuyAppThemeConfig.wuyBackgroundColor,
      appBar: AppBar(
        backgroundColor: WuyAppThemeConfig.wuyPrimaryColor,
        foregroundColor: Colors.white,
        title: Text(
          LocalizationKeysAppWuy.wuySearchTitle.tr(context),
          style: WuyAppThemeConfig.wuyAppBarTitle.copyWith(color: Colors.white),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => context.pop(),
        ),
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(WuyAppThemeConfig.wuyDefaultPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildSearchSection(
              title: LocalizationKeysAppWuy.wuySearchName.tr(context),
              controller: _nameController,
              hintText: LocalizationKeysAppWuy.wuySearchNameHint.tr(context),
            ),
            const SizedBox(height: 24),
            _buildSearchSection(
              title: LocalizationKeysAppWuy.wuySearchSignature.tr(context),
              controller: _signatureController,
              hintText:
                  LocalizationKeysAppWuy.wuySearchSignatureHint.tr(context),
            ),
            const SizedBox(height: 24),
            _buildGenderSearchSection(),
            const SizedBox(height: 24),
            _buildSearchSection(
              title: LocalizationKeysAppWuy.wuySearchPhone.tr(context),
              controller: _phoneController,
              hintText: LocalizationKeysAppWuy.wuySearchPhoneHint.tr(context),
            ),
            const SizedBox(height: 32),
            _buildSearchResults(),
          ],
        ),
      ),
      bottomNavigationBar: WuyBottomNavigation(
        currentIndex: 2, // Find Friends is the 3rd item (index 2)
        onTap: (index) {
          switch (index) {
            case 0:
              context.go(WuyAppRouter.routeSearch);
              break;
            case 1:
              context.go(WuyAppRouter.routeHome);
              break;
            case 2:
              // Already on find friends page
              break;
            case 3:
              context.go(WuyAppRouter.routeProfile);
              break;
          }
        },
      ),
    );
  }

  Widget _buildSearchSection({
    required String title,
    required TextEditingController controller,
    required String hintText,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: WuyAppThemeConfig.wuyFriendName.copyWith(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 12),
        WuyModernInputField(
          controller: controller,
          hintText: hintText,
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: WuyGradientButton(
                text: LocalizationKeysAppWuy.wuySearchReset.tr(context),
                onPressed: () {
                  controller.clear();
                },
                backgroundColor: Colors.grey[200],
                textColor: WuyAppThemeConfig.wuyTextSecondary,
                gradientColors: null,
                height: 44,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: WuyGradientButton(
                text: LocalizationKeysAppWuy.wuySearchTitle.tr(context),
                onPressed: _performSearch,
                height: 44,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildGenderSearchSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          LocalizationKeysAppWuy.wuySearchGender.tr(context),
          style: WuyAppThemeConfig.wuyFriendName.copyWith(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 12),
        Container(
          padding: EdgeInsets.all(WuyAppThemeConfig.wuyDefaultPadding),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius:
                BorderRadius.circular(WuyAppThemeConfig.wuyBorderRadius),
            border: Border.all(
                color: WuyAppThemeConfig.wuyTextSecondary.withOpacity(0.3)),
          ),
          child: Row(
            children: [
              Expanded(
                child: _buildGenderOption(
                    LocalizationKeysAppWuy.wuySearchMale.tr(context), 'male'),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildGenderOption(
                    LocalizationKeysAppWuy.wuySearchFemale.tr(context),
                    'female'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: WuyGradientButton(
                text: LocalizationKeysAppWuy.wuySearchReset.tr(context),
                onPressed: () {
                  setState(() {
                    _selectedGender = null;
                  });
                },
                backgroundColor: Colors.grey[200],
                textColor: WuyAppThemeConfig.wuyTextSecondary,
                gradientColors: null,
                height: 44,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: WuyGradientButton(
                text: LocalizationKeysAppWuy.wuySearchTitle.tr(context),
                onPressed: _performSearch,
                height: 44,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildGenderOption(String label, String value) {
    final isSelected = _selectedGender == value;

    return GestureDetector(
      onTap: () {
        setState(() {
          _selectedGender = isSelected ? null : value;
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
        decoration: BoxDecoration(
          color: isSelected
              ? WuyAppThemeConfig.wuyPrimaryColor.withOpacity(0.1)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected
                ? WuyAppThemeConfig.wuyPrimaryColor
                : WuyAppThemeConfig.wuyTextSecondary.withOpacity(0.3),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              isSelected
                  ? Icons.radio_button_checked
                  : Icons.radio_button_unchecked,
              color: isSelected
                  ? WuyAppThemeConfig.wuyPrimaryColor
                  : WuyAppThemeConfig.wuyTextSecondary,
              size: 20,
            ),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                color: isSelected
                    ? WuyAppThemeConfig.wuyPrimaryColor
                    : WuyAppThemeConfig.wuyTextSecondary,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchResults() {
    if (_isSearching) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(32.0),
          child: CircularProgressIndicator(),
        ),
      );
    }

    if (_searchResults.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Search Results (${_searchResults.length})',
          style: WuyAppThemeConfig.wuyFriendName.copyWith(
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 16),
        ..._searchResults.map((friend) => _buildFriendResult(friend)),
      ],
    );
  }

  Widget _buildFriendResult(FriendModelAppWuy friend) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: EdgeInsets.all(WuyAppThemeConfig.wuyDefaultPadding),
      decoration: WuyAppThemeConfig.wuyCardDecoration,
      child: Row(
        children: [
          CircleAvatar(
            radius: WuyAppThemeConfig.wuyAvatarRadius,
            backgroundColor: friend.isOnline
                ? WuyAppThemeConfig.wuyOnlineColor
                : WuyAppThemeConfig.wuyOfflineColor,
            child: Text(
              friend.displayName[0].toUpperCase(),
              style: const TextStyle(
                  color: Colors.white, fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  friend.displayName,
                  style: WuyAppThemeConfig.wuyFriendName,
                ),
                if (friend.bio != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    friend.bio!,
                    style: ThemeTextStyles.bodySmall.copyWith(
                      color: WuyAppThemeConfig.wuyTextSecondary,
                      fontSize: 12,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                const SizedBox(height: 4),
                Row(
                  children: [
                    Icon(
                      friend.isOnline ? Icons.circle : Icons.circle_outlined,
                      size: 8,
                      color: friend.isOnline
                          ? WuyAppThemeConfig.wuyOnlineColor
                          : WuyAppThemeConfig.wuyOfflineColor,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      friend.statusText,
                      style: ThemeTextStyles.bodySmall.copyWith(
                        color: WuyAppThemeConfig.wuyTextSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () {
              // Add friend functionality
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Add ${friend.displayName} as friend')),
              );
            },
          ),
        ],
      ),
    );
  }
}
