library;

import 'package:flutter/material.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';

class Image001ScreenRefactoredAppQy extends StatefulWidget {
  const Image001ScreenRefactoredAppQy({super.key});

  @override
  State<Image001ScreenRefactoredAppQy> createState() =>
      _Image001ScreenRefactoredAppQyState();
}

class _Image001ScreenRefactoredAppQyState
    extends State<Image001ScreenRefactoredAppQy> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyAppName.tr(context),
          style: ThemeTextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.pop(context),
          icon: Icon(Icons.arrow_back, color: ThemeColors.textPrimary),
        ),
      ),
      body: SafeArea(
        child: Center(
          child: _buildContent(),
        ),
      ),
    );
  }

  Widget _buildContent() {
    return Container(
      margin: EdgeInsets.all(ThemeDimensions.paddingLarge),
      padding: EdgeInsets.all(ThemeDimensions.paddingXLarge),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.image,
            size: 80,
            color: ThemeColors.primary,
          ),
          SizedBox(height: ThemeDimensions.spacingLarge),
          Text(
            QyAppLocalizationKeys.qyImageView.tr(context),
            style: ThemeTextStyles.h3.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          Text(
            QyAppLocalizationKeys.qyImageViewDesc.tr(context),
            style: ThemeTextStyles.body1.copyWith(
              color: ThemeColors.textSecondary,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
