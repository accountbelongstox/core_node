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
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

import '../../../localization_app_wuy/localization_keys_app_wuy.dart';
import '../../../models_app_wuy/friend_model_app_wuy.dart';
import '../../../models_app_wuy/search_history_model_app_wuy.dart';
import '../../../router_app_wuy/router_app_wuy.dart';
import '../../../services_app_wuy/wuy_unified_service.dart';
import '../../../theme_app_wuy/theme_config_app_wuy.dart';
import '../../../widgets_app_wuy/wuy_bottom_navigation.dart';

class WuySearchScreen extends StatefulWidget {
  const WuySearchScreen({super.key});

  @override
  State<WuySearchScreen> createState() => _WuySearchScreenState();
}

class _WuySearchScreenState extends State<WuySearchScreen> {
  final TextEditingController _searchController = TextEditingController();
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _signatureController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();

  List<SearchHistoryModelAppWuy> _searchHistory = [];
  List<FriendModelAppWuy> _recentlyViewedFriends = [];
  List<FriendModelAppWuy> _recommendedFriends = [];
  List<FriendModelAppWuy> _searchResults = [];
  SearchFilterModelAppWuy _searchFilter = const SearchFilterModelAppWuy();
  String? _selectedGender;
  bool _showSearchHistory = false;
  bool _isSearching = false;

  @override
  void initState() {
    super.initState();
    _loadData();
    _searchFocusNode.addListener(_handleSearchFocusChange);
  }

