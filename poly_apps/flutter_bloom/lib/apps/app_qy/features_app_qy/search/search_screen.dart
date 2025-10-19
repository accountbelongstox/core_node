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
import 'package:qyflutter/apps/app_qy/features_app_qy/home/widget/urgent_fund_rising_widget.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:percent_indicator/linear_percent_indicator.dart';

class SearchScreenView extends StatelessWidget {
  SearchScreenView({super.key});
  final List donationsList = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  @override
  Widget build(BuildContext context) {
    // Using new theme system directly

    return Scaffold(
      appBar: AppBar(title: Text("Search", style: ThemeTextStyles.appNavigation)),
      body: Column(children: [
        const Padding(
            padding: EdgeInsets.symmetric(horizontal: ThemeDimensions.defaultSize),
            child: UrgentFundRisingWidget()),
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
                        suffixIcon: Icon(Icons.search))))),
        donationsList.isEmpty
            ? Center(
                child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                    CircleAvatar(
                        radius: 50,
                        backgroundColor:
                            Theme.of(context).colorScheme.surfaceTint,
                        child: const Icon(Icons.bookmark, color: Colors.white)),
                    const SizedBox(
                      height: ThemeDimensions.sizeFifteen,
                    ),
                    Text("No result found",
                        style: ThemeTextStyles.contentTitle.copyWith(
                            color: Colors.green)),
                  ]))
            : Expanded(
                child: ListView.builder(
                    itemCount: urgentModelList.length,
                    itemBuilder: (_, index) {
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
                                            borderRadius:
                                                const BorderRadius.only(
                                                    topLeft: Radius.circular(
                                                        ThemeDimensions.radiusLarge),
                                                    bottomLeft: Radius.circular(
                                                        ThemeDimensions
                                                            .radiusLarge)),
                                            child: Image(
                                              image: AssetImage(
                                                "${urgentModelList[index].image}",
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
                                            " ${urgentModelList[index].title}",
                                            style: ThemeTextStyles.fundraisingTitle,
                                          ),
                                          const SizedBox(
                                            height: 10,
                                          ),
                                          Row(children: [
                                            Text(
                                                "\$${urgentModelList[index].found}, ",
                                                style: ThemeTextStyles.donationAmount.copyWith(
                                                    fontSize: 16)),
                                            const Text(
                                              "fund reusing from the ",
                                            ),
                                          ]),
                                          Padding(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                      vertical: ThemeDimensions
                                                          .defaultSize),
                                              child: LinearPercentIndicator(
                                                  padding: EdgeInsets.zero,
                                                  barRadius:
                                                      const Radius.circular(10),
                                                  lineHeight: 8.0,
                                                  percent: 0.5,
                                                  progressColor:
                                                      Theme.of(context)
                                                          .colorScheme
                                                          .surfaceTint)),
                                          Row(
                                              mainAxisAlignment:
                                                  MainAxisAlignment
                                                      .spaceBetween,
                                              children: [
                                                Row(children: [
                                                  Text(
                                                    "${urgentModelList[index].donators},",
                                                    style: ThemeTextStyles.fundraisingProgress,
                                                  ),
                                                  const Text("Donations")
                                                ]),
                                                Row(children: [
                                                  Text(
                                                    "${urgentModelList[index].days} ",
                                                    style: ThemeTextStyles.fundraisingProgress,
                                                  ),
                                                  const Text("Days Left"),
                                                ])
                                              ])
                                        ])),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    }))
      ]),
    );
  }
}
