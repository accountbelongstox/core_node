// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';

import '../../../localization_app_wuy/localization_keys_app_wuy.dart';
import '../../../models_app_wuy/friend_model_app_wuy.dart';
import '../../../models_app_wuy/search_filter_model_app_wuy.dart';
import '../../../router_app_wuy/router_app_wuy.dart';
import '../../../services_app_wuy/wuy_unified_service.dart';
import '../../../theme_app_wuy/theme_config_app_wuy.dart';
import '../../../widgets_app_wuy/wuy_bottom_navigation.dart';
import '../../../widgets_app_wuy/wuy_gradient_button.dart';
import '../../../widgets_app_wuy/wuy_modern_input_field.dart';

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
  String? _activeQuickFilter;
  bool _isSearching = false;
  List<FriendModelAppWuy> _searchResults = [];

  static const List<_QuickFilterOption> _quickFilterOptions = [
    _QuickFilterOption(
      key: 'online',
      label: 'Online now',
      description: 'Show friends who are currently active',
      icon: Icons.flash_on_rounded,
    ),
    _QuickFilterOption(
      key: 'favorites',
      label: 'Favorites',
      description: 'People you marked as important',
      icon: Icons.star_rounded,
    ),
    _QuickFilterOption(
      key: 'monitoring',
      label: 'Device monitoring',
      description: 'Devices with monitoring enabled',
      icon: Icons.shield_moon_rounded,
    ),
  ];

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
      final service = WuyUnifiedService();
      final response = await service.getFriends();
      final allFriends = response.data ?? [];

      final results = allFriends.where((friend) {
        if (_searchFilter.name != null &&
            _searchFilter.name!.isNotEmpty &&
            !friend.displayName
                .toLowerCase()
                .contains(_searchFilter.name!.toLowerCase())) {
          return false;
        }

        if (_searchFilter.signature != null &&
            _searchFilter.signature!.isNotEmpty) {
          final signature = _searchFilter.signature!.toLowerCase();
          final bio = friend.bio?.toLowerCase() ?? '';
          if (!bio.contains(signature)) {
            return false;
          }
        }

        if (_searchFilter.phone != null &&
            _searchFilter.phone!.isNotEmpty) {
          final phone = friend.phoneNumber ?? '';
          if (!phone.contains(_searchFilter.phone!)) {
            return false;
          }
        }

        if (_searchFilter.gender != null &&
            _searchFilter.gender!.isNotEmpty &&
            friend.gender != _searchFilter.gender) {
          return false;
        }

        if (_activeQuickFilter != null) {
          switch (_activeQuickFilter) {
            case 'online':
              if (!friend.isOnline) return false;
              break;
            case 'favorites':
              if (!friend.isFavorite) return false;
              break;
            case 'monitoring':
              if (!friend.isMonitoring) return false;
              break;
          }
        }

        return true;
      }).toList();

      if (!mounted) return;
      setState(() {
        _searchResults = results;
        _isSearching = false;
      });
    } catch (error) {
      debugPrint('Search error: $error');
      if (!mounted) return;
      setState(() {
        _searchResults = [];
        _isSearching = false;
      });
    }
  }

  void _resetFilters() {
    _nameController.clear();
    _signatureController.clear();
    _phoneController.clear();

    setState(() {
      _selectedGender = null;
      _activeQuickFilter = null;
      _searchFilter = const SearchFilterModelAppWuy();
      _searchResults = [];
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: WuyAppThemeConfig.wuyBackgroundColor,
      appBar: _buildPageAppBar(context),
      body: LayoutBuilder(
        builder: (context, constraints) {
          final bool isWide = constraints.maxWidth >= 960;
          final double maxContentWidth = isWide ? 1080 : constraints.maxWidth;

          return Center(
            child: SingleChildScrollView(
              padding: EdgeInsets.symmetric(
                horizontal: isWide ? 48 : 20,
                vertical: 32,
              ),
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: maxContentWidth),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _buildHeaderSection(context, isWide),
                    const SizedBox(height: 28),
                    _buildSearchForm(context, maxContentWidth),
                    const SizedBox(height: 24),
                    _buildQuickSuggestions(context),
                    const SizedBox(height: 28),
                    _buildSearchResultsSection(context, maxContentWidth),
                  ],
                ),
              ),
            ),
          );
        },
      ),
      bottomNavigationBar: WuyBottomNavigation(
        currentIndex: 2,
        onTap: (index) {
          switch (index) {
            case 0:
              context.go(WuyAppRouter.routeSearch);
              break;
            case 1:
              context.go(WuyAppRouter.routeHome);
              break;
            case 2:
              break;
            case 3:
              context.go(WuyAppRouter.routeProfile);
              break;
          }
        },
      ),
    );
  }

  PreferredSizeWidget _buildPageAppBar(BuildContext context) {
    return AppBar(
      backgroundColor: WuyAppThemeConfig.wuyPrimaryColor,
      foregroundColor: Colors.white,
      elevation: 0,
      centerTitle: true,
      flexibleSpace: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              WuyAppThemeConfig.wuyPrimaryColor,
              WuyAppThemeConfig.wuyPrimaryColor.withOpacity(0.9),
            ],
          ),
        ),
      ),
      title: Text(
        LocalizationKeysAppWuy.wuySearchTitle.tr(context),
        style: WuyAppThemeConfig.wuyAppBarTitle.copyWith(
          color: Colors.white,
          fontWeight: FontWeight.w700,
          fontSize: 22,
          letterSpacing: -0.5,
        ),
      ),
      leading: IconButton(
        icon: const Icon(Icons.arrow_back, color: Colors.white),
        onPressed: () => context.pop(),
      ),
    );
  }

  Widget _buildHeaderSection(BuildContext context, bool isWide) {
    final TextTheme textTheme = Theme.of(context).textTheme;

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: isWide ? 40 : 24,
        vertical: isWide ? 36 : 28,
      ),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            WuyAppThemeConfig.wuyPrimaryColor,
            ThemeColors.blue80,
            ThemeColors.accent,
          ],
        ),
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.15),
            blurRadius: 32,
            offset: const Offset(0, 18),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Discover new people and stay connected',
            style: textTheme.headlineSmall?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w700,
              height: 1.2,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Use rich filters, quick suggestions and live status to find the right teammate or reconnect with close friends.',
            style: textTheme.bodyLarge?.copyWith(
              color: Colors.white.withOpacity(0.85),
              height: 1.4,
            ),
          ),
          const SizedBox(height: 24),
          Wrap(
            spacing: 16,
            runSpacing: 12,
            children: [
              _buildMetricTile('132', 'Active today', Icons.flash_on_rounded),
              _buildMetricTile('58', 'Near your city', Icons.location_on_rounded),
              _buildMetricTile('24', 'Mutual interests', Icons.groups_rounded),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMetricTile(String value, String label, IconData icon) {
    final TextTheme textTheme = Theme.of(context).textTheme;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.16),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withOpacity(0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white, size: 20),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value,
                style: textTheme.titleMedium?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                label,
                style: textTheme.bodySmall?.copyWith(
                  color: Colors.white.withOpacity(0.85),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSearchForm(BuildContext context, double maxWidth) {
    final TextTheme textTheme = Theme.of(context).textTheme;
    final bool isWide = maxWidth >= 760;
    final double fieldWidth = isWide ? (maxWidth - 32) / 2 : maxWidth;

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: isWide ? 32 : 24,
        vertical: isWide ? 32 : 24,
      ),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: ThemeColors.black.withOpacity(0.03)),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.06),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Search filters',
            style: textTheme.titleMedium?.copyWith(
              color: WuyAppThemeConfig.wuyTextPrimary,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 20),
          Wrap(
            spacing: 16,
            runSpacing: 16,
            children: [
              SizedBox(
                width: fieldWidth,
                child: _buildTextFieldCard(
                  title: LocalizationKeysAppWuy.wuySearchName.tr(context),
                  controller: _nameController,
                  hintText:
                      LocalizationKeysAppWuy.wuySearchNameHint.tr(context),
                ),
              ),
              SizedBox(
                width: fieldWidth,
                child: _buildTextFieldCard(
                  title:
                      LocalizationKeysAppWuy.wuySearchSignature.tr(context),
                  controller: _signatureController,
                  hintText:
                      LocalizationKeysAppWuy.wuySearchSignatureHint.tr(context),
                  maxLines: 3,
                ),
              ),
              SizedBox(
                width: fieldWidth,
                child: _buildTextFieldCard(
                  title: LocalizationKeysAppWuy.wuySearchPhone.tr(context),
                  controller: _phoneController,
                  hintText:
                      LocalizationKeysAppWuy.wuySearchPhoneHint.tr(context),
                  keyboardType: TextInputType.phone,
                ),
              ),
              SizedBox(
                width: fieldWidth,
                child: _buildGenderSelector(context),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: WuyAppThemeConfig.wuyPrimaryColor,
                    side: BorderSide(
                      color:
                          WuyAppThemeConfig.wuyPrimaryColor.withOpacity(0.4),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 18),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(26),
                    ),
                  ),
                  onPressed: _resetFilters,
                  child: Text(
                    LocalizationKeysAppWuy.wuySearchReset.tr(context),
                    style: textTheme.labelLarge?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: WuyGradientButton(
                  text: LocalizationKeysAppWuy.wuySearchTitle.tr(context),
                  onPressed: _performSearch,
                  height: 52,
                  borderRadius: 26.0,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTextFieldCard({
    required String title,
    required TextEditingController controller,
    required String hintText,
    TextInputType? keyboardType,
    int maxLines = 1,
  }) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: ThemeColors.black.withOpacity(0.06)),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.04),
            blurRadius: 16,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: WuyAppThemeConfig.wuyTextPrimary,
                ),
          ),
          const SizedBox(height: 12),
          WuyModernInputField(
            controller: controller,
            keyboardType: keyboardType ?? TextInputType.text,
            hintText: hintText,
            maxLines: maxLines,
          ),
        ],
      ),
    );
  }

  Widget _buildGenderSelector(BuildContext context) {
    final TextTheme textTheme = Theme.of(context).textTheme;
    final List<_GenderOption> options = [
      _GenderOption(
        label: LocalizationKeysAppWuy.wuySearchMale.tr(context),
        value: 'male',
      ),
      _GenderOption(
        label: LocalizationKeysAppWuy.wuySearchFemale.tr(context),
        value: 'female',
      ),
      const _GenderOption(label: 'Any gender', value: null),
    ];

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: ThemeColors.black.withOpacity(0.06)),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.04),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            LocalizationKeysAppWuy.wuySearchGender.tr(context),
            style: textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w600,
              color: WuyAppThemeConfig.wuyTextPrimary,
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: options.map((option) {
              final bool isSelected = option.value == null
                  ? _selectedGender == null
                  : _selectedGender == option.value;

              return ChoiceChip(
                label: Text(option.label),
                selected: isSelected,
                onSelected: (_) {
                  setState(() {
                    _selectedGender = option.value;
                  });
                },
                selectedColor:
                    WuyAppThemeConfig.wuyPrimaryColor.withOpacity(0.18),
                backgroundColor: Colors.grey[100],
                labelStyle: TextStyle(
                  color: isSelected
                      ? WuyAppThemeConfig.wuyPrimaryColor
                      : WuyAppThemeConfig.wuyTextSecondary,
                  fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20),
                  side: BorderSide(
                    color: isSelected
                        ? WuyAppThemeConfig.wuyPrimaryColor
                        : WuyAppThemeConfig.wuyTextSecondary
                            .withOpacity(0.18),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickSuggestions(BuildContext context) {
    final TextTheme textTheme = Theme.of(context).textTheme;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: ThemeColors.black.withOpacity(0.03)),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.05),
            blurRadius: 22,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Quick filters',
            style: textTheme.titleMedium?.copyWith(
              color: WuyAppThemeConfig.wuyTextPrimary,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: _quickFilterOptions.map((option) {
              final bool isSelected = _activeQuickFilter == option.key;
              return Tooltip(
                message: option.description,
                child: FilterChip(
                  avatar: Icon(
                    option.icon,
                    size: 18,
                    color: isSelected
                        ? WuyAppThemeConfig.wuyPrimaryColor
                        : WuyAppThemeConfig.wuyTextSecondary,
                  ),
                  label: Text(option.label),
                  selected: isSelected,
                  onSelected: (_) => _toggleQuickFilter(option.key),
                  backgroundColor: Colors.grey[100],
                  selectedColor:
                      WuyAppThemeConfig.wuyPrimaryColor.withOpacity(0.18),
                  checkmarkColor: WuyAppThemeConfig.wuyPrimaryColor,
                  labelStyle: TextStyle(
                    color: isSelected
                        ? WuyAppThemeConfig.wuyPrimaryColor
                        : WuyAppThemeConfig.wuyTextSecondary,
                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20),
                    side: BorderSide(
                      color: isSelected
                          ? WuyAppThemeConfig.wuyPrimaryColor
                          : WuyAppThemeConfig.wuyTextSecondary
                              .withOpacity(0.2),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  void _toggleQuickFilter(String key) {
    setState(() {
      _activeQuickFilter = _activeQuickFilter == key ? null : key;
    });
    _performSearch();
  }

  Widget _buildSearchResultsSection(
      BuildContext context, double contentWidth) {
    if (_isSearching) {
      return _buildLoadingState(context);
    }

    if (_searchResults.isEmpty) {
      return _buildEmptyState(context);
    }

    final int columns = contentWidth >= 960
        ? 3
        : contentWidth >= 680
            ? 2
            : 1;
    const double spacing = 20;
    final double cardWidth = columns == 1
        ? contentWidth
        : (contentWidth - (columns - 1) * spacing) / columns;

    final TextTheme textTheme = Theme.of(context).textTheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              'Search results',
              style: textTheme.titleMedium?.copyWith(
                color: WuyAppThemeConfig.wuyTextPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(width: 12),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: ThemeColors.blue05,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Text(
                '${_searchResults.length} matches',
                style: textTheme.labelMedium?.copyWith(
                  color: WuyAppThemeConfig.wuyPrimaryColor,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            if (_activeQuickFilter != null) ...[
              const SizedBox(width: 12),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: WuyAppThemeConfig.wuyPrimaryColor.withOpacity(0.14),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      _quickFilterOptions
                          .firstWhere((option) => option.key == _activeQuickFilter)
                          .icon,
                      size: 16,
                      color: WuyAppThemeConfig.wuyPrimaryColor,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      _quickFilterOptions
                          .firstWhere((option) => option.key == _activeQuickFilter)
                          .label,
                      style: textTheme.labelMedium?.copyWith(
                        color: WuyAppThemeConfig.wuyPrimaryColor,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 20),
        Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: _searchResults
              .map(
                (friend) => SizedBox(
                  width: columns == 1 ? contentWidth : cardWidth,
                  child: _buildFriendCard(context, friend),
                ),
              )
              .toList(),
        ),
      ],
    );
  }

  Widget _buildFriendCard(BuildContext context, FriendModelAppWuy friend) {
    final bool isOnline = friend.isOnline;
    final Color statusColor = isOnline
        ? WuyAppThemeConfig.wuyOnlineColor
        : WuyAppThemeConfig.wuyTextSecondary;

    return InkWell(
      borderRadius: BorderRadius.circular(24),
      onTap: () => context.go(
        WuyAppRouter.routeFriendInfo.replaceAll(':id', friend.id),
      ),
      child: Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: ThemeColors.black.withOpacity(0.04)),
          boxShadow: [
            BoxShadow(
              color: ThemeColors.black.withOpacity(0.08),
              blurRadius: 24,
              offset: const Offset(0, 14),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Stack(
                  children: [
                    CircleAvatar(
                      radius: 28,
                      backgroundColor:
                          WuyAppThemeConfig.wuyPrimaryColor.withOpacity(0.12),
                      backgroundImage: friend.avatarUrl != null &&
                              friend.avatarUrl!.isNotEmpty
                          ? NetworkImage(friend.avatarUrl!)
                          : null,
                      child: friend.avatarUrl == null ||
                              friend.avatarUrl!.isEmpty
                          ? Text(
                              friend.displayName.isNotEmpty
                                  ? friend.displayName[0].toUpperCase()
                                  : '?',
                              style: TextStyle(
                                color: WuyAppThemeConfig.wuyPrimaryColor,
                                fontWeight: FontWeight.bold,
                                fontSize: 18,
                              ),
                            )
                          : null,
                    ),
                    Positioned(
                      bottom: 2,
                      right: 2,
                      child: Container(
                        width: 12,
                        height: 12,
                        decoration: BoxDecoration(
                          color: isOnline
                              ? WuyAppThemeConfig.wuyOnlineColor
                              : Colors.grey[400],
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 2),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 18),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              friend.displayNameOrUsername,
                              style: Theme.of(context)
                                  .textTheme
                                  .titleMedium
                                  ?.copyWith(
                                    color: WuyAppThemeConfig.wuyTextPrimary,
                                    fontWeight: FontWeight.w700,
                                  ),
                            ),
                          ),
                          if (friend.isFavorite)
                            Icon(
                              Icons.star_rounded,
                              size: 20,
                              color: WuyAppThemeConfig.wuySecondaryColor,
                            ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        friend.bio?.isNotEmpty == true
                            ? friend.bio!
                            : 'No bio shared yet',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: WuyAppThemeConfig.wuyTextSecondary,
                              height: 1.4,
                            ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                _buildInfoChip(
                  icon: Icons.circle,
                  iconSize: 10,
                  iconColor: statusColor,
                  text: friend.statusText,
                  textColor: statusColor,
                ),
                if (friend.phoneNumber != null &&
                    friend.phoneNumber!.isNotEmpty)
                  _buildInfoChip(
                    icon: Icons.phone_rounded,
                    text: friend.phoneNumber!,
                  ),
                if (friend.relationship != null &&
                    friend.relationship!.isNotEmpty)
                  _buildInfoChip(
                    icon: Icons.favorite_border_rounded,
                    text: friend.relationship!,
                  ),
                if (friend.daysTogether != null)
                  _buildInfoChip(
                    icon: Icons.calendar_today_rounded,
                    text: '${friend.daysTogether} days connected',
                  ),
                if (friend.isMonitoring)
                  _buildInfoChip(
                    icon: Icons.shield_outlined,
                    text: 'Monitoring enabled',
                    iconColor: WuyAppThemeConfig.wuySecondaryColor,
                    textColor: WuyAppThemeConfig.wuySecondaryColor,
                  ),
              ],
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                TextButton.icon(
                  onPressed: () => context.go(
                    WuyAppRouter.routeFriendInfo.replaceAll(':id', friend.id),
                  ),
                  style: TextButton.styleFrom(
                    foregroundColor: WuyAppThemeConfig.wuyPrimaryColor,
                  ),
                  icon: const Icon(Icons.person_search_rounded),
                  label: const Text('View profile'),
                ),
                const Spacer(),
                IconButton(
                  tooltip: 'Start chat',
                  icon: Icon(
                    Icons.chat_bubble_rounded,
                    color: WuyAppThemeConfig.wuyPrimaryColor,
                  ),
                  onPressed: () {
                    context.go(
                      WuyAppRouter.routeChat.replaceAll(':id', friend.id),
                    );
                  },
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoChip({
    required IconData icon,
    required String text,
    double iconSize = 14,
    Color? iconColor,
    Color? textColor,
  }) {
    final Color effectiveIconColor =
        iconColor ?? WuyAppThemeConfig.wuyTextSecondary;
    final Color effectiveTextColor =
        textColor ?? WuyAppThemeConfig.wuyTextSecondary;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: effectiveTextColor.withOpacity(0.08),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: iconSize, color: effectiveIconColor),
          const SizedBox(width: 6),
          Text(
            text,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: effectiveTextColor,
                  fontWeight: FontWeight.w600,
                ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoadingState(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 60),
      alignment: Alignment.center,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(),
          const SizedBox(height: 16),
          Text(
            'Searching friends...',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: WuyAppThemeConfig.wuyTextSecondary,
                ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    final TextTheme textTheme = Theme.of(context).textTheme;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 56),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: ThemeColors.black.withOpacity(0.04)),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.06),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.travel_explore_rounded,
            size: 56,
            color: WuyAppThemeConfig.wuyPrimaryColor,
          ),
          const SizedBox(height: 20),
          Text(
            LocalizationKeysAppWuy.wuySearchNoResults.tr(context),
            style: textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
              color: WuyAppThemeConfig.wuyTextPrimary,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            'Try adjusting the filters or invite new friends to join the network.',
            textAlign: TextAlign.center,
            style: textTheme.bodyMedium?.copyWith(
              color: WuyAppThemeConfig.wuyTextSecondary,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 24),
          WuyGradientButton(
            text: LocalizationKeysAppWuy.wuySearchReset.tr(context),
            onPressed: _resetFilters,
            height: 50,
            borderRadius: 26.0,
            fontWeight: FontWeight.w700,
          ),
        ],
      ),
    );
  }
}

class _QuickFilterOption {
  final String key;
  final String label;
  final String description;
  final IconData icon;

  const _QuickFilterOption({
    required this.key,
    required this.label,
    required this.description,
    required this.icon,
  });
}

class _GenderOption {
  final String label;
  final String? value;

  const _GenderOption({required this.label, required this.value});
}
