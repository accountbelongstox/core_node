import 'package:flutter/material.dart';
import 'package:qyflutter/common/widgets/outelineborder.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';
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
              splashColor: ColorsAppQy.qyPageBackground.withOpacity(0),
              highlightColor: ColorsAppQy.qyPageBackground.withOpacity(0),
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