  @override
  void dispose() {
    _searchController.dispose();
    _nameController.dispose();
    _signatureController.dispose();
    _phoneController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  void _handleSearchFocusChange() {
    if (_searchFocusNode.hasFocus) {
      setState(() {
        _showSearchHistory = true;
      });
    }
  }

  Future<void> _loadData() async {
    await _loadRecentlyViewedFriends();
    await _loadRecommendedFriends();
    _loadSearchHistory();
  }

  Future<void> _loadRecentlyViewedFriends() async {
    try {
      final service = WuyUnifiedService();
      final response = await service.getFriends();
      if (response.data != null && mounted) {
        setState(() {
          _recentlyViewedFriends = response.data!.take(4).toList();
        });
      }
    } catch (error) {
      debugPrint('Error loading recently viewed friends: $error');
    }
  }

  Future<void> _loadRecommendedFriends() async {
    try {
      final service = WuyUnifiedService();
      final response = await service.getFriends();
      if (response.data != null && mounted) {
        setState(() {
          _recommendedFriends = response.data!.skip(4).take(6).toList();
        });
      }
    } catch (error) {
      debugPrint('Error loading recommended friends: $error');
    }
  }

  void _loadSearchHistory() {
    setState(() {
      _searchHistory = [
        SearchHistoryModelAppWuy(
          id: '1',
          searchText: 'Zhang Wei',
          timestamp: DateTime.now().subtract(const Duration(hours: 2)),
        ),
        SearchHistoryModelAppWuy(
          id: '2',
          searchText: 'Li Ming',
          timestamp: DateTime.now().subtract(const Duration(days: 1)),
        ),
        SearchHistoryModelAppWuy(
          id: '3',
          searchText: 'Wang Fang',
          timestamp: DateTime.now().subtract(const Duration(days: 3)),
        ),
      ];
    });
  }

  void _performSearch() async {
    setState(() {
      _isSearching = true;
      _showSearchHistory = false;
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

    final searchText = _searchController.text.trim();
    if (searchText.isNotEmpty) {
      setState(() {
        _searchHistory.insert(
          0,
          SearchHistoryModelAppWuy(
            id: DateTime.now().millisecondsSinceEpoch.toString(),
            searchText: searchText,
            timestamp: DateTime.now(),
            filter: _searchFilter,
          ),
        );
        if (_searchHistory.length > 10) {
          _searchHistory.removeLast();
        }
      });
    }

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

        if (searchText.isNotEmpty &&
            !friend.displayName.toLowerCase().contains(searchText.toLowerCase())) {
          return false;
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

  void _clearSearchHistory() {
    setState(() {
      _searchHistory.clear();
    });
  }

  void _selectHistoryItem(SearchHistoryModelAppWuy history) {
    _searchController.text = history.searchText;
    if (history.filter != null) {
      _searchFilter = history.filter!;
      _nameController.text = history.filter!.name ?? '';
      _signatureController.text = history.filter!.signature ?? '';
      _phoneController.text = history.filter!.phone ?? '';
      _selectedGender = history.filter!.gender;
    }
    setState(() {
      _showSearchHistory = false;
    });
    _performSearch();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: WuyAppThemeConfig.wuyBackgroundColor,
      appBar: _buildCustomAppBar(context),
      body: GestureDetector(
        onTap: () {
          setState(() {
            _showSearchHistory = false;
          });
          FocusScope.of(context).unfocus();
        },
        child: Stack(
          children: [
            SingleChildScrollView(
              padding: EdgeInsets.symmetric(
                horizontal: ThemeDimensions.paddingMedium,
                vertical: ThemeDimensions.paddingMedium,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _buildSearchCriteriaSection(context),
                  SizedBox(height: ThemeDimensions.paddingMedium),
                  _buildSearchBarSection(context),
                  SizedBox(height: ThemeDimensions.paddingLarge),
                  if (_searchResults.isEmpty && !_isSearching) ...[
                    _buildRecentlyViewedSection(context),
                    SizedBox(height: ThemeDimensions.paddingLarge),
                    _buildRecommendedSection(context),
                  ] else if (_isSearching)
                    _buildLoadingState(context)
                  else
                    _buildSearchResultsSection(context),
                ],
              ),
            ),
            if (_showSearchHistory) _buildSearchHistoryOverlay(context),
          ],
        ),
      ),
      bottomNavigationBar: WuyBottomNavigation(
        currentRoute: GoRouterState.of(context).uri.toString(),
      ),
    );
  }

  PreferredSizeWidget _buildCustomAppBar(BuildContext context) {
    return AppBar(
      backgroundColor: WuyAppThemeConfig.wuyPrimaryColor,
      elevation: 0,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back, color: Colors.white),
        onPressed: () => context.pop(),
      ),
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
      title: Row(
        children: [
          Icon(
            Icons.location_on,
            color: Colors.white,
            size: 32,
          ),
          SizedBox(width: ThemeDimensions.paddingSmall),
          Text(
            LocalizationKeysAppWuy.wuySearchTitle.tr(context),
            style: ThemeTextStyles.headline6.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
      actions: [
        IconButton(
          icon: Icon(Icons.share, color: Colors.white),
          onPressed: () {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(LocalizationKeysAppWuy.wuySearchShareIcon.tr(context)),
              ),
            );
          },
          tooltip: LocalizationKeysAppWuy.wuySearchShareIcon.tr(context),
        ),
        Stack(
          children: [
            IconButton(
              icon: Icon(Icons.notifications, color: Colors.white),
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(LocalizationKeysAppWuy.wuySearchNotificationIcon.tr(context)),
                  ),
                );
              },
              tooltip: LocalizationKeysAppWuy.wuySearchNotificationIcon.tr(context),
            ),
            Positioned(
              right: 8,
              top: 8,
              child: Container(
                padding: EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: Colors.red,
                  shape: BoxShape.circle,
                ),
                constraints: BoxConstraints(
                  minWidth: 16,
                  minHeight: 16,
                ),
                child: Text(
                  '3',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            ),
          ],
        ),
        Padding(
          padding: EdgeInsets.only(right: ThemeDimensions.paddingMedium),
          child: GestureDetector(
            onTap: () {
              context.go(WuyAppRouter.routeProfile);
            },
            child: CircleAvatar(
              radius: 18,
              backgroundColor: Colors.white,
              child: Icon(
                Icons.person,
                color: WuyAppThemeConfig.wuyPrimaryColor,
                size: 22,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSearchCriteriaSection(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Search Filters',
            style: ThemeTextStyles.subtitle1.copyWith(
              fontWeight: FontWeight.w600,
              color: WuyAppThemeConfig.wuyTextPrimary,
            ),
          ),
          SizedBox(height: ThemeDimensions.paddingMedium),
          Row(
            children: [
              Expanded(
                flex: 2,
                child: _buildCompactFilterField(
                  controller: _nameController,
                  label: LocalizationKeysAppWuy.wuySearchName.tr(context),
                  icon: Icons.person_outline,
                ),
              ),
              SizedBox(width: ThemeDimensions.paddingSmall),
              Expanded(
                flex: 2,
                child: _buildCompactFilterField(
                  controller: _signatureController,
                  label: LocalizationKeysAppWuy.wuySearchSignature.tr(context),
                  icon: Icons.edit_outlined,
                ),
              ),
              SizedBox(width: ThemeDimensions.paddingSmall),
              Expanded(
                flex: 1,
                child: _buildGenderDropdown(context),
              ),
              SizedBox(width: ThemeDimensions.paddingSmall),
              Expanded(
                flex: 2,
                child: _buildCompactFilterField(
                  controller: _phoneController,
                  label: LocalizationKeysAppWuy.wuySearchPhone.tr(context),
                  icon: Icons.phone_outlined,
                  keyboardType: TextInputType.phone,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCompactFilterField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    TextInputType? keyboardType,
  }) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      style: ThemeTextStyles.bodyText2,
      decoration: InputDecoration(
        prefixIcon: Icon(icon, size: 18, color: WuyAppThemeConfig.wuyTextSecondary),
        hintText: label,
        hintStyle: ThemeTextStyles.caption.copyWith(
          color: ThemeColors.grey400,
        ),
        filled: true,
        fillColor: ThemeColors.grey05,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
          borderSide: BorderSide(color: ThemeColors.grey200, width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
          borderSide: BorderSide(color: WuyAppThemeConfig.wuyPrimaryColor, width: 1.5),
        ),
        contentPadding: EdgeInsets.symmetric(
          horizontal: ThemeDimensions.paddingSmall,
          vertical: 10,
        ),
      ),
    );
  }

  Widget _buildGenderDropdown(BuildContext context) {
    return DropdownButtonFormField<String>(
      value: _selectedGender,
      style: ThemeTextStyles.bodyText2.copyWith(
        color: WuyAppThemeConfig.wuyTextPrimary,
      ),
      decoration: InputDecoration(
        prefixIcon: Icon(Icons.wc, size: 18, color: WuyAppThemeConfig.wuyTextSecondary),
        filled: true,
        fillColor: ThemeColors.grey05,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
          borderSide: BorderSide(color: ThemeColors.grey200, width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
          borderSide: BorderSide(color: WuyAppThemeConfig.wuyPrimaryColor, width: 1.5),
        ),
        contentPadding: EdgeInsets.symmetric(
          horizontal: ThemeDimensions.paddingSmall,
          vertical: 10,
        ),
      ),
      items: [
        DropdownMenuItem(
          value: null,
          child: Text(
            LocalizationKeysAppWuy.wuySearchAllGender.tr(context),
            style: ThemeTextStyles.bodyText2,
          ),
        ),
        DropdownMenuItem(
          value: 'male',
          child: Text(
            LocalizationKeysAppWuy.wuySearchMale.tr(context),
            style: ThemeTextStyles.bodyText2,
          ),
        ),
        DropdownMenuItem(
          value: 'female',
          child: Text(
            LocalizationKeysAppWuy.wuySearchFemale.tr(context),
            style: ThemeTextStyles.bodyText2,
          ),
        ),
      ],
      onChanged: (value) {
        setState(() {
          _selectedGender = value;
        });
      },
    );
  }

  Widget _buildSearchBarSection(BuildContext context) {
    return Container(
      key: ValueKey('search_bar_container'),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
        border: Border.all(
          color: _searchFocusNode.hasFocus
              ? WuyAppThemeConfig.wuyPrimaryColor
              : ThemeColors.grey300,
          width: _searchFocusNode.hasFocus ? 2 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Padding(
            padding: EdgeInsets.only(left: ThemeDimensions.paddingMedium),
            child: Icon(
              Icons.search,
              color: WuyAppThemeConfig.wuyPrimaryColor,
              size: 22,
            ),
          ),
          Expanded(
            child: TextField(
              controller: _searchController,
              focusNode: _searchFocusNode,
              style: ThemeTextStyles.bodyText1,
              decoration: InputDecoration(
                hintText: LocalizationKeysAppWuy.wuySearchPlaceholder.tr(context),
                hintStyle: ThemeTextStyles.bodyText2.copyWith(
                  color: ThemeColors.grey400,
                ),
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                contentPadding: EdgeInsets.symmetric(
                  horizontal: ThemeDimensions.paddingMedium,
                  vertical: 14,
                ),
              ),
              onSubmitted: (_) => _performSearch(),
            ),
          ),
          Container(
            margin: EdgeInsets.all(6),
            child: ElevatedButton(
              onPressed: _performSearch,
              style: ElevatedButton.styleFrom(
                backgroundColor: WuyAppThemeConfig.wuyPrimaryColor,
                foregroundColor: Colors.white,
                padding: EdgeInsets.symmetric(
                  horizontal: ThemeDimensions.paddingLarge,
                  vertical: 12,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
                ),
                elevation: 0,
              ),
              child: Text(
                LocalizationKeysAppWuy.wuySearchTitle.tr(context),
                style: ThemeTextStyles.button.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchHistoryOverlay(BuildContext context) {
    return Positioned(
      left: ThemeDimensions.paddingMedium,
      right: ThemeDimensions.paddingMedium,
      top: 184,
      child: Material(
        elevation: 8,
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(ThemeDimensions.radiusLarge),
          bottomRight: Radius.circular(ThemeDimensions.radiusLarge),
        ),
        child: Container(
          constraints: BoxConstraints(
            maxHeight: 300,
          ),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.only(
              bottomLeft: Radius.circular(ThemeDimensions.radiusLarge),
              bottomRight: Radius.circular(ThemeDimensions.radiusLarge),
            ),
            border: Border(
              left: BorderSide(
                color: _searchFocusNode.hasFocus
                    ? WuyAppThemeConfig.wuyPrimaryColor
                    : ThemeColors.grey300,
                width: _searchFocusNode.hasFocus ? 2 : 1,
              ),
              right: BorderSide(
                color: _searchFocusNode.hasFocus
                    ? WuyAppThemeConfig.wuyPrimaryColor
                    : ThemeColors.grey300,
                width: _searchFocusNode.hasFocus ? 2 : 1,
              ),
              bottom: BorderSide(
                color: _searchFocusNode.hasFocus
                    ? WuyAppThemeConfig.wuyPrimaryColor
                    : ThemeColors.grey300,
                width: _searchFocusNode.hasFocus ? 2 : 1,
              ),
            ),
          ),
          child: _searchHistory.isEmpty
              ? Padding(
                  padding: EdgeInsets.all(ThemeDimensions.paddingLarge),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.history, color: ThemeColors.grey400, size: 20),
                      SizedBox(width: ThemeDimensions.paddingSmall),
                      Text(
                        'No search history',
                        style: ThemeTextStyles.bodyText2.copyWith(
                          color: ThemeColors.grey400,
                        ),
                      ),
                    ],
                  ),
                )
              : Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      padding: EdgeInsets.symmetric(
                        horizontal: ThemeDimensions.paddingMedium,
                        vertical: ThemeDimensions.paddingSmall,
                      ),
                      decoration: BoxDecoration(
                        color: WuyAppThemeConfig.wuyPrimaryColor.withOpacity(0.05),
                        borderRadius: BorderRadius.only(
                          topLeft: Radius.circular(ThemeDimensions.radiusMedium),
                          topRight: Radius.circular(ThemeDimensions.radiusMedium),
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Icon(
                                Icons.history,
                                size: 16,
                                color: WuyAppThemeConfig.wuyPrimaryColor,
                              ),
                              SizedBox(width: 6),
                              Text(
                                LocalizationKeysAppWuy.wuySearchHistory.tr(context),
                                style: ThemeTextStyles.subtitle2.copyWith(
                                  fontWeight: FontWeight.w600,
                                  color: WuyAppThemeConfig.wuyPrimaryColor,
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ),
                          InkWell(
                            onTap: _clearSearchHistory,
                            child: Padding(
                              padding: EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              child: Text(
                                LocalizationKeysAppWuy.wuySearchClearHistory.tr(context),
                                style: ThemeTextStyles.caption.copyWith(
                                  color: WuyAppThemeConfig.wuyPrimaryColor,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Flexible(
                      child: ListView.separated(
                        shrinkWrap: true,
                        padding: EdgeInsets.zero,
                        itemCount: _searchHistory.length > 5 ? 5 : _searchHistory.length,
                        separatorBuilder: (context, index) => Divider(
                          height: 1,
                          indent: 48,
                          color: ThemeColors.grey200,
                        ),
                        itemBuilder: (context, index) {
                          final history = _searchHistory[index];
                          return InkWell(
                            onTap: () => _selectHistoryItem(history),
                            child: Padding(
                              padding: EdgeInsets.symmetric(
                                horizontal: ThemeDimensions.paddingMedium,
                                vertical: 10,
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    Icons.search,
                                    color: ThemeColors.grey400,
                                    size: 18,
                                  ),
                                  SizedBox(width: ThemeDimensions.paddingMedium),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          history.searchText,
                                          style: ThemeTextStyles.bodyText2.copyWith(
                                            color: WuyAppThemeConfig.wuyTextPrimary,
                                          ),
                                        ),
                                        SizedBox(height: 2),
                                        Text(
                                          _formatHistoryTime(history.timestamp),
                                          style: ThemeTextStyles.caption.copyWith(
                                            color: ThemeColors.grey400,
                                            fontSize: 11,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Icon(
                                    Icons.north_west,
                                    color: ThemeColors.grey400,
                                    size: 16,
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }

  Widget _buildRecentlyViewedSection(BuildContext context) {
    if (_recentlyViewedFriends.isEmpty) return SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          LocalizationKeysAppWuy.wuySearchRecentlyViewed.tr(context),
          style: ThemeTextStyles.subtitle1.copyWith(
            fontWeight: FontWeight.w600,
            color: WuyAppThemeConfig.wuyTextPrimary,
          ),
        ),
        SizedBox(height: ThemeDimensions.paddingMedium),
        SizedBox(
          height: 100,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: _recentlyViewedFriends.length,
            separatorBuilder: (context, index) => SizedBox(width: ThemeDimensions.paddingMedium),
            itemBuilder: (context, index) {
              final friend = _recentlyViewedFriends[index];
              return _buildRecentlyViewedCard(context, friend);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildRecentlyViewedCard(BuildContext context, FriendModelAppWuy friend) {
    return GestureDetector(
      onTap: () {
        context.go(WuyAppRouter.routeFriendInfo.replaceAll(':id', friend.id));
      },
      child: Container(
        width: 80,
        padding: EdgeInsets.all(ThemeDimensions.paddingSmall),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
          boxShadow: [
            BoxShadow(
              color: ThemeColors.black.withOpacity(0.05),
              blurRadius: 8,
              offset: Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircleAvatar(
              radius: 24,
              backgroundColor: WuyAppThemeConfig.wuyPrimaryColor.withOpacity(0.12),
              backgroundImage: friend.avatarUrl != null && friend.avatarUrl!.isNotEmpty
                  ? NetworkImage(friend.avatarUrl!)
                  : null,
              child: friend.avatarUrl == null || friend.avatarUrl!.isEmpty
                  ? Text(
                      friend.displayName.isNotEmpty ? friend.displayName[0].toUpperCase() : '?',
                      style: TextStyle(
                        color: WuyAppThemeConfig.wuyPrimaryColor,
                        fontWeight: FontWeight.bold,
                      ),
                    )
                  : null,
            ),
            SizedBox(height: ThemeDimensions.paddingSmall),
            Text(
              friend.displayName,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: ThemeTextStyles.caption.copyWith(
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRecommendedSection(BuildContext context) {
    if (_recommendedFriends.isEmpty) return SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          LocalizationKeysAppWuy.wuySearchRecommended.tr(context),
          style: ThemeTextStyles.subtitle1.copyWith(
            fontWeight: FontWeight.w600,
            color: WuyAppThemeConfig.wuyTextPrimary,
          ),
        ),
        SizedBox(height: ThemeDimensions.paddingMedium),
        ListView.separated(
          shrinkWrap: true,
          physics: NeverScrollableScrollPhysics(),
          itemCount: _recommendedFriends.length,
          separatorBuilder: (context, index) => SizedBox(height: ThemeDimensions.paddingSmall),
          itemBuilder: (context, index) {
            final friend = _recommendedFriends[index];
            return _buildRecommendedFriendCard(context, friend);
          },
        ),
      ],
    );
  }

  Widget _buildRecommendedFriendCard(BuildContext context, FriendModelAppWuy friend) {
    return GestureDetector(
      onTap: () {
        context.go(WuyAppRouter.routeFriendInfo.replaceAll(':id', friend.id));
      },
      child: Container(
        padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
          boxShadow: [
            BoxShadow(
              color: ThemeColors.black.withOpacity(0.05),
              blurRadius: 10,
              offset: Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            Stack(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: WuyAppThemeConfig.wuyPrimaryColor.withOpacity(0.12),
                  backgroundImage: friend.avatarUrl != null && friend.avatarUrl!.isNotEmpty
                      ? NetworkImage(friend.avatarUrl!)
                      : null,
                  child: friend.avatarUrl == null || friend.avatarUrl!.isEmpty
                      ? Text(
                          friend.displayName.isNotEmpty ? friend.displayName[0].toUpperCase() : '?',
                          style: TextStyle(
                            color: WuyAppThemeConfig.wuyPrimaryColor,
                            fontWeight: FontWeight.bold,
                            fontSize: 18,
                          ),
                        )
                      : null,
                ),
                if (friend.isOnline)
                  Positioned(
                    bottom: 2,
                    right: 2,
                    child: Container(
                      width: 12,
                      height: 12,
                      decoration: BoxDecoration(
                        color: WuyAppThemeConfig.wuyOnlineColor,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2),
                      ),
                    ),
                  ),
              ],
            ),
            SizedBox(width: ThemeDimensions.paddingMedium),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    friend.displayNameOrUsername,
                    style: ThemeTextStyles.subtitle2.copyWith(
                      fontWeight: FontWeight.w600,
                      color: WuyAppThemeConfig.wuyTextPrimary,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    friend.bio?.isNotEmpty == true ? friend.bio! : 'No bio',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: ThemeTextStyles.caption.copyWith(
                      color: WuyAppThemeConfig.wuyTextSecondary,
                    ),
                  ),
                ],
              ),
            ),
            IconButton(
              icon: Icon(
                Icons.person_add_outlined,
                color: WuyAppThemeConfig.wuyPrimaryColor,
              ),
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Add ${friend.displayName}')),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchResultsSection(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Search Results',
              style: ThemeTextStyles.subtitle1.copyWith(
                fontWeight: FontWeight.w600,
                color: WuyAppThemeConfig.wuyTextPrimary,
              ),
            ),
            Container(
              padding: EdgeInsets.symmetric(
                horizontal: ThemeDimensions.paddingSmall,
                vertical: 4,
              ),
              decoration: BoxDecoration(
                color: WuyAppThemeConfig.wuyPrimaryColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
              ),
              child: Text(
                '${_searchResults.length} found',
                style: ThemeTextStyles.caption.copyWith(
                  color: WuyAppThemeConfig.wuyPrimaryColor,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
        SizedBox(height: ThemeDimensions.paddingMedium),
        ListView.separated(
          shrinkWrap: true,
          physics: NeverScrollableScrollPhysics(),
          itemCount: _searchResults.length,
          separatorBuilder: (context, index) => SizedBox(height: ThemeDimensions.paddingSmall),
          itemBuilder: (context, index) {
            final friend = _searchResults[index];
            return _buildRecommendedFriendCard(context, friend);
          },
        ),
      ],
    );
  }

  Widget _buildLoadingState(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(vertical: 40),
      alignment: Alignment.center,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation<Color>(
              WuyAppThemeConfig.wuyPrimaryColor,
            ),
          ),
          SizedBox(height: ThemeDimensions.paddingMedium),
          Text(
            'Searching...',
            style: ThemeTextStyles.bodyText2.copyWith(
              color: WuyAppThemeConfig.wuyTextSecondary,
            ),
          ),
        ],
      ),
    );
  }

  String _formatHistoryTime(DateTime timestamp) {
    final now = DateTime.now();
    final difference = now.difference(timestamp);

    if (difference.inMinutes < 60) {
      return '${difference.inMinutes}m ago';
    } else if (difference.inHours < 24) {
      return '${difference.inHours}h ago';
    } else {
      return '${difference.inDays}d ago';
    }
  }
}
