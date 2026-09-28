import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_example/features_app_example/help/model/help_data_model.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';

class AboutUsScreenView extends StatelessWidget {
  const AboutUsScreenView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          "About us",
          style: ThemeTextStyles.appNavigation,
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(ThemeDimensions.defaultSize),
        child: Column(
          children: [
            const SizedBox(height: ThemeDimensions.sizeTwentyFive),
            CircleAvatar(
              radius: ThemeDimensions.circleLarge,
              backgroundColor: Theme.of(context).colorScheme.surfaceTint,
              child: const Icon(
                Icons.emoji_people,
                size: ThemeDimensions.iconSizeDialog,
              ),
            ),
            const SizedBox(
              height: ThemeDimensions.defaultSize,
            ),
            Text(
              "Wecare",
              style: ThemeTextStyles.contentTitle.copyWith(
                  fontSize: ThemeDimensions.fontSizeOverLarge, color: ThemeColors.primaryBrand),
            ),
            const SizedBox(
              height: ThemeDimensions.mediumSize,
            ),
            Text(
              "We Focus on the Digital Charity",
              style: ThemeTextStyles.contentSubtitle.copyWith(fontSize: ThemeDimensions.fontSizeExtraLarge),
            ),
            const SizedBox(
              height: ThemeDimensions.defaultSize,
            ),
            Text(aboutUs, style: ThemeTextStyles.contentBody.copyWith(letterSpacing: 1.3))
          ],
        ),
      ),
    );
  }
}
