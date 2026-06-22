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
import 'package:qyflutter/apps/app_example/features_app_example/common_widgets/home_widget/top_section.dart';
import 'package:qyflutter/apps/app_example/features_app_example/profile_two/widget/interest_widget.dart';
import 'package:qyflutter/apps/app_example/features_app_example/profile_two/widget/top_card_widget.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/assets/common_assets_icons.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/common/constants/app_constants.dart';
import 'package:qyflutter/common/utils/image/image_loader.dart';
import 'package:qyflutter/common/provider_status/user_provider.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/apps/app_example/router_app_example/routes_provider_app_example.dart';

class ProfileTwoScreen extends StatelessWidget {
  const ProfileTwoScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final userProvider = context.watch<BaseUserProvider>();

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'profile'.tr(context),
          style: ThemeTextStyles.textMedium,
        ),
        leading: IconButton(
          icon: Icon(
            Icons.arrow_back_ios,
            color: Theme.of(context).colorScheme.onSurface,
          ),
          onPressed: () => context.pop(),
        ),
        actions: [
          Padding(
              padding: const EdgeInsets.all(8.0),
              child: IconButton(
                  icon: const Icon(Icons.more_vert),
                  onPressed: () {
                    // Note: routeSettingView doesn't exist, using routeSettings instead
                    context.push(ExampleAppRoutesProvider.routeSettings);
                  }))
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: ThemeDimensions.defaultSize),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            ImageLoader.buildAvatarImage(
              imageUrl: userProvider.user?.avatar,
              baseUrl: AppConstants.appExampleUserBaseUrl,
              size: ThemeDimensions.radiusBig * 2,
              defaultImage: CommonAssetsIcons.profileIcon,
            ),
            Padding(
              padding:
                  const EdgeInsets.symmetric(vertical: ThemeDimensions.sizeTwenty),
              child: Text(
                userProvider.user?.name ?? 'Adam Smith',
                style: ThemeTextStyles.textBold.copyWith(fontSize: ThemeDimensions.fontSizeDefault),
              ),
            ),
            const Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                FollowerCardWidget(
                  followers: '67.5K',
                ),
                FollowerCardWidget(
                  followers: '80.5K',
                ),
                FollowerCardWidget(
                  followers: '93.5K',
                ),
              ],
            ),
            const SizedBox(
              height: ThemeDimensions.defaultSize,
            ),
            TopSection(
              onTap: () {
                // Note: routeWalletCenter doesn't exist, using routeProfile as placeholder
                context.push(ExampleAppRoutesProvider.routeProfile);
              },
            ),
            const SizedBox(
              height: ThemeDimensions.defaultSize,
            ),
            Align(
                alignment: Alignment.topLeft,
                child: Text('about'.tr(context),
                    style: ThemeTextStyles.textBold.copyWith(
                        fontSize: ThemeDimensions.fontSizeDefault))),
            const SizedBox(
              height: ThemeDimensions.defaultSize,
            ),
            Text(
              'about_description'.tr(context),
              style: ThemeTextStyles.textMedium,
            ),
            const SizedBox(
              height: ThemeDimensions.defaultSize,
            ),
            Row(
              children: [
                Text('interest'.tr(context),
                    style: ThemeTextStyles.textBold.copyWith(
                        fontSize: ThemeDimensions.fontSizeDefault)),
                const SizedBox(width: ThemeDimensions.defaultSize),
                const Icon(
                  Icons.edit,
                  color: Colors.green,
                )
              ],
            ),
            Padding(
              padding:
                  const EdgeInsets.symmetric(vertical: ThemeDimensions.defaultSize),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  InterestWidget(interest: 'medical'.tr(context)),
                  InterestWidget(interest: 'disaster'.tr(context)),
                  InterestWidget(interest: 'education'.tr(context)),
                  InterestWidget(interest: 'social.title'.tr(context)),
                ],
              ),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                InterestWidget(interest: 'orphanage'.tr(context)),
                InterestWidget(interest: 'humanity'.tr(context)),
                InterestWidget(interest: 'environment'.tr(context)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
