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
import 'package:qyflutter/apps/app_qy/features_app_qy/fundraising/domain/model/my_fundraising_model.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/fundraising/views/create_new_fundraising.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/fundraising/views/fundraising_ditails.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/widget/urgent_fund_rising_widget.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:get/get.dart';
import 'package:percent_indicator/linear_percent_indicator.dart';

class MyFundraisingScreen extends StatelessWidget {
  MyFundraisingScreen({super.key});
  final List donationsList = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  @override
  Widget build(BuildContext context) {

    return Scaffold(
        body: Padding(
          padding: const EdgeInsets.all(ThemeDimensions.defaultSize),
          child: Column(
            children: [
              const UrgentFundRisingWidget(),
              Expanded(
                  child: ListView.builder(
                      itemCount: myFundraisingModelList.length,
                      itemBuilder: (_, index) {
                        return InkWell(
                          onTap: () {
                            Get.to(const FundraisingResultView());
                          },
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                                vertical: ThemeDimensions.defaultSize),
                            child: Container(
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(
                                    ThemeDimensions.defaultSize),
                                border: Border.all(
                                    width: 1.5,
                                    color: Colors.grey.withValues(alpha: 0.2)),
                              ),
                              child: Column(
                                children: [
                                  Padding(
                                    padding: const EdgeInsets.all(8.0),
                                    child: Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.spaceBetween,
                                      children: [
                                        Container(
                                            height: ThemeDimensions.sizeOneTwenty,
                                            width: ThemeDimensions.sizeOneTwenty,
                                            decoration: const BoxDecoration(
                                                color: Colors.grey,
                                                borderRadius: BorderRadius.only(
                                                    topLeft: Radius.circular(
                                                        ThemeDimensions.radiusLarge),
                                                    bottomLeft: Radius.circular(
                                                        ThemeDimensions
                                                            .radiusLarge))),
                                            child: ClipRRect(
                                                borderRadius: const BorderRadius
                                                    .only(
                                                    topLeft: Radius.circular(
                                                        ThemeDimensions.radiusLarge),
                                                    bottomLeft: Radius.circular(
                                                        ThemeDimensions
                                                            .radiusLarge)),
                                                child: Image(
                                                  image: AssetImage(
                                                    "${myFundraisingModelList[index].image}",
                                                  ),
                                                  fit: BoxFit.cover,
                                                ))),
                                        const SizedBox(
                                          width: ThemeDimensions.paddingSizeDefault,
                                        ),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                "${myFundraisingModelList[index].title}",
                                                style: ThemeTextStyles.textBold,
                                              ),
                                              const SizedBox(
                                                height: ThemeDimensions.defaultSize,
                                              ),
                                              Row(
                                                children: [
                                                  Text(
                                                    "\$ ${myFundraisingModelList[index].donators}",
                                                    style: ThemeTextStyles.textBold.copyWith(color: Colors.green),
                                                  ),
                                                  Text(
                                                    " fund raising from the ",
                                                    style: ThemeTextStyles.textMedium,
                                                  ),
                                                ],
                                              ),
                                              Padding(
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                        vertical: ThemeDimensions
                                                            .defaultSize),
                                                child: LinearPercentIndicator(
                                                  padding: EdgeInsets.zero,
                                                  barRadius:
                                                      const Radius.circular(
                                                          ThemeDimensions
                                                              .defaultSize),
                                                  lineHeight: 8.0,
                                                  percent: 0.10,
                                                  progressColor:
                                                      Theme.of(context)
                                                          .colorScheme
                                                          .surfaceTint,
                                                ),
                                              ),
                                              Row(
                                                mainAxisAlignment:
                                                    MainAxisAlignment
                                                        .spaceBetween,
                                                children: [
                                                  Row(
                                                    children: [
                                                      Text(
                                                          "${myFundraisingModelList[index].donators}",
                                                          style:
                                                              ThemeTextStyles.textBold.copyWith(color: Colors.green)),
                                                      Text(
                                                        " Donations",
                                                        style: ThemeTextStyles.textSemiBold,
                                                      ),
                                                    ],
                                                  ),
                                                  Row(
                                                    children: [
                                                      Text(
                                                          "${myFundraisingModelList[index].days}",
                                                          style:
                                                              ThemeTextStyles.mediumtextStyle),
                                                      Text(" days left", style: ThemeTextStyles.textRegular),
                                                    ],
                                                  )
                                                ],
                                              ),
                                            ],
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Padding(
                                    padding: const EdgeInsets.all(8.0),
                                    child: Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.spaceBetween,
                                      children: [
                                        const Row(
                                          children: [
                                            Icon(
                                              Icons.edit,
                                              color: Colors.green,
                                            ),
                                            SizedBox(
                                              width: ThemeDimensions.defaultSize,
                                            ),
                                            Text("Edit"),
                                            SizedBox(
                                              width: ThemeDimensions.sizeTwentyFive,
                                            ),
                                            Icon(
                                              Icons.share,
                                              color: Colors.green,
                                            ),
                                            SizedBox(
                                              width: ThemeDimensions.defaultSize,
                                            ),
                                            Text("Share"),
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
                                                horizontal:
                                                    ThemeDimensions.defaultSize),
                                            child: Text(
                                              "See Result",
                                              style: ThemeTextStyles.mediumtextStyle,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      }))
            ],
          ),
        ),
        floatingActionButton: Padding(
          padding: const EdgeInsets.only(bottom: ThemeDimensions.rewardImageSize),
          child: FloatingActionButton(
            onPressed: () {
              Get.to(const CreateNewFundraisingScreen());
            },
            backgroundColor: Theme.of(context).colorScheme.surfaceTint,
            child: const Icon(
              Icons.add,
              color: Colors.white,
            ),
            // ,
          ),
        ));
  }
}
