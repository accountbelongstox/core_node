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
import 'package:qyflutter/common/widgets/outelineborder.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/apps/app_qy/localization_app_qy/localization_keys_app_qy.dart';

class TopSection extends StatelessWidget {
  final Function()? onTap;
  const TopSection({super.key, this.onTap});

  @override
  Widget build(BuildContext context) {
    return OuteLineBorder(
      outlineColor: Theme.of(context).hintColor,
      height: ThemeDimensions.sizeEighty,
      widget: Padding(
        padding: const EdgeInsets.symmetric(horizontal: ThemeDimensions.defaultSize),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Row(
              children: [
                CircleAvatar(
                  backgroundColor: Theme.of(context).colorScheme.primary,
                  radius: ThemeDimensions.sizeTwentyFive,
                  child: Icon(
                    Icons.person,
                    color: Theme.of(context).colorScheme.surfaceTint,
                  ),
                ),
                const SizedBox(
                  width: ThemeDimensions.sizeTwenty,
                ),
                const Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [Text("346"), Text(".........")],
                )
              ],
            ),
            InkWell(
              onTap: onTap,
              splashColor: ThemeColors.transparent,
              highlightColor: ThemeColors.transparent,
              child: Container(
                  decoration: BoxDecoration(
                    border: Border.all(
                      width: 1.5,
                      color: Theme.of(context).colorScheme.surfaceTint,
                    ),
                    borderRadius: BorderRadius.circular(ThemeDimensions.radiusBig),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: ThemeDimensions.mediumSize,
                        vertical: ThemeDimensions.paddingSizeSeven),
                    child: Text(QyAppLocalizationKeys.qyTopUp.tr(context),
                        style: ThemeTextStyles.textSemiBold.copyWith(
                          color: Theme.of(context).colorScheme.surfaceTint,
                        )),
                  )),
            ),
          ],
        ),
      ),
    );
  }
}
