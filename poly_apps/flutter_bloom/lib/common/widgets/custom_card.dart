// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';

import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:percent_indicator/percent_indicator.dart';

class CustomCardWidget extends StatelessWidget {
  final String title;
  final String image;
  final String donation;
  final String days;
  final String found;
  const CustomCardWidget(
      {super.key,
      required this.title,
      required this.found,
      required this.donation,
      required this.days,
      required this.image});

  @override
  Widget build(BuildContext context) {
    ThemeDimensions.refresh(context);
    return Container(
      decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(ThemeDimensions.defaultSize),
          border: Border.all(width: 1.5, color: Colors.grey.withOpacity(0.3))),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                    height: ThemeDimensions.sizeOneTwenty,
                    width: ThemeDimensions.sizeOneTwenty,
                    decoration: const BoxDecoration(
                        color: Colors.grey,
                        borderRadius: BorderRadius.only(
                            topLeft: Radius.circular(ThemeDimensions.radiusLarge),
                            bottomLeft:
                                Radius.circular(ThemeDimensions.radiusLarge))),
                    child: ClipRRect(
                        borderRadius: const BorderRadius.only(
                            topLeft: Radius.circular(ThemeDimensions.radiusLarge),
                            bottomLeft:
                                Radius.circular(ThemeDimensions.radiusLarge)),
                        child: Image(
                          image: AssetImage(image),
                          fit: BoxFit.cover,
                        ))),
                const SizedBox(
                  width: ThemeDimensions.paddingSizeDefault,
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: ThemeTextStyles.textBold,
                      ),
                      const SizedBox(
                        height: ThemeDimensions.defaultSize,
                      ),
                      Row(
                        children: [
                          Text(
                            found,
                            style: ThemeTextStyles.mediumtextStyle,
                          ),
                          const Text(
                            " fund reusing from the ",
                            style: ThemeTextStyles.textMedium,
                          ),
                        ],
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(
                            vertical: ThemeDimensions.paddingSizeExtraSmall),
                        child: LinearPercentIndicator(
                          padding: EdgeInsets.zero,
                          barRadius: const Radius.circular(10),
                          lineHeight: 8.0,
                          percent: 0.5,
                          progressColor:
                              Theme.of(context).colorScheme.surfaceTint,
                        ),
                      ),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Text(
                                donation,
                                style: ThemeTextStyles.mediumtextStyle,
                              ),
                              Text(
                                " Donations",
                                style: ThemeTextStyles.textMedium,
                              ),
                            ],
                          ),
                          Row(
                            children: [
                              Text(
                                days,
                                style: ThemeTextStyles.mediumtextStyle,
                              ),
                              Text(
                                " Days Left",
                                style: ThemeTextStyles.textMedium,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
