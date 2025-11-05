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
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/bookmark/bookmark_screen.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/apps/app_qy/router_app_qy/routes_provider_app_qy.dart';
import 'package:qyflutter/apps/app_qy/localization_app_qy/localization_keys_app_qy.dart';

class LoginedFuncWidget extends StatelessWidget {
  const LoginedFuncWidget({super.key});

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final itemWidth = (screenWidth - ThemeDimensions.paddingSizeDefault * 4) / 3;

    return Container(
      height: 120,
      margin:
          const EdgeInsets.symmetric(vertical: ThemeDimensions.paddingSizeDefault),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            _buildFunctionButton(
              context,
              QyAppLocalizationKeys.qyMyDonations.tr(context),
              Icons.volunteer_activism,
              () => context.push(QyAppRoutesProvider.routeDonation),
            ),
            _buildFunctionButton(
              context,
              QyAppLocalizationKeys.qyMyFundraising.tr(context),
              Icons.campaign,
              () => context.push(QyAppRoutesProvider.routeFundraising),
            ),
            _buildFunctionButton(
              context,
              QyAppLocalizationKeys.qyMyProfile.tr(context),
              Icons.account_circle,
              // Note: routeProfileTwo doesn't exist, using routeProfile instead
              () => context.push(QyAppRoutesProvider.routeProfile),
            ),
            _buildFunctionButton(
              context,
              QyAppLocalizationKeys.qyMyPrayers.tr(context),
              Icons.favorite,
              () => context.push(QyAppRoutesProvider.routePrayer),
            ),
            _buildFunctionButton(
              context,
              QyAppLocalizationKeys.qyBookmarks.tr(context),
              Icons.bookmark,
              () => context.push(QyAppRoutesProvider.routeBookmarks),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFunctionButton(
    BuildContext context,
    String title,
    IconData icon,
    VoidCallback onTap,
  ) {
    return Container(
      width: 100,
      margin:
          const EdgeInsets.symmetric(horizontal: ThemeDimensions.paddingSizeSmall),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusDefault),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
              decoration: BoxDecoration(
                color: Theme.of(context).primaryColor.withAlpha(30),
                borderRadius: BorderRadius.circular(ThemeDimensions.radiusDefault),
              ),
              child: Icon(
                icon,
                color: Theme.of(context).primaryColor,
                size: 24,
              ),
            ),
            const SizedBox(height: ThemeDimensions.paddingSizeSmall),
            Text(
              title,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: ThemeDimensions.fontSizeSmall,
                color: Theme.of(context).textTheme.bodyLarge?.color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
