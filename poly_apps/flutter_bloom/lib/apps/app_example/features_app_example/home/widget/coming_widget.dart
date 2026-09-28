import 'package:flutter/material.dart';
import 'package:qyflutter/common/widgets/custom_image.dart';
import 'package:qyflutter/apps/app_example/features_app_example/home/domain/model/comingto_model.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';

import 'package:percent_indicator/percent_indicator.dart';

class ComingEndWidget extends StatelessWidget {
  final ComingEndModel? comingEndModel;
  const ComingEndWidget({super.key, this.comingEndModel});

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    return Padding(
      padding: const EdgeInsets.fromLTRB(ThemeDimensions.paddingSizeDefault, 5,
          ThemeDimensions.paddingSizeDefault, ThemeDimensions.paddingSizeDefault),
      child: Container(
        padding: const EdgeInsets.all(2),
        width: screenWidth * .75,
        decoration: BoxDecoration(
            color: Theme.of(context).cardColor,
            boxShadow: [
              BoxShadow(
                color: ThemeColors.shadowColor,
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
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
                        height: screenWidth / 3,
                        width: screenWidth,
                        child: const CustomImage(image: ""))),
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
                    Text(comingEndModel?.title ?? '',
                        style: ThemeTextStyles.textMedium.copyWith(
                            fontSize: ThemeDimensions.fontSizeDefault)),
                    const SizedBox(
                      height: ThemeDimensions.paddingSizeSeven,
                    ),
                    Row(
                      children: [
                        Text(
                          comingEndModel?.donat ?? '',
                          style: ThemeTextStyles.textMedium.copyWith(
                              fontSize: ThemeDimensions.fontSizeDefault,
                              color: ThemeColors.green),
                        ),
                        Text("Found reside from ${comingEndModel?.donat}")
                      ],
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(
                          vertical: ThemeDimensions.paddingSizeSeven),
                      child: LinearPercentIndicator(
                        padding: EdgeInsets.zero,
                        barRadius: const Radius.circular(10),
                        lineHeight: 8.0,
                        percent: comingEndModel?.percent ?? 0.0,
                        progressColor:
                            Theme.of(context).colorScheme.surfaceTint,
                      ),
                    ),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.start,
                      children: [
                        Text(
                          comingEndModel?.donat ?? '',
                          style: ThemeTextStyles.donationAmount.copyWith(
                              fontSize: ThemeDimensions.fontSizeDefault),
                        ),
                        const SizedBox(
                          width: ThemeDimensions.defaultSize,
                        ),
                        Text(
                          'Donators',
                          style: ThemeTextStyles.bodyMedium.copyWith(
                              fontSize: ThemeDimensions.fontSizeDefault),
                        ),
                        const SizedBox(
                          width: ThemeDimensions.largeSixtySize,
                        ),
                        Text(
                          comingEndModel?.days ?? '',
                          style: ThemeTextStyles.donationAmount.copyWith(
                              fontSize: ThemeDimensions.fontSizeDefault),
                        ),
                        const SizedBox(
                          width: ThemeDimensions.defaultSize,
                        ),
                        Text(
                          'days left',
                          style: ThemeTextStyles.bodyMedium.copyWith(
                              fontSize: ThemeDimensions.fontSizeDefault),
                        ),
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
