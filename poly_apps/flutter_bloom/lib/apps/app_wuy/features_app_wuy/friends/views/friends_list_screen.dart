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
import 'package:provider/provider.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../../../widgets_app_wuy/wuy_bottom_navigation.dart';
import '../../../widgets_app_wuy/wuy_modern_input_field.dart';
import '../../../theme_app_wuy/theme_config_app_wuy.dart';
import '../../../router_app_wuy/router_app_wuy.dart';
import '../../../localization_app_wuy/localization_keys_app_wuy.dart';
import '../../../providers_app_wuy/wu_user_provider.dart';
import '../../../providers_app_wuy/friends_provider_app_wuy.dart';
import '../../../models_app_wuy/friend_model_app_wuy.dart';
import '../../../widgets_app_wuy/wuy_common_background.dart';
import '../../../widgets_app_wuy/wuy_enhanced_friend_list_item.dart';

/// Friends List Screen for Wuy App
///
/// This screen displays a list of friends and provides search functionality.
/// Users can view friend information and add new friends.
///
/// Localization Usage:
/// - All user-facing text uses LocalizationKeysAppWuy constants with .tr(context) method
/// - Text keys are defined in localization_keys_app_wuy.dart
/// - Translations are provided in en_app_wuy.dart and zh_app_wuy.dart
/// - Example: LocalizationKeysAppWuy.wuyFriendsTitle.tr(context)
class WuyFriendsListScreen extends StatefulWidget {
  const WuyFriendsListScreen({super.key});

  @override
  State<WuyFriendsListScreen> createState() => _WuyFriendsListScreenState();
}

class _WuyFriendsListScreenState extends State<WuyFriendsListScreen> {
  final TextEditingController _searchController = TextEditingController();
  List<FriendModelAppWuy> _filteredFriends = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final friendsProvider =
          Provider.of<FriendsProviderAppWuy>(context, listen: false);
      if (friendsProvider.friends.isEmpty) {
        friendsProvider.loadFriends();
      }
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _filterFriends(String query, List<FriendModelAppWuy> allFriends) {
    setState(() {
      if (query.isEmpty) {
        _filteredFriends = allFriends;
      } else {
        _filteredFriends = allFriends.where((friend) {
          return friend.displayName
                  .toLowerCase()
                  .contains(query.toLowerCase()) ||
              friend.username.toLowerCase().contains(query.toLowerCase()) ||
              (friend.phoneNumber?.contains(query) ?? false);
        }).toList();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Consumer2<WuUserProvider, FriendsProviderAppWuy>(
      builder: (context, userProvider, friendsProvider, child) {
        final allFriends = friendsProvider.friends;
        final displayFriends =
            _filteredFriends.isEmpty && _searchController.text.isEmpty
                ? allFriends
                : _filteredFriends;

        return WuyCommonBackground(
          child: Scaffold(
            backgroundColor: Colors.transparent,
            appBar: AppBar(
              title: Text(
                LocalizationKeysAppWuy.wuyFriendsTitle.tr(context),
                style: WuyAppThemeConfig.wuyAppBarTitle.copyWith(
                  fontWeight: FontWeight.w700,
                  fontSize: 22,
                  letterSpacing: -0.5,
                ),
              ),
              backgroundColor: WuyAppThemeConfig.wuyPrimaryColor,
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
            ),
            body: Column(
              children: [
                _buildSearchBar(allFriends),
                Expanded(
                  child: friendsProvider.isLoading
                      ? const Center(child: CircularProgressIndicator())
                      : _buildFriendsList(displayFriends),
                ),
              ],
            ),
            bottomNavigationBar: WuyBottomNavigation(
              currentIndex: 1,
              onTap: (index) {
                switch (index) {
                  case 0:
                    context.go(WuyAppRouter.routeSearch);
                    break;
                  case 1:
                    break;
                  case 2:
                    context.go(WuyAppRouter.routeFindFriends);
                    break;
                  case 3:
                    context.go(WuyAppRouter.routeProfile);
                    break;
                }
              },
            ),
          ),
        );
      },
    );
  }

  Widget _buildSearchBar(List<FriendModelAppWuy> allFriends) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: WuyModernInputField(
          controller: _searchController,
          onChanged: (query) => _filterFriends(query, allFriends),
          hintText: LocalizationKeysAppWuy.wuyFriendsSearch.tr(context),
          prefixIcon: Icons.search,
        ),
      ),
    );
  }

  Widget _buildFriendsList(List<FriendModelAppWuy> friends) {
    if (friends.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.people_outline,
              size: 64,
              color: WuyAppThemeConfig.wuyTextSecondary,
            ),
            SizedBox(height: WuyAppThemeConfig.wuyDefaultPadding),
            Text(
              _searchController.text.isEmpty
                  ? LocalizationKeysAppWuy.wuyFriendsNoFriends.tr(context)
                  : LocalizationKeysAppWuy.wuySearchNoResults.tr(context),
              style: ThemeTextStyles.bodyText1.copyWith(
                color: WuyAppThemeConfig.wuyTextSecondary,
              ),
            ),
            if (_searchController.text.isEmpty) ...[
              SizedBox(height: WuyAppThemeConfig.wuyDefaultPadding),
              ElevatedButton(
                onPressed: () {
                  context.go(WuyAppRouter.routeFindFriends);
                },
                style: WuyAppThemeConfig.wuyPrimaryButton,
                child: Text(
                    LocalizationKeysAppWuy.wuyFriendsAddFriend.tr(context)),
              ),
            ],
          ],
        ),
      );
    }

    return ListView.builder(
      itemCount: friends.length,
      itemBuilder: (context, index) {
        final friend = friends[index];
        return WuyEnhancedFriendListItem(friend: friend);
      },
    );
  }
}
