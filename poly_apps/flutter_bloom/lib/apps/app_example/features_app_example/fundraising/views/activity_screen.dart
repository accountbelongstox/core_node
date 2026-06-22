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
import 'package:qyflutter/apps/app_example/features_app_example/fundraising/domain/model/activity_model.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class ActivityScreen extends StatelessWidget {
  const ActivityScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Padding(
        padding: const EdgeInsets.all(8.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Today May -2025, Sunday',
                              style: ThemeTextStyles.textMedium,
            ),
            Expanded(
              child: ListView.builder(
                  itemCount: activityList.length,
                  itemBuilder: (_, index) {
                    return Padding(
                      padding: const EdgeInsets.symmetric(
                          vertical: ThemeDimensions.paddingSizeExtraSmall),
                      child: Container(
                        decoration: BoxDecoration(
                            borderRadius:
                                BorderRadius.circular(ThemeDimensions.defaultSize),
                            border: Border.all(
                                width: 1.5,
                                color: Colors.grey.withOpacity(0.1))),
                        child: Padding(
                          padding: const EdgeInsets.all(8.0),
                          child: Row(
                            children: [
                              CircleAvatar(
                                radius: ThemeDimensions.sizeTwentyFive,
                                backgroundColor: Colors.grey,
                                backgroundImage: AssetImage(
                                  activityList[index].userImage,
                                ),
                              ),
                              const SizedBox(
                                width: ThemeDimensions.defaultSize,
                              ),
                              Expanded(
                                child: Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          activityList[index].userName,
                                          style: ThemeTextStyles.textSemiBold,
                                        ),
                                        const SizedBox(
                                          height: ThemeDimensions.paddingSizeSeven,
                                        ),
                                        Row(
                                          children: [
                                            const Text("has donated"),
                                            const SizedBox(
                                                width: ThemeDimensions.paddingSize),
                                            Text(
                                              "\$${activityList[index].donated} ",
                                              style: ThemeTextStyles.textSemiBold.copyWith(
                                                color: Colors.green,
                                              ),
                                            )
                                          ],
                                        ),
                                      ],
                                    ),
                                    CustomCircular(
                                      radius: ThemeDimensions.radiusBig,
                                      outlineColor: Theme.of(context)
                                          .colorScheme
                                          .surfaceTint,
                                      widget: Padding(
                                        padding: const EdgeInsets.symmetric(
                                            vertical: ThemeDimensions
                                                .paddingSizeExtraSmall,
                                            horizontal: ThemeDimensions.defaultSize),
                                        child: Text(
                                          'Say Thanks',
                                          style: ThemeTextStyles.textMedium.copyWith(
                                            color: Colors.green,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              )
                            ],
                          ),
                        ),
                      ),
                    );
                  }),
            ),
          ],
        ),
      ),
      floatingActionButton: Padding(
        padding:
            const EdgeInsets.only(bottom: ThemeDimensions.orderStatusIconHeight),
        child: FloatingActionButton(
          backgroundColor: Theme.of(context).colorScheme.surfaceTint,
          onPressed: () {},
          child: const Icon(
            Icons.add,
            color: Colors.white,
          ),
        ),
      ),
    );
  }
}
