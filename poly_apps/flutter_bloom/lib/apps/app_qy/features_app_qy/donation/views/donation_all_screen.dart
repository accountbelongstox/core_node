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
import 'package:percent_indicator/percent_indicator.dart';
import 'package:qyflutter/common/widgets/outelineborder.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/apps/app_qy/localization_app_qy/localization_keys_app_qy.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/donation/data/donation_data.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/widget/actions_widget.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';

class MyDonationAllScreen extends StatelessWidget {
  const MyDonationAllScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final donations = DonationData.getDonations();
    return Scaffold(
      appBar: AppBar(
        title: Text(
          '${QyAppLocalizationKeys.qyMyDonations.tr(context)} '
          '(${donations.length})',
          style: ThemeTextStyles.textSemiBold.copyWith(
            color: ColorsAppQy.qyTextPrimary,
          ),
        ),
        actions: const [
          ActionWidget(
            actionIcon: Icon(
              Icons.more_vert,
              color: Colors.white,
            ),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(8.0),
        child: ListView.builder(
            itemCount: donations.length,
            itemBuilder: (_, index) {
              final donation = donations[index];
              return Padding(
                padding: const EdgeInsets.symmetric(
                    vertical: ThemeDimensions.defaultSize),
                child: Container(
                    decoration: BoxDecoration(
                        color: Theme.of(context).cardColor,
                        borderRadius:
                            BorderRadius.circular(ThemeDimensions.defaultSize),
                        border: Border.all(
                          width: 3.5,
                          color: ColorsAppQy.qyBorderLight,
                        )),
                    child: Column(children: [
                      Padding(
                          padding: const EdgeInsets.all(8.0),
                          child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Container(
                                    height: ThemeDimensions.sizeOneTwenty,
                                    width: ThemeDimensions.sizeOneTwenty,
                                    decoration: const BoxDecoration(
                                        color: Colors.black12,
                                        borderRadius: BorderRadius.only(
                                            topLeft: Radius.circular(
                                                ThemeDimensions.radiusLarge),
                                            bottomLeft: Radius.circular(
                                                ThemeDimensions.radiusLarge))),
                                    child: ClipRRect(
                                        borderRadius: const BorderRadius.only(
                                            topLeft: Radius.circular(
                                                ThemeDimensions.radiusLarge),
                                            bottomLeft: Radius.circular(
                                                ThemeDimensions.radiusLarge)),
                                        child: Image(
                                            image: AssetImage(
                                              donation.image ?? '',
                                            ),
                                            fit: BoxFit.cover))),
                                const SizedBox(
                                  width: ThemeDimensions.paddingSizeDefault,
                                ),
                                Expanded(
                                    child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      donation.title ?? '',
                                      style: ThemeTextStyles.textBold.copyWith(
                                        color: ColorsAppQy.qyTextPrimary,
                                      ),
                                    ),
                                    const SizedBox(
                                      height: 10,
                                    ),
                                    Row(children: [
                                      Text(
                                        '\$ ${donation.found ?? ''}',
                                        style:
                                            ThemeTextStyles.textBold.copyWith(
                                          color: ColorsAppQy.qyPrimary,
                                        ),
                                      ),
                                      Text(
                                        ' ${QyAppLocalizationKeys.qyDonationFundRaising.tr(context)}',
                                        style: ThemeTextStyles.textMedium
                                            .copyWith(
                                          color: ColorsAppQy.qyTextSecondary,
                                        ),
                                      ),
                                    ]),
                                    Padding(
                                        padding: const EdgeInsets.symmetric(
                                            vertical: ThemeDimensions.defaultSize),
                                        child: LinearPercentIndicator(
                                            padding: EdgeInsets.zero,
                                            barRadius:
                                                const Radius.circular(10),
                                            lineHeight: 8.0,
                                            percent: 0.10,
                                            progressColor: Theme.of(context)
                                                .colorScheme
                                                .surfaceTint)),
                                    Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.spaceBetween,
                                        children: [
                                          Row(children: [
                                            Text(
                                                donation.donators ?? '',
                                                style: ThemeTextStyles.textBold
                                                    .copyWith(
                                                  color: ColorsAppQy.qyPrimary,
                                                ),
                                              ),
                                              Text(
                                                ' ${QyAppLocalizationKeys.qyDonationDonations.tr(context)}',
                                                style: ThemeTextStyles
                                                    .textSemiBold
                                                    .copyWith(
                                                  color:
                                                      ColorsAppQy.qyTextPrimary,
                                                ),
                                              ),
                                          ]),
                                          Row(children: [
                                            Text(
                                                donation.days ?? '',
                                                style: ThemeTextStyles.textBold
                                                    .copyWith(
                                                  color: ColorsAppQy.qyPrimary,
                                                ),
                                            ),
                                              Text(
                                                ' ${QyAppLocalizationKeys.qyDonationDaysLeft.tr(context)}',
                                                style: ThemeTextStyles
                                                    .textSemiBold
                                                    .copyWith(
                                                  color:
                                                      ColorsAppQy.qyTextPrimary,
                                                ),
                                              ),
                                          ])
                                        ]),
                                  ],
                                )),
                              ])),
                      Padding(
                          padding: const EdgeInsets.all(8.0),
                          child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(children: [
                                  Text(
                                    QyAppLocalizationKeys.qyDonationNoDonation
                                        .tr(context),
                                    style: ThemeTextStyles.textBold.copyWith(
                                      color: ColorsAppQy.qyTextSecondary,
                                    ),
                                  ),
                                  Text(
                                    donation.donators ?? '',
                                    style: ThemeTextStyles.textBold.copyWith(
                                      color: ColorsAppQy.qyPrimary,
                                    ),
                                  ),
                                ]),
                                CustomCircular(
                                    radius: ThemeDimensions.radiusBig,
                                    outlineColor: Theme.of(context)
                                        .colorScheme
                                        .surfaceTint,
                                    widget: Padding(
                                        padding: const EdgeInsets.symmetric(
                                            vertical: 5, horizontal: 10),
                                        child: Text(
                                          QyAppLocalizationKeys
                                              .qyDonationMakeNow
                                              .tr(context),
                                          style: ThemeTextStyles.textSemiBold
                                              .copyWith(
                                            color: ColorsAppQy.qyPrimary,
                                          ),
                                        ))),
                              ]))
                    ])),
              );
            }),
      ),
    );
  }
}
