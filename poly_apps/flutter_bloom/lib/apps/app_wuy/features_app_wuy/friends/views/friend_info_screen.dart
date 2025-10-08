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
import '../../../router_app_wuy/router_app_wuy.dart';

class WuyFriendInfoScreen extends StatefulWidget {
  final String friendId;
  
  const WuyFriendInfoScreen({
    super.key,
    required this.friendId,
  });

  @override
  State<WuyFriendInfoScreen> createState() => _WuyFriendInfoScreenState();
}

class _WuyFriendInfoScreenState extends State<WuyFriendInfoScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.lightBackground,
      appBar: AppBar(
        title: Text(
          'Friend Info',
          style: ThemeTextStyles.displayMedium,
        ),
        backgroundColor: ThemeColors.primary,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => context.go(WuyAppRouter.routeFriends),
        ),
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            _buildHeaderSection(),
            _buildHealthSection(),
            _buildLocationsSection(),
            _buildAchievementsSection(),
            _buildActionsSection(),
          ],
        ),
      ),
    );
  }

  Widget _buildHeaderSection() {
    return Container(
      width: double.infinity,
      height: 300,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Colors.blue.shade400,
            Colors.blue.shade600,
          ],
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            top: 50,
            left: 0,
            right: 0,
            child: Column(
              children: [
                CircleAvatar(
                  radius: 60,
                  backgroundColor: Colors.white.withOpacity(0.2),
                  child: Icon(
                    Icons.person,
                    size: 60,
                    color: Colors.white,
                  ),
                ),
                SizedBox(height: ThemeDimensions.spacingMedium),
                Text(
                  '小飞侠',
                  style: ThemeTextStyles.title2.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  '守护的未来',
                  style: ThemeTextStyles.bodyLarge.copyWith(
                    color: Colors.white.withOpacity(0.9),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHealthSection() {
    return Container(
      margin: EdgeInsets.all(ThemeDimensions.defaultPadding),
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 10,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'TA的健康',
              style: ThemeTextStyles.title3,
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildHealthItem(Icons.directions_walk, 'Steps', '8,432'),
              _buildHealthItem(Icons.thermostat, 'Temperature', '36.5°C'),
              _buildHealthItem(Icons.favorite, 'Heart Rate', '72'),
              _buildHealthItem(Icons.local_fire_department, 'Calories', '245'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildHealthItem(IconData icon, String label, String value) {
    return Column(
      children: [
        Icon(icon, color: ThemeColors.primary, size: 30),
        SizedBox(height: ThemeDimensions.spacingSmall),
        Text(
          value,
          style: ThemeTextStyles.bodyLarge.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        Text(
          label,
          style: ThemeTextStyles.bodySmall.copyWith(
            color: ThemeColors.textSecondary,
          ),
        ),
      ],
    );
  }

  Widget _buildLocationsSection() {
    return Container(
      margin: EdgeInsets.symmetric(horizontal: ThemeDimensions.defaultPadding),
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 10,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'TA今天去过的地方',
              style: ThemeTextStyles.title3,
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          Row(
            children: [
              Icon(Icons.grid_view, color: ThemeColors.primary),
              SizedBox(width: ThemeDimensions.spacingSmall),
              Text(
                '2020-04-20 20:00',
                style: ThemeTextStyles.bodyMedium,
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacingSmall),
          Row(
            children: [
              Icon(Icons.grid_view, color: ThemeColors.primary),
              SizedBox(width: ThemeDimensions.spacingSmall),
              Text(
                '2020-04-20 18:30',
                style: ThemeTextStyles.bodyMedium,
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacingSmall),
          Row(
            children: [
              Icon(Icons.grid_view, color: ThemeColors.primary),
              SizedBox(width: ThemeDimensions.spacingSmall),
              Text(
                '2020-04-20 15:15',
                style: ThemeTextStyles.bodyMedium,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAchievementsSection() {
    return Container(
      margin: EdgeInsets.all(ThemeDimensions.defaultPadding),
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 10,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'TA今天的成就',
              style: ThemeTextStyles.title3,
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          _buildAchievementItem('跑步公里', '5.2 km'),
          _buildAchievementItem('步数', '8,432'),
          _buildAchievementItem('卡路里', '245 cal'),
          _buildAchievementItem('睡眠', '7.5 hours'),
        ],
      ),
    );
  }

  Widget _buildAchievementItem(String label, String value) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: ThemeDimensions.spacingSmall),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: ThemeTextStyles.bodyMedium,
          ),
          Text(
            value,
            style: ThemeTextStyles.bodyMedium.copyWith(
              fontWeight: FontWeight.bold,
              color: ThemeColors.primary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionsSection() {
    return Container(
      margin: EdgeInsets.all(ThemeDimensions.defaultPadding),
      child: Row(
        children: [
          Expanded(
            child: ElevatedButton.icon(
              onPressed: () {
                context.go('/wuy/history-tracks');
              },
              icon: Icon(Icons.history),
              label: Text('History Tracks'),
              style: ElevatedButton.styleFrom(
                backgroundColor: ThemeColors.primary,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
                ),
              ),
            ),
          ),
          SizedBox(width: ThemeDimensions.spacingMedium),
          Expanded(
            child: ElevatedButton.icon(
              onPressed: () {
                context.go('/wuy/network-records');
              },
              icon: Icon(Icons.network_check),
              label: Text('Network Records'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.green,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
