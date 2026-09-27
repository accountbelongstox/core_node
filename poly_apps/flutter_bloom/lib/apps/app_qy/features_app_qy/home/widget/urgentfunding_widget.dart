import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/domain/model/urgetnt_fundrasing_model.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_constants.dart';
import 'package:percent_indicator/percent_indicator.dart';
import '../../../../resources_app_qy/colors_app_qy.dart';

class UrgentFundraisingScreen extends StatelessWidget {
  final UrgentFundingModel? urgentFundingModel;
  const UrgentFundraisingScreen({super.key, this.urgentFundingModel});

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
            boxShadow: ThemeConstants.getShadow('medium'),
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
                          urgentFundingModel?.image ?? '',
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
                    Text(
                      urgentFundingModel?.title ?? '',
                      style: ThemeTextStyles.textMedium.copyWith(
                          fontSize: ThemeDimensions.fontSizeDefault),
                    ),
                    const SizedBox(
                      height: ThemeDimensions.paddingSizeSeven,
                    ),
                    Row(
                      children: [
                        Text(
                          urgentFundingModel?.donators ?? '',
                          style: ThemeTextStyles.textMedium.copyWith(
                              fontSize: ThemeDimensions.fontSizeDefault,
                              color: ColorsAppQy.qySuccess),
                        ),
                        Text(
                            "Found reside from ${urgentFundingModel?.donators}")
                      ],
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(
                          vertical: ThemeDimensions.paddingSizeSeven),
                      child: LinearPercentIndicator(
                        padding: EdgeInsets.zero,
                        barRadius:
                            const Radius.circular(ThemeDimensions.defaultSize),
                        lineHeight: 8.0,
                        percent: 0.10,
                        progressColor:
                            Theme.of(context).colorScheme.surfaceTint,
                      ),
                    ),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.start,
                      children: [
                        Text(urgentFundingModel?.donators ?? '',
                            style: ThemeTextStyles.donationAmount.copyWith(fontSize: 16)),
                        const SizedBox(
                          width: ThemeDimensions.defaultSize,
                        ),
                        Text(
                          'Donators',
                          style: ThemeTextStyles.fundraisingProgress.copyWith(
                              fontSize: ThemeDimensions.fontSizeDefault),
                        ),
                        const SizedBox(
                          width: ThemeDimensions.largeSixtySize,
                        ),
                        Text(urgentFundingModel?.days ?? '',
                            style: ThemeTextStyles.donationAmount.copyWith(fontSize: 16)),
                        const SizedBox(
                          width: ThemeDimensions.defaultSize,
                        ),
                        Text(
                          'days left',
                          style: ThemeTextStyles.fundraisingProgress.copyWith(
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
