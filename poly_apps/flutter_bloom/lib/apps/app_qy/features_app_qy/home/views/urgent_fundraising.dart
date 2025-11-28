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
import 'package:qyflutter/apps/app_qy/features_app_qy/home/domain/model/urgetnt_fundrasing_model.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/data/urgent_funding_data.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/widget/actions_widget.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/widget/urgent_fund_rising_widget.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:percent_indicator/linear_percent_indicator.dart';

class UrgentFundraisingScreenView extends StatelessWidget {
  const UrgentFundraisingScreenView({super.key});

  @override
  Widget build(BuildContext context) {
    final urgentFundings = UrgentFundingData.getMockUrgentFundings();
    return Scaffold(
      appBar: AppBar(
        forceMaterialTransparency: true,
        title: Text(
          "Urgent Fundraising (${urgentFundings.length}) ",
          style: ThemeTextStyles.textSemiBold,
        ),
        actions: const [
          ActionWidget(
              actionIcon: Icon(
            Icons.more_vert,
            color: Colors.white,
          ))
        ],
      ),
      body: Column(
        children: [
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: ThemeDimensions.defaultSize),
            child: UrgentFundRisingWidget(),
          ),
          Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: ThemeDimensions.defaultSize),
            child: Container(
              decoration: BoxDecoration(
                  color: Theme.of(context).hintColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(ThemeDimensions.radiusBig)),
              child: const TextField(
                decoration: InputDecoration(
                    contentPadding: EdgeInsets.symmetric(
                        vertical: ThemeDimensions.defaultSize,
                        horizontal: ThemeDimensions.defaultSize),
                    border: OutlineInputBorder(
                      borderSide: BorderSide.none,
                      borderRadius: BorderRadius.all(Radius.circular(50)),
                    ),
                    hintText: 'Search',
                    suffixIcon: Icon(Icons.search)),
              ),
            ),
          ),
          Expanded(
              child: ListView.builder(
                  itemCount: urgentFundings.length,
                  itemBuilder: (_, index) {
                    final item = urgentFundings[index];
                    return Padding(
                      padding: const EdgeInsets.all(8.0),
                      child: Container(
                        decoration: BoxDecoration(
                            borderRadius:
                                BorderRadius.circular(ThemeDimensions.defaultSize),
                            border: Border.all(
                                width: 1.5,
                                color: Colors.grey.withOpacity(0.3))),
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
                                                  ThemeDimensions.radiusLarge))),
                                      child: ClipRRect(
                                          borderRadius: const BorderRadius.only(
                                              topLeft: Radius.circular(
                                                  ThemeDimensions.radiusLarge),
                                              bottomLeft: Radius.circular(
                                                  ThemeDimensions.radiusLarge)),
                                          child: Image(
                                            image: AssetImage(
                                              "${item.image}",
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
                                          " ${item.title}",
                                          style: ThemeTextStyles.textBold,
                                        ),
                                        const SizedBox(
                                          height: 10,
                                        ),
                                        Text(
                                          "\$ ${item.found},fund reusing from the ",
                                          style: ThemeTextStyles.textMedium,
                                        ),
                                        Padding(
                                          padding: const EdgeInsets.symmetric(
                                              vertical: ThemeDimensions.defaultSize),
                                          child: LinearPercentIndicator(
                                            padding: EdgeInsets.zero,
                                            barRadius:
                                                const Radius.circular(10),
                                            lineHeight: 8.0,
                                            percent: 0.5,
                                            progressColor: Theme.of(context)
                                                .colorScheme
                                                .surfaceTint,
                                          ),
                                        ),
                                        Row(
                                          mainAxisAlignment:
                                              MainAxisAlignment.spaceBetween,
                                          children: [
                                            Text(
                                                "  ${item.donators} Donations"),
                                            Text(
                                                " ${item.days} Days Left"),
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
                      ),
                    );
                  }))
        ],
      ),
    );
  }
}
