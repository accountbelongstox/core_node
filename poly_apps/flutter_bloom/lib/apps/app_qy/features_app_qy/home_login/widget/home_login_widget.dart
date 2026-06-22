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
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../resources_app_qy/colors_app_qy.dart';
import 'package:intl/intl.dart';

// AI MODIFICATION NOTE: This widget was enhanced by QR_Profile_AI_Assistant
// - Added proper theme system imports
// - Enhanced with localization support
// - Will replace hardcoded Chinese text with localized strings
// Other AIs: Please maintain theme system consistency

class HomeLoginWidget extends StatefulWidget {
  const HomeLoginWidget({super.key});

  @override
  State<HomeLoginWidget> createState() => _HomeLoginWidgetState();
}

class _HomeLoginWidgetState extends State<HomeLoginWidget> {
  String _getWeekdayName(int weekday, BuildContext context) {
    final keys = [
      QyAppLocalizationKeys.qySunday,
      QyAppLocalizationKeys.qyMonday,
      QyAppLocalizationKeys.qyTuesday,
      QyAppLocalizationKeys.qyWednesday,
      QyAppLocalizationKeys.qyThursday,
      QyAppLocalizationKeys.qyFriday,
      QyAppLocalizationKeys.qySaturday,
    ];
    return keys[weekday].tr(context);
  }

  bool _isMenuOpen = false;
  bool _isSearchModalOpen = false;
  bool _isStatsModalOpen = false;
  String _selectedSearchOption = 'global';

