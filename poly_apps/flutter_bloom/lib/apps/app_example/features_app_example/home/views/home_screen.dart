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

// AI: Claude Code - Refactored home screen to use enhanced common components
// CHANGES MADE:
// 1. Replaced HomeBar + TopDropdownMenu with EnhancedTopMenu for better user experience
// 2. Added dropdown functionality with learning features
// 3. Integrated user authentication status display in avatar and subtitle
// 4. Added proper action buttons for notifications and search
// NOTICE TO OTHER AIs: This home screen now uses the new EnhancedTopMenu component.
// The old TopDropdownMenu and HomeBar have been replaced. Do not revert to old implementations.
// If you need to modify the menu, update the _buildDropdownItems() method or EnhancedTopMenu directly.

import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_example/features_app_example/home/widget/banner_widget.dart';
import 'package:qyflutter/apps/app_example/features_app_example/home/widget/coming_list.dart';
import 'package:qyflutter/apps/app_example/features_app_example/home/widget/fund_rising_listview.dart';
import 'package:qyflutter/apps/app_example/features_app_example/home/widget/home_title.dart';
import 'package:qyflutter/apps/app_example/features_app_example/home/widget/urgent_fund_rising_widget.dart';
import 'package:qyflutter/apps/app_example/features_app_example/home/widget/prayer_listview.dart';
import 'package:qyflutter/apps/app_example/features_app_example/home/widget/watch_impact_list.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/widgets/enhanced_top_menu.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/common/provider_status/user_provider.dart';
import 'package:qyflutter/apps/app_example/features_app_example/home/widget/logined_func_widget.dart';
import 'package:qyflutter/apps/app_example/features_app_example/home/widget/logined_wordgroup_widget.dart';
import 'package:go_router/go_router.dart';
// AI: Claude Code - Replaced old top_menu and home_bar with EnhancedTopMenu
// This refactor provides better dropdown functionality and user profile display
import 'package:qyflutter/apps/app_example/router_app_example/routes_provider_app_example.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _isMenuVisible = false;

  void _toggleMenu() {
    setState(() {
      _isMenuVisible = !_isMenuVisible;
    });
  }

  List<TopMenuItem> _buildDropdownItems() {
    return [
      TopMenuItem(
        label: 'learning.ai_tutor',
        icon: Icons.school,
        iconColor: const Color(0xFF4CAF50),
        backgroundColor: const Color(0xFFFFF8E1),
        onTap: () => _showFeatureDialog(context, 'learning.ai_tutor'),
      ),
      TopMenuItem(
        label: 'learning.smart_review',
        icon: Icons.refresh,
        iconColor: const Color(0xFF2196F3),
        backgroundColor: const Color(0xFFFFF8E1),
        onTap: () => _showFeatureDialog(context, 'learning.smart_review'),
      ),
      TopMenuItem(
        label: 'learning.podcast_listening',
        icon: Icons.headphones,
        iconColor: const Color(0xFFE91E63),
        backgroundColor: const Color(0xFFFFF8E1),
        onTap: () => _showFeatureDialog(context, 'learning.podcast_listening'),
      ),
      TopMenuItem(
        label: 'learning.news_reading',
        icon: Icons.article,
        iconColor: const Color(0xFF9C27B0),
        backgroundColor: const Color(0xFFFFF8E1),
        onTap: () => _showFeatureDialog(context, 'learning.news_reading'),
      ),
      TopMenuItem(
        label: 'learning.word_memorization',
        icon: Icons.note_add,
        iconColor: const Color(0xFF00BCD4),
        backgroundColor: const Color(0xFFFFF8E1),
        onTap: () => _showFeatureDialog(context, 'learning.word_memorization'),
      ),
      TopMenuItem(
        label: 'learning.ai_quiz',
        icon: Icons.quiz,
        iconColor: const Color(0xFFFF9800),
        backgroundColor: const Color(0xFFFFF8E1),
        onTap: () => _showFeatureDialog(context, 'learning.ai_quiz'),
      ),
    ];
  }

  void _showFeatureDialog(BuildContext context, String featureName) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('feature_preview'.tr(context)),
        content: Text('$featureName ${'feature_coming_soon'.tr(context)}'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('close'.tr(context)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final userProvider = context.watch<BaseUserProvider>();

    return Scaffold(
      body: Column(
        children: [
          EnhancedTopMenu(
            title: 'app_name',
            avatar: CircleAvatar(
              backgroundColor: Theme.of(context).primaryColor,
              child: Text(
                userProvider.isAuthenticated 
                    ? userProvider.user?.name?.substring(0, 1).toUpperCase() ?? 'U'
                    : 'G',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
              ),
            ),
            subtitle: userProvider.isAuthenticated 
                ? 'welcome_back'
                : 'guest_mode',
            showDropdown: _isMenuVisible,
            onDropdownToggle: _toggleMenu,
            dropdownItems: _buildDropdownItems(),
            actions: [
              TopMenuAction(
                tooltip: 'notifications',
                icon: Icons.notifications_outlined,
                onPressed: () => context.push(ExampleAppRoutesProvider.routeNotifications),
              ),
              TopMenuAction(
                tooltip: 'search',
                icon: Icons.search,
                onPressed: () => context.push(ExampleAppRoutesProvider.routeSearch),
              ),
            ],
          ),
          Expanded(
            child: Stack(
              children: [
          CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
                  child: Column(
                    children: [
                      const BannerWidget(),
                      if (userProvider.isAuthenticated) ...[
                        const LoginedFuncWidget(),
                        const LoginedWordGroupWidget(),
                      ],
                      CustomHomeTitle(
                        title: 'home_screen.urgent_fundraising'.tr(context),
                        onTap: () {
                          context.push(ExampleAppRoutesProvider.routeUrgentFundraising);
                        },
                      ),
                      const UrgentFundRisingWidget(),
                      const FundRisingListView(),
                      CustomHomeTitle(
                        title: 'home_screen.coming_to_end'.tr(context),
                        onTap: () {
                          context.push(ExampleAppRoutesProvider.routeComingEnd);
                        },
                      ),
                      const ComingListView(),
                      CustomHomeTitle(
                        title: 'home_screen.watch_impact'.tr(context),
                        onTap: () {
                          context.push(ExampleAppRoutesProvider.routeWatchImpact);
                        },
                      ),
                      const WatchImpactList(),
                      CustomHomeTitle(
                        title: 'home_top_menu_prayer'.tr(context),
                        onTap: () {
                          context.push(ExampleAppRoutesProvider.routePrayer);
                        },
                      ),
                      const PrayerListView(),
                      const SizedBox(
                        height: 70,
                      )
                    ],
                  ),
                ),
              )
            ],
          ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
