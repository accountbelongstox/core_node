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

library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../controllers/social_controller_app_qy.dart';

class SocialStudyGroupScreenRefactoredAppQy extends StatefulWidget {
  const SocialStudyGroupScreenRefactoredAppQy({super.key});

  @override
  State<SocialStudyGroupScreenRefactoredAppQy> createState() =>
      _SocialStudyGroupScreenRefactoredAppQyState();
}

class _SocialStudyGroupScreenRefactoredAppQyState
    extends State<SocialStudyGroupScreenRefactoredAppQy> {
  String _selectedTab = 'my_groups';
  final List<Map<String, dynamic>> _myGroups = [];
  final List<Map<String, dynamic>> _discoverGroups = [];

  @override
  void initState() {
    super.initState();
    _initGroups();
  }

  void _initGroups() {
    _myGroups.addAll([
      {
        'id': 'g1',
        'name': 'IELTS Warriors',
        'description': 'Preparing for IELTS together',
        'members': 156,
        'activeMembers': 45,
        'category': 'Exam Prep',
        'icon': Icons.group,
        'color': Colors.blue,
        'lastActive': '2 hours ago',
      },
      {
        'id': 'g2',
        'name': 'Business English Club',
        'description': 'Professional English practice',
        'members': 89,
        'activeMembers': 32,
        'category': 'Business',
        'icon': Icons.business,
        'color': Colors.teal,
        'lastActive': '5 hours ago',
      },
    ]);

    _discoverGroups.addAll([
      {
        'id': 'g3',
        'name': 'Daily Conversation',
        'description': 'Practice everyday English',
        'members': 234,
        'activeMembers': 89,
        'category': 'General',
        'icon': Icons.chat,
        'color': Colors.green,
        'tags': ['Beginner', 'Speaking'],
      },
      {
        'id': 'g4',
        'name': 'TOEFL Prep 2024',
        'description': 'Study together for TOEFL',
        'members': 178,
        'activeMembers': 67,
        'category': 'Exam Prep',
        'icon': Icons.school,
        'color': Colors.purple,
        'tags': ['Advanced', 'Test Prep'],
      },
      {
        'id': 'g5',
        'name': 'Academic Writing',
        'description': 'Improve academic writing skills',
        'members': 145,
        'activeMembers': 54,
        'category': 'Academic',
        'icon': Icons.edit,
        'color': Colors.indigo,
        'tags': ['Writing', 'University'],
      },
    ]);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyStudyGroups.tr(context),
          style: TextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.pop(context),
          icon: Icon(Icons.arrow_back, color: ThemeColors.textPrimary),
        ),
        actions: [
          IconButton(
            onPressed: () {},
            icon: Icon(Icons.search, color: ThemeColors.textPrimary),
          ),
          IconButton(
            onPressed: () {},
            icon: Icon(Icons.add, color: ThemeColors.textPrimary),
          ),
        ],
      ),
      body: Column(
        children: [
          _buildTabSelector(),
          Expanded(
            child: _selectedTab == 'my_groups'
                ? _buildMyGroupsList()
                : _buildDiscoverGroupsList(),
          ),
        ],
      ),
    );
  }

  Widget _buildTabSelector() {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        border: Border(
          bottom: BorderSide(color: ThemeColors.border),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: _buildTabButton(
              'my_groups',
              QyAppLocalizationKeys.qyMyGroups.tr(context),
              Icons.groups,
            ),
          ),
          SizedBox(width: Dimensions.spacingMedium),
          Expanded(
            child: _buildTabButton(
              'discover',
              QyAppLocalizationKeys.qyDiscover.tr(context),
              Icons.explore,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTabButton(String tab, String label, IconData icon) {
    final isSelected = _selectedTab == tab;

    return InkWell(
      onTap: () => setState(() => _selectedTab = tab),
      child: Container(
        padding: EdgeInsets.symmetric(
          vertical: Dimensions.paddingMedium,
        ),
        decoration: BoxDecoration(
          color: isSelected ? ThemeColors.primary : Colors.transparent,
          borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
          border: Border.all(
            color: isSelected ? ThemeColors.primary : ThemeColors.border,
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              color: isSelected ? ThemeColors.surface : ThemeColors.textSecondary,
              size: 20,
            ),
            SizedBox(width: Dimensions.spacingSmall),
            Text(
              label,
              style: TextStyles.button.copyWith(
                color: isSelected ? ThemeColors.surface : ThemeColors.textPrimary,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMyGroupsList() {
    if (_myGroups.isEmpty) {
      return _buildEmptyState();
    }

    return ListView.builder(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      itemCount: _myGroups.length,
      itemBuilder: (context, index) {
        return Padding(
          padding: EdgeInsets.only(bottom: Dimensions.spacingMedium),
          child: _buildMyGroupCard(_myGroups[index]),
        );
      },
    );
  }

  Widget _buildDiscoverGroupsList() {
    return ListView.builder(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      itemCount: _discoverGroups.length,
      itemBuilder: (context, index) {
        return Padding(
          padding: EdgeInsets.only(bottom: Dimensions.spacingMedium),
          child: _buildDiscoverGroupCard(_discoverGroups[index]),
        );
      },
    );
  }

  Widget _buildMyGroupCard(Map<String, dynamic> group) {
    final color = group['color'] as Color;

    return InkWell(
      onTap: () {},
      child: Container(
        padding: EdgeInsets.all(Dimensions.paddingMedium),
        decoration: BoxDecoration(
          color: ThemeColors.surface,
          borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
          border: Border.all(color: ThemeColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: EdgeInsets.all(Dimensions.paddingMedium),
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
                  ),
                  child: Icon(
                    group['icon'] as IconData,
                    color: color,
                    size: 28,
                  ),
                ),
                SizedBox(width: Dimensions.spacingMedium),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        group['name'] as String,
                        style: TextStyles.h4.copyWith(
                          color: ThemeColors.textPrimary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      SizedBox(height: Dimensions.spacingXSmall),
                      Text(
                        group['description'] as String,
                        style: TextStyles.caption.copyWith(
                          color: ThemeColors.textSecondary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                Icon(Icons.chevron_right, color: ThemeColors.textTertiary),
              ],
            ),
            SizedBox(height: Dimensions.spacingMedium),
            Divider(height: 1, color: ThemeColors.border),
            SizedBox(height: Dimensions.spacingMedium),
            Row(
              children: [
                Container(
                  padding: EdgeInsets.symmetric(
                    horizontal: Dimensions.paddingSmall,
                    vertical: Dimensions.paddingXSmall,
                  ),
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
                  ),
                  child: Text(
                    group['category'] as String,
                    style: TextStyles.caption.copyWith(
                      color: color,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                SizedBox(width: Dimensions.spacingMedium),
                Icon(Icons.people, size: 14, color: ThemeColors.textSecondary),
                SizedBox(width: Dimensions.spacingXSmall),
                Text(
                  '${group['members']}',
                  style: TextStyles.caption.copyWith(
                    color: ThemeColors.textSecondary,
                  ),
                ),
                SizedBox(width: Dimensions.spacingMedium),
                Icon(Icons.circle, size: 6, color: ThemeColors.success),
                SizedBox(width: Dimensions.spacingXSmall),
                Text(
                  '${group['activeMembers']} ${QyAppLocalizationKeys.qyActive.tr(context)}',
                  style: TextStyles.caption.copyWith(
                    color: ThemeColors.textSecondary,
                  ),
                ),
                Spacer(),
                Text(
                  group['lastActive'] as String,
                  style: TextStyles.caption.copyWith(
                    color: ThemeColors.textTertiary,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDiscoverGroupCard(Map<String, dynamic> group) {
    final color = group['color'] as Color;
    final tags = group['tags'] as List<String>;

    return InkWell(
      onTap: () {},
      child: Container(
        padding: EdgeInsets.all(Dimensions.paddingMedium),
        decoration: BoxDecoration(
          color: ThemeColors.surface,
          borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
          border: Border.all(color: ThemeColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: EdgeInsets.all(Dimensions.paddingMedium),
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
                  ),
                  child: Icon(
                    group['icon'] as IconData,
                    color: color,
                    size: 28,
                  ),
                ),
                SizedBox(width: Dimensions.spacingMedium),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        group['name'] as String,
                        style: TextStyles.h4.copyWith(
                          color: ThemeColors.textPrimary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      SizedBox(height: Dimensions.spacingXSmall),
                      Text(
                        group['description'] as String,
                        style: TextStyles.caption.copyWith(
                          color: ThemeColors.textSecondary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            SizedBox(height: Dimensions.spacingMedium),
            Wrap(
              spacing: Dimensions.spacingSmall,
              runSpacing: Dimensions.spacingSmall,
              children: tags.map((tag) {
                return Container(
                  padding: EdgeInsets.symmetric(
                    horizontal: Dimensions.paddingSmall,
                    vertical: Dimensions.paddingXSmall,
                  ),
                  decoration: BoxDecoration(
                    color: ThemeColors.background,
                    borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
                    border: Border.all(color: ThemeColors.border),
                  ),
                  child: Text(
                    tag,
                    style: TextStyles.caption.copyWith(
                      color: ThemeColors.textSecondary,
                    ),
                  ),
                );
              }).toList(),
            ),
            SizedBox(height: Dimensions.spacingMedium),
            Row(
              children: [
                Icon(Icons.people, size: 14, color: ThemeColors.textSecondary),
                SizedBox(width: Dimensions.spacingXSmall),
                Text(
                  '${group['members']} ${QyAppLocalizationKeys.qyMembers.tr(context)}',
                  style: TextStyles.caption.copyWith(
                    color: ThemeColors.textSecondary,
                  ),
                ),
                SizedBox(width: Dimensions.spacingMedium),
                Icon(Icons.circle, size: 6, color: ThemeColors.success),
                SizedBox(width: Dimensions.spacingXSmall),
                Text(
                  '${group['activeMembers']} ${QyAppLocalizationKeys.qyActive.tr(context)}',
                  style: TextStyles.caption.copyWith(
                    color: ThemeColors.textSecondary,
                  ),
                ),
                Spacer(),
                ElevatedButton(
                  onPressed: () {},
                  style: ElevatedButton.styleFrom(
                    backgroundColor: color,
                    padding: EdgeInsets.symmetric(
                      horizontal: Dimensions.paddingMedium,
                      vertical: Dimensions.paddingSmall,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
                    ),
                    minimumSize: const Size(0, 0),
                  ),
                  child: Text(
                    QyAppLocalizationKeys.qyJoin.tr(context),
                    style: TextStyles.caption.copyWith(
                      color: ThemeColors.surface,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.groups_outlined,
            size: 80,
            color: ThemeColors.textTertiary.withOpacity(0.5),
          ),
          SizedBox(height: Dimensions.spacingLarge),
          Text(
            QyAppLocalizationKeys.qyNoGroups.tr(context),
            style: TextStyles.h4.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
          SizedBox(height: Dimensions.spacingMedium),
          Text(
            QyAppLocalizationKeys.qyJoinGroupsToLearn.tr(context),
            style: TextStyles.body2.copyWith(
              color: ThemeColors.textTertiary,
            ),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: Dimensions.spacingLarge),
          ElevatedButton(
            onPressed: () => setState(() => _selectedTab = 'discover'),
            style: ElevatedButton.styleFrom(
              backgroundColor: ThemeColors.primary,
              padding: EdgeInsets.symmetric(
                horizontal: Dimensions.paddingLarge * 2,
                vertical: Dimensions.paddingMedium,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
              ),
            ),
            child: Text(
              QyAppLocalizationKeys.qyDiscoverGroups.tr(context),
              style: TextStyles.button.copyWith(
                color: ThemeColors.surface,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
