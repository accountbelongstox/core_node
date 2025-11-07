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
import 'package:qyflutter/apps/app_qy/features_app_qy/home/domain/model/fund_rising_model.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_shadow.dart';
import 'package:percent_indicator/percent_indicator.dart';

class FundRisingWidget extends StatelessWidget {
  final FundRisingModel? fundRisingModel;
  const FundRisingWidget({super.key, this.fundRisingModel});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(ThemeDimensions.paddingSizeDefault, 5,
          ThemeDimensions.paddingSizeDefault, ThemeDimensions.paddingSizeDefault),
      child: Container(
        padding: const EdgeInsets.all(2),
        width: MediaQuery.of(context).size.width * .75,
        decoration: BoxDecoration(
            color: Theme.of(context).cardColor,
            boxShadow: ThemeShadow.getShadow(context),
            borderRadius: BorderRadius.circular(ThemeDimensions.paddingSizeSmall)),
        child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.all(ThemeDimensions.paddingSizeSmall),
                child: ClipRRect(
                    borderRadius:
                        BorderRadius.circular(ThemeDimensions.paddingSizeSmall),
                    child: SizedBox(
                        height: ThemeDimensions.screenThirdWidth,
                        width: ThemeDimensions.seventyFivePercentWidth,
                        child: Image.asset(
                          fundRisingModel?.thumbnail ?? '',
                          fit: BoxFit.cover,
                        ))),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(
                    ThemeDimensions.paddingSizeDefault,
                    0,
                    ThemeDimensions.paddingSizeDefault,
                    ThemeDimensions.paddingSizeDefault),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(fundRisingModel?.title ?? '',
                        style: ThemeTextStyles.textMedium.copyWith(
                            fontSize: ThemeDimensions.fontSizeDefault),
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 2),
                    Padding(
                      padding: const EdgeInsets.symmetric(
                          vertical: ThemeDimensions.defaultSize),
                      child: LinearPercentIndicator(
                        barRadius: const Radius.circular(10),
                        lineHeight: 8.0,
                        percent: 0.10,
                        progressColor:
                            Theme.of(context).colorScheme.surfaceTint,
                      ),
                    ),
                    const SizedBox(height: ThemeDimensions.paddingSizeSmall),
                    Row(
                      children: [
                        Expanded(
                            child: Text(
                          fundRisingModel?.details ?? '',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        )),
                        const SizedBox(width: ThemeDimensions.paddingSizeSmall),
                      ],
                    )
                  ],
                ),
              ),
            ]),
      ),
    );
  }
}
