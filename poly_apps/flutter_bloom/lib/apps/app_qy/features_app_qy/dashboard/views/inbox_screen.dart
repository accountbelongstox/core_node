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

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/inbox/data/inbox_dashboard_data.dart';
import 'package:qyflutter/apps/app_qy/router_app_qy/routes_provider_app_qy.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/widgets/cards/premium_cards.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/apps/app_qy/localization_app_qy/localization_keys_app_qy.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';

class InBoxScreenView extends StatelessWidget {
  const InBoxScreenView({super.key});

  @override
  Widget build(BuildContext context) {
    final inboxUsers = InboxDashboardData.getInboxUsers();

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: ColorsAppQy.qyHolographicGradient,
        ),
        child: SafeArea(
          child: Column(
            children: [
              AppBar(
                forceMaterialTransparency: true,
                title: Text(
                  QyAppLocalizationKeys.qyMessageCenter.tr(context),
                  style: ThemeTextStyles.appNavigation.copyWith(
                    color: ColorsAppQy.qyTextPrimary,
                  ),
                ),
                backgroundColor:
                    ColorsAppQy.qyHolographicWhite.withOpacity(0.8),
              ),
              Padding(
                padding: EdgeInsets.all(ThemeDimensions.defaultSize),
                child: GlassCard(
                  borderRadius: ThemeDimensions.borderRadiusL,
                  padding: EdgeInsets.zero,
                  child: TextField(
                    decoration: InputDecoration(
                      contentPadding: EdgeInsets.symmetric(
                        vertical: ThemeDimensions.defaultSize,
                        horizontal: ThemeDimensions.defaultSize,
                      ),
                      border: OutlineInputBorder(
                        borderSide: BorderSide.none,
                        borderRadius: BorderRadius.all(
                          Radius.circular(ThemeDimensions.radiusBig),
                        ),
                      ),
                      hintText: QyAppLocalizationKeys.qySearch.tr(context),
                      hintStyle: ThemeTextStyles.bodyMedium.copyWith(
                        color: ColorsAppQy.qyTextSecondary,
                      ),
                      suffixIcon: Icon(
                        Icons.search,
                        color: ColorsAppQy.qyTextSecondary,
                      ),
                    ),
                  ),
                ),
              ),
              Expanded(
                child: ListView.builder(
                  padding: EdgeInsets.symmetric(
                    horizontal: ThemeDimensions.defaultSize,
                  ),
                  itemCount: inboxUsers.length,
                  itemBuilder: (_, index) {
                    final user = inboxUsers[index];
                    return GlassCard(
                      borderRadius: ThemeDimensions.borderRadiusM,
                      margin: EdgeInsets.only(
                        bottom: ThemeDimensions.spacing8,
                      ),
                      padding: EdgeInsets.all(ThemeDimensions.spacing12),
                      onTap: () {
                        Navigator.pushNamed(
                            context, QyAppRoutesProvider.routeMessageCenter);
                      },
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: ThemeDimensions.sizeTwentyFive,
                            backgroundColor: ColorsAppQy.qyBorderLight,
                            backgroundImage: AssetImage(user.userImage),
                          ),
                          SizedBox(width: ThemeDimensions.defaultSize),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  user.userNameKey.tr(context),
                                  style: ThemeTextStyles.textBold.copyWith(
                                    color: ColorsAppQy.qyTextPrimary,
                                  ),
                                ),
                                SizedBox(
                                  height: ThemeDimensions.paddingSizeExtraSmall,
                                ),
                                Text(
                                  user.messageKey.tr(context),
                                  style: ThemeTextStyles.textMedium.copyWith(
                                    color: ColorsAppQy.qyTextSecondary,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                          Text(
                            user.dateTimeKey.tr(context),
                            style: ThemeTextStyles.textMedium.copyWith(
                              color: ColorsAppQy.qyTextTertiary,
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
