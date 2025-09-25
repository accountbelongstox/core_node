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

class WuyHomeScreen extends StatelessWidget {
  const WuyHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.lightBackground,
      appBar: AppBar(
        title: Text(
          'Wuy Home',
          style: ThemeTextStyles.headline3,
        ),
        backgroundColor: ThemeColors.primaryColor,
        elevation: 0,
      ),
      body: Padding(
        padding: EdgeInsets.all(ThemeDimensions.spacing16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Welcome to Wuy App',
              style: ThemeTextStyles.headline2,
            ),
            SizedBox(height: ThemeDimensions.spacing16),
            Text(
              'This is the home screen of Wuy application',
              style: ThemeTextStyles.bodyText1,
            ),
            SizedBox(height: ThemeDimensions.spacing24),
            _buildFeatureCard(
              context,
              'Profile',
              'View and edit your profile',
              Icons.person,
              () => Navigator.pushNamed(context, '/wuy/profile'),
            ),
            SizedBox(height: ThemeDimensions.spacing16),
            _buildFeatureCard(
              context,
              'Settings',
              'Configure app settings',
              Icons.settings,
              () => Navigator.pushNamed(context, '/wuy/settings'),
            ),
            SizedBox(height: ThemeDimensions.spacing16),
            _buildFeatureCard(
              context,
              'Dashboard',
              'View your dashboard',
              Icons.dashboard,
              () => Navigator.pushNamed(context, '/wuy/dashboard'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFeatureCard(
    BuildContext context,
    String title,
    String subtitle,
    IconData icon,
    VoidCallback onTap,
  ) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ThemeDimensions.borderRadius),
      ),
      child: ListTile(
        leading: Icon(
          icon,
          color: ThemeColors.primaryColor,
          size: 32,
        ),
        title: Text(
          title,
          style: ThemeTextStyles.headline6,
        ),
        subtitle: Text(
          subtitle,
          style: ThemeTextStyles.bodyText2,
        ),
        trailing: Icon(
          Icons.arrow_forward_ios,
          color: ThemeColors.greyColor,
        ),
        onTap: onTap,
      ),
    );
  }
}