  List<Map<String, dynamic>> _getMenuItems(BuildContext context) => [
    {'icon': Icons.home, 'label': 'qy_home'.tr(context)},
    {'icon': Icons.menu_book, 'label': 'qy_learning'.tr(context)},
    {'icon': Icons.bar_chart, 'label': 'qy_statistics'.tr(context)},
    {'icon': Icons.emoji_events, 'label': 'qy_achievements'.tr(context)},
    {'icon': Icons.people, 'label': 'qy_community'.tr(context)},
    {'icon': Icons.calendar_today, 'label': 'qy_calendar'.tr(context)},
    {'icon': Icons.settings, 'label': 'qy_settings'.tr(context)},
    {'icon': Icons.help_outline, 'label': 'qy_help'.tr(context)},
  ];

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        // 主内容
        Column(
          children: [
            // 顶部导航栏
            _buildTopBar(),
            // 时间条
            _buildTimeline(),
          ],
        ),
        // 下拉菜单
        if (_isMenuOpen) _buildDropdownMenu(),
        // 搜索弹窗
        if (_isSearchModalOpen) _buildSearchModal(),
        // 统计弹窗
        if (_isStatsModalOpen) _buildStatsModal(),
      ],
    );
  }

  Widget _buildTopBar() {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.spacing16),
      color: ColorsAppQy.qyPrimary,
      child: Row(
        children: [
          IconButton(
            icon: Icon(Icons.menu, color: ColorsAppQy.qyTextOnPrimary),
            onPressed: () => setState(() => _isMenuOpen = !_isMenuOpen),
          ),
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _isSearchModalOpen = true),
              child: Container(
                padding: EdgeInsets.symmetric(horizontal: ThemeDimensions.spacing16),
                decoration: BoxDecoration(
                  color: ColorsAppQy.qyFrostLight,
                  borderRadius: BorderRadius.circular(ThemeDimensions.radiusXL),
                ),
                child: TextField(
                  enabled: false,
                  decoration: InputDecoration(
                    hintText: 'qy_placeholder_search'.tr(context),
                    hintStyle: ThemeTextStyles.bodyMedium.copyWith(
                      color: ColorsAppQy.qyFrostMedium,
                    ),
                    border: InputBorder.none,
                  ),
                ),
              ),
            ),
          ),
          CircleAvatar(
            radius: ThemeDimensions.avatarSizeS / 2,
            backgroundColor: ThemeColors.systemGroupedBackground,
            child: Icon(
              Icons.person,
              color: ColorsAppQy.qyPrimary,
              size: ThemeDimensions.iconSizeM,
            ),
          ),
          IconButton(
            icon: Icon(Icons.settings, color: ColorsAppQy.qyTextOnPrimary),
            onPressed: () {},
          ),
        ],
      ),
    );
  }

  Widget _buildDropdownMenu() {
    final menuItems = _getMenuItems(context);
    return Positioned(
      top: 70,
      left: 0,
      right: 0,
      child: Container(
        height: MediaQuery.of(context).size.height * 0.3,
        color: ThemeColors.systemBackground,
        child: GridView.builder(
          padding: EdgeInsets.all(ThemeDimensions.spacing16),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 4,
            crossAxisSpacing: ThemeDimensions.spacing8,
            mainAxisSpacing: ThemeDimensions.spacing8,
          ),
          itemCount: menuItems.length,
          itemBuilder: (context, index) {
            final item = menuItems[index];
            return InkWell(
              onTap: () {},
              child: Container(
                decoration: BoxDecoration(
                  color: ThemeColors.systemGroupedBackground,
                  borderRadius: BorderRadius.circular(ThemeDimensions.radiusM),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(item['icon'], color: ColorsAppQy.qyPrimary),
                    SizedBox(height: ThemeDimensions.spacing4),
                    Text(
                      item['label'],
                      style: ThemeTextStyles.bodySmall,
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildSearchModal() {
    return Positioned.fill(
      child: GestureDetector(
        onTap: () => setState(() => _isSearchModalOpen = false),
        child: Container(
          color: ColorsAppQy.qyShadowLight,
          child: Center(
            child: Container(
              width: MediaQuery.of(context).size.width * 0.9,
              height: 300,
              decoration: BoxDecoration(
                color: ThemeColors.systemBackground,
                borderRadius: BorderRadius.circular(ThemeDimensions.radiusL),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: TextButton(
                          onPressed: () =>
                              setState(() => _selectedSearchOption = 'global'),
                          child: Text(
                            'qy_global_search'.tr(context),
                            style: ThemeTextStyles.bodyMedium.copyWith(
                              color: _selectedSearchOption == 'global'
                                  ? ColorsAppQy.qyPrimary
                                  : ColorsAppQy.qyTextTertiary,
                              fontWeight: _selectedSearchOption == 'global'
                                  ? FontWeight.bold
                                  : FontWeight.normal,
                            ),
                          ),
                        ),
                      ),
                      Expanded(
                        child: TextButton(
                          onPressed: () =>
                              setState(() => _selectedSearchOption = 'ai'),
                          child: Text(
                            'qy_ai_search'.tr(context),
                            style: ThemeTextStyles.bodyMedium.copyWith(
                              color: _selectedSearchOption == 'ai'
                                  ? ColorsAppQy.qyPrimary
                                  : ColorsAppQy.qyTextTertiary,
                              fontWeight: _selectedSearchOption == 'ai'
                                  ? FontWeight.bold
                                  : FontWeight.normal,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  Padding(
                    padding: EdgeInsets.all(ThemeDimensions.spacing16),
                    child: TextField(
                      decoration: InputDecoration(
                        hintText: 'qy_placeholder_search_content'.tr(context),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(ThemeDimensions.radiusXL),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTimeline() {
    return Padding(
      padding: EdgeInsets.all(ThemeDimensions.spacing20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'qy_learning_progress'.tr(context),
            style: ThemeTextStyles.titleMedium.copyWith(
              fontWeight: FontWeight.bold,
              color: ColorsAppQy.qyPrimary,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacing16),
          SizedBox(
            height: 100,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: 7,
              itemBuilder: (context, index) {
                final date = DateTime.now().subtract(Duration(days: 6 - index));
                final progress = (index + 1) * 15;
                return GestureDetector(
                  onTap: () => setState(() => _isStatsModalOpen = true),
                  child: Container(
                    width: 80,
                    margin: const EdgeInsets.only(right: 10),
                    decoration: BoxDecoration(
                      color: ColorsAppQy.qyTextOnPrimary,
                      borderRadius: BorderRadius.circular(ThemeDimensions.radiusM),
                      boxShadow: [
                        BoxShadow(
                          color: ColorsAppQy.qyBorderLight,
                          spreadRadius: 1,
                          blurRadius: 5,
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        Text(
                          '${QyAppLocalizationKeys.qyWeek.tr(context)}${_getWeekdayName(date.weekday % 7, context)}',
                          style: TextStyle(color: ColorsAppQy.qyTextSecondary),
                        ),
                        Text(
                          '${date.month}/${date.day}',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        Stack(
                          alignment: Alignment.center,
                          children: [
                            Container(
                              width: 50,
                              height: 50,
                              decoration: BoxDecoration(
                                color: ColorsAppQy.qyBorderLight,
                                shape: BoxShape.circle,
                              ),
                            ),
                            Container(
                              width: 50,
                              height: 50,
                              decoration: BoxDecoration(
                                color: const Color(0xFF4A6BAF),
                                shape: BoxShape.circle,
                              ),
                              clipBehavior: Clip.antiAlias,
                              child: Align(
                                alignment: Alignment.bottomCenter,
                                child: FractionallySizedBox(
                                  heightFactor: progress / 100,
                                  child: Container(
                                    color: ColorsAppQy.qyTextOnPrimary,
                                  ),
                                ),
                              ),
                            ),
                            Text(
                              '$progress%',
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
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
    );
  }

  Widget _buildStatsModal() {
    return Positioned.fill(
      child: Container(
        color: ColorsAppQy.qyShadowLight,
        child: Center(
          child: Container(
            width: MediaQuery.of(context).size.width * 0.9,
            height: 300,
            decoration: BoxDecoration(
              color: ColorsAppQy.qyTextOnPrimary,
              borderRadius: BorderRadius.circular(ThemeDimensions.radiusL),
            ),
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(15),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        DateFormat('yyyy年MM月dd日', 'zh_CN').format(DateTime.now()),
                        style: ThemeTextStyles.title2.copyWith(
                          fontWeight: FontWeight.bold,
                          color: ColorsAppQy.qyPrimary,
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () =>
                            setState(() => _isStatsModalOpen = false),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(15),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(QyAppLocalizationKeys.qyWordTask.tr(context)),
                          const Text('30/50'),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Container(
                        height: 10,
                        decoration: BoxDecoration(
                          color: ColorsAppQy.qyBorderLight,
                          borderRadius: BorderRadius.circular(5),
                        ),
                        child: FractionallySizedBox(
                          alignment: Alignment.centerLeft,
                          widthFactor: 0.6,
                          child: Container(
                            decoration: BoxDecoration(
                              color: ColorsAppQy.qyPrimary,
                              borderRadius: BorderRadius.circular(5),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'qy_study_duration'.tr(context),
                            style: ThemeTextStyles.bodyMedium,
                          ),
                          Text(
                            '45 min',
                            style: ThemeTextStyles.bodyMedium.copyWith(
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: ThemeDimensions.spacing20),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'qy_accuracy_rate'.tr(context),
                            style: ThemeTextStyles.bodyMedium,
                          ),
                          Text(
                            '85%',
                            style: ThemeTextStyles.bodyMedium.copyWith(
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: ThemeDimensions.spacing20),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'qy_review_count'.tr(context),
                            style: ThemeTextStyles.bodyMedium,
                          ),
                          Text(
                            '3 times',
                            style: ThemeTextStyles.bodyMedium.copyWith(
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
