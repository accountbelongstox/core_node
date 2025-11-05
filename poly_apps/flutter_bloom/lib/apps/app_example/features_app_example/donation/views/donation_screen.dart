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
import 'package:qyflutter/common/widgets/custom_app_bar.dart';
import 'package:qyflutter/common/widgets/custom_button.dart';
import 'package:qyflutter/common/widgets/outelineborder.dart';
import 'package:qyflutter/apps/app_example/features_app_example/donation/domain/model/doantion_model.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:get/get.dart';
import 'package:percent_indicator/linear_percent_indicator.dart';
import 'package:table_calendar/table_calendar.dart';
import 'package:qyflutter/common/widgets/enhanced_bottom_navigation.dart';
// AI: Claude Code - Replaced app-specific HomeBottomNavigationBar with common EnhancedBottomNavigation
import 'package:qyflutter/apps/app_example/router_app_example/routes_provider_app_example.dart';

class DonationScreenView extends StatelessWidget {
  const DonationScreenView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        appBar: const CustomAppBar(
          regularAppbar: true,
          title: "My Donation",
        ),
        body: Padding(
          padding:
              const EdgeInsets.symmetric(horizontal: ThemeDimensions.defaultSize),
          child: Column(
            children: [
              Container(
                decoration: BoxDecoration(
                  color: Theme.of(context).hintColor.withOpacity(0.1),
                  borderRadius: const BorderRadius.all(Radius.circular(10)),
                ),
                child: TableCalendar(
                  rowHeight: ThemeDimensions.fortySize,
                  firstDay: DateTime.utc(2010, 10, 16),
                  lastDay: DateTime.utc(2030, 3, 14),
                  focusedDay: DateTime.now(),
                  headerStyle: const HeaderStyle(formatButtonVisible: false),
                  calendarStyle: CalendarStyle(
                      todayDecoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.surfaceTint,
                    shape: BoxShape.circle,
                  )),
                ),
              ),
              Padding(
                padding:
                    const EdgeInsets.symmetric(vertical: ThemeDimensions.sizeTwenty),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      "My donation (${donationModelList.length.toString()})",
                      style: ThemeTextStyles.textBold.copyWith(fontSize: 18),
                    ),
                    InkWell(
                        onTap: () {
                          Get.toNamed(ExampleAppRoutesProvider.routeAlldonation);
                        },
                        child: Text(
                          "See All",
                          style: ThemeTextStyles.textMedium.copyWith(
                              color: Theme.of(context).colorScheme.surfaceTint),
                        ))
                  ],
                ),
              ),
              const SizedBox(
                height: ThemeDimensions.defaultSize,
              ),
              Expanded(
                  flex: 2,
                  child: donationModelList.isEmpty
                      ? Column(
                          children: [
                            CircleAvatar(
                              backgroundColor:
                                  Theme.of(context).colorScheme.surfaceTint,
                              radius: ThemeDimensions.sizeTwenty,
                              child: const Icon(
                                Icons.emoji_emotions_outlined,
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(
                              height: ThemeDimensions.largeExtraSize,
                            ),
                            Padding(
                              padding: const EdgeInsets.symmetric(
                                  vertical: ThemeDimensions.defaultSize),
                              child: Text(
                                "You have not a donation",
                                style: ThemeTextStyles.textMedium.copyWith(fontSize: 16),
                              ),
                            ),
                            CustomButton(
                              radius: ThemeDimensions.radiusBig,
                              backgroundColor:
                                  Theme.of(context).colorScheme.surfaceTint,
                              buttonText: "Make a Donation Now",
                            )
                          ],
                        )
                      : ListView.builder(
                          //physics: const NeverScrollableScrollPhysics(),
                          itemCount: donationModelList.length,
                          itemBuilder: (_, index) {
                            return Padding(
                              padding: const EdgeInsets.symmetric(
                                  vertical: ThemeDimensions.defaultSize),
                              child: Container(
                                decoration: BoxDecoration(
                                    color: Theme.of(context).cardColor,
                                    borderRadius: BorderRadius.circular(
                                        ThemeDimensions.defaultSize),
                                    border: Border.all(
                                        width: 3.5,
                                        color: Colors.grey.withOpacity(0.2))),
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
                                                          ThemeDimensions
                                                              .radiusLarge),
                                                      bottomLeft: Radius.circular(
                                                          ThemeDimensions
                                                              .radiusLarge))),
                                              child: ClipRRect(
                                                  borderRadius: const BorderRadius.only(
                                                      topLeft: Radius.circular(
                                                          ThemeDimensions
                                                              .radiusLarge),
                                                      bottomLeft: Radius.circular(
                                                          ThemeDimensions
                                                              .radiusLarge)),
                                                  child: Image(
                                                    image: AssetImage(
                                                      "${donationModelList[index].image}",
                                                    ),
                                                    fit: BoxFit.cover,
                                                  ))),
                                          const SizedBox(
                                            width:
                                                ThemeDimensions.paddingSizeDefault,
                                          ),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  "${donationModelList[index].title}",
                                                  style: ThemeTextStyles.textBold,
                                                ),
                                                const SizedBox(
                                                  height: 10,
                                                ),
                                                Row(
                                                  children: [
                                                    Text(
                                                      "\$ ${donationModelList[index].found}",
                                                      style: ThemeTextStyles.textBold.copyWith(
                                                          color: Colors.green),
                                                    ),
                                                    const Text(
                                                      " fund raising from the ",
                                                      style: ThemeTextStyles.textMedium,
                                                    ),
                                                  ],
                                                ),
                                                Padding(
                                                  padding: const EdgeInsets
                                                      .symmetric(
                                                      vertical: ThemeDimensions
                                                          .defaultSize),
                                                  child: LinearPercentIndicator(
                                                    padding: EdgeInsets.zero,
                                                    barRadius:
                                                        const Radius.circular(
                                                            10),
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
                                                            "${donationModelList[index].donators}",
                                                            style: ThemeTextStyles.textBold
                                                                .copyWith(
                                                                    color: Colors
                                                                        .green)),
                                                        const Text(
                                                          " Donations",
                                                          style: ThemeTextStyles.textSemiBold,
                                                        ),
                                                      ],
                                                    ),
                                                    Row(
                                                      children: [
                                                        Text(
                                                          "${donationModelList[index].days}",
                                                          style:
                                                              ThemeTextStyles.textBold.copyWith(
                                                                  color: Colors
                                                                      .green),
                                                        ),
                                                        const Text(
                                                            " days left"),
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
                                          Row(children: [
                                            Text(
                                              "You have donated ",
                                              style: ThemeTextStyles.donationDescription,
                                            ),
                                            Text(
                                              "${donationModelList[index].donators}",
                                              style: ThemeTextStyles.donationAmount.copyWith(
                                                  fontSize: 16),
                                            ),
                                          ]),
                                          CustomCircular(
                                            radius: ThemeDimensions.radiusBig,
                                            outlineColor: Theme.of(context)
                                                .colorScheme
                                                .surfaceTint,
                                            widget: Padding(
                                              padding: const EdgeInsets
                                                  .symmetric(
                                                  vertical: ThemeDimensions
                                                      .paddingSizeExtraSmall,
                                                  horizontal:
                                                      ThemeDimensions.defaultSize),
                                              child: Text("Donate Again",
                                                  style: ThemeTextStyles.primaryButton),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          })),
            ],
          ),
        ),
        bottomNavigationBar: EnhancedBottomNavigation(
          currentIndex: 1,
          useRoundedDesign: true,
          showLabels: false,
          items: [
            NavigationItem(
              icon: Icons.home_filled,
              label: 'home',
              route: ExampleAppRoutesProvider.routeHome,
            ),
            NavigationItem(
              icon: Icons.archive_outlined,
              label: 'activity',
              route: ExampleAppRoutesProvider.routeDonation,
            ),
            NavigationItem(
              icon: Icons.list_outlined,
              label: 'notification',
              route: ExampleAppRoutesProvider.routeFundraising,
              isCenter: true,
            ),
            NavigationItem(
              icon: Icons.sms_outlined,
              label: 'chat',
              route: ExampleAppRoutesProvider.routeChat,
            ),
            NavigationItem(
              icon: Icons.person_outline,
              label: 'profile',
              route: ExampleAppRoutesProvider.routeProfile,
            ),
          ],
        ));
  }
}
