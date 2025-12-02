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
import 'package:qyflutter/apps/app_qy/features_app_qy/home/domain/model/prayer_model.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';

class PrayerWidget extends StatelessWidget {
  final PrayerModel? prayerModel;
  const PrayerWidget({super.key, this.prayerModel});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(ThemeDimensions.paddingSizeDefault, 5,
          ThemeDimensions.paddingSizeDefault, ThemeDimensions.paddingSizeDefault),
      child: Container(
        width: MediaQuery.of(context).size.width * .75,
        decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(ThemeDimensions.defaultSize),
            border: Border.all(
                color: Theme.of(context).hintColor.withOpacity(0.5),
                width: 0.5)),
        child: Padding(
          padding: const EdgeInsets.all(ThemeDimensions.defaultSize),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.start,
              children: [
                CircleAvatar(
                  radius: ThemeDimensions.sizeTwentyFive,
                  backgroundImage: AssetImage(prayerModel?.userImage ?? ''),
                ),
                const SizedBox(
                  width: ThemeDimensions.defaultSize,
                ),
                Expanded(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            prayerModel?.name ?? '',
                            style: ThemeTextStyles.prayerTitle.copyWith(
                                fontSize: 18, color: ColorsAppQy.qyTextPrimary),
                          ),
                          Text(
                            "Today",
                            style: ThemeTextStyles.contentDetail,
                          ),
                        ],
                      ),
                      Icon(
                        Icons.more_vert,
                        color: ColorsAppQy.qySuccess,
                      ),
                    ],
                  ),
                )
              ],
            ),
            Divider(
              color: Theme.of(context).highlightColor,
            ),
            Padding(
              padding:
                  const EdgeInsets.symmetric(vertical: ThemeDimensions.defaultSize),
              child: Text(
                prayerModel?.prayer ?? '',
                style: ThemeTextStyles.prayerContent,
              ),
            ),
            const Spacer(),
            Row(
              mainAxisAlignment: MainAxisAlignment.start,
              children: [
                Icon(
                  Icons.favorite_border,
                  color: ColorsAppQy.qyError,
                ),
                const SizedBox(
                  width: ThemeDimensions.defaultSize,
                ),
                const Text("Aamiin"),
                const SizedBox(width: ThemeDimensions.sizeTwenty),
                Icon(
                  Icons.share,
                  color: ColorsAppQy.qySuccess,
                ),
                SizedBox(
                  width: ThemeDimensions.defaultSize,
                ),
                Text("Share"),
              ],
            )
          ]),
        ),
      ),
    );
  }
}
