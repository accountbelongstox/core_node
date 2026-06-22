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
import 'package:qyflutter/apps/app_qy/features_app_qy/donation/sources/donation_data.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:go_router/go_router.dart';
import 'package:percent_indicator/linear_percent_indicator.dart';
import 'package:table_calendar/table_calendar.dart';
import 'package:qyflutter/common/widgets/enhanced_bottom_navigation.dart';
// AI: Claude Code - Replaced app-specific HomeBottomNavigationBar with common EnhancedBottomNavigation
import 'package:qyflutter/apps/app_qy/router_app_qy/routes_provider_app_qy.dart';
import 'package:qyflutter/apps/app_qy/localization_app_qy/localization_keys_app_qy.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';

class DonationScreenView extends StatelessWidget {
  const DonationScreenView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        appBar: CustomAppBar(
          regularAppbar: true,
          title: QyAppLocalizationKeys.qyMyDonations.tr(context),
        ),
        body: Padding(
          padding: const EdgeInsets.symmetric(
              horizontal: ThemeDimensions.defaultSize),
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
                padding: const EdgeInsets.symmetric(
                    vertical: ThemeDimensions.sizeTwenty),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '${QyAppLocalizationKeys.qyMyDonations.tr(context)} (${DonationData.getDonations().length.toString()})',
                      style: ThemeTextStyles.textBold.copyWith(fontSize: 18),
                    ),
                    InkWell(
                      onTap: () {
                        context.push(QyAppRoutesProvider.routeAlldonation);
                      },
                      child: Text(
                        QyAppLocalizationKeys.qyViewAll.tr(context),
                        style: ThemeTextStyles.textMedium.copyWith(
                          color: Theme.of(context).colorScheme.surfaceTint,
                        ),
                      ),
                    )
                  ],
                ),
              ),
              const SizedBox(
                height: ThemeDimensions.defaultSize,
              ),
              Expanded(
                  flex: 2,
                  child: DonationData.getDonations().isEmpty
                      ? Column(
                          children: [
                            CircleAvatar(
                              backgroundColor:
                                  Theme.of(context).colorScheme.surfaceTint,
                              radius: ThemeDimensions.sizeTwenty,
                              child: const Icon(
                                Icons.emoji_emotions_outlined,
                                color: ColorsAppQy.qyTextOnPrimary,
                              ),
                            ),
                            const SizedBox(
                              height: ThemeDimensions.largeExtraSize,
                            ),
                            Padding(
                              padding: const EdgeInsets.symmetric(
                                  vertical: ThemeDimensions.defaultSize),
                              child: Text(
                                QyAppLocalizationKeys.qyDonationNoDonation
                                    .tr(context),
                                style: ThemeTextStyles.textMedium
                                    .copyWith(fontSize: 16),
                              ),
                            ),
                            CustomButton(
                              radius: ThemeDimensions.radiusBig,
                              backgroundColor:
                                  Theme.of(context).colorScheme.surfaceTint,
                              buttonText: QyAppLocalizationKeys
                                  .qyDonationMakeNow
                                  .tr(context),
                            )
                          ],
                        )
                      : ListView.builder(
                          //physics: const NeverScrollableScrollPhysics(),
                          itemCount: DonationData.getDonations().length,
                          itemBuilder: (_, index) {
                            final donation = DonationData.getDonations()[index];
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
                                        color: ColorsAppQy.qyBorderLight)),
                                child: Column(
                                  children: [
                                    Padding(
                                      padding: const EdgeInsets.all(8.0),
                                      child: Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.spaceBetween,
                                        children: [
                                          Container(
                                              height:
                                                  ThemeDimensions.sizeOneTwenty,
                                              width:
                                                  ThemeDimensions.sizeOneTwenty,
                                              decoration: const BoxDecoration(
                                                  color: ColorsAppQy.qyTextSecondary,
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
                                                      bottomLeft:
                                                          Radius.circular(ThemeDimensions.radiusLarge)),
                                                  child: Image(
                                                    image: AssetImage(
                                                      "${donation.image}",
                                                    ),
                                                    fit: BoxFit.cover,
                                                  ))),
                                          const SizedBox(
                                            width: ThemeDimensions
                                                .paddingSizeDefault,
                                          ),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  "${donation.title}",
                                                  style:
                                                      ThemeTextStyles.textBold,
                                                ),
                                                const SizedBox(
                                                  height: 10,
                                                ),
                                                Row(
                                                  children: [
                                                    Text(
                                                      "\$ ${donation.found}",
                                                      style: ThemeTextStyles
                                                          .textBold
                                                          .copyWith(
                                                              color:
                                                                  ColorsAppQy.qySuccess),
                                                    ),
                                                    Text(
                                                      " ${QyAppLocalizationKeys.qyDonationFundRaising.tr(context)} ",
                                                      style: ThemeTextStyles
                                                          .textMedium,
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
                                                            "${donation.donators}",
                                                            style: ThemeTextStyles
                                                                .textBold
                                                                .copyWith(
                                                                    color: Colors
                                                                        .green)),
                                                        Text(
                                                          " ${QyAppLocalizationKeys.qyDonationDonations.tr(context)}",
                                                          style: ThemeTextStyles
                                                              .textSemiBold,
                                                        ),
                                                      ],
                                                    ),
                                                    Row(
                                                      children: [
                                                        Text(
                                                          "${donation.days}",
                                                          style: ThemeTextStyles
                                                              .textBold
                                                              .copyWith(
                                                                  color: Colors
                                                                      .green),
                                                        ),
                                                        Text(
                                                            " ${QyAppLocalizationKeys.qyDonationDaysLeft.tr(context)}"),
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
                                              QyAppLocalizationKeys
                                                  .qyDonationNoDonation
                                                  .tr(context),
                                              style: ThemeTextStyles
                                                  .donationDescription,
                                            ),
                                            Text(
                                              donation.donators ?? '',
                                              style: ThemeTextStyles
                                                  .donationAmount
                                                  .copyWith(fontSize: 16),
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
                                                  horizontal: ThemeDimensions
                                                      .defaultSize),
                                              child: Text("Donate Again",
                                                  style: ThemeTextStyles
                                                      .primaryButton),
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
              route: QyAppRoutesProvider.routeHome,
            ),
            NavigationItem(
              icon: Icons.archive_outlined,
              label: 'activity',
              route: QyAppRoutesProvider.routeDonation,
            ),
            NavigationItem(
              icon: Icons.list_outlined,
              label: 'notification',
              route: QyAppRoutesProvider.routeFundraising,
              isCenter: true,
            ),
            NavigationItem(
              icon: Icons.sms_outlined,
              label: 'chat',
              route: QyAppRoutesProvider.routeChat,
            ),
            NavigationItem(
              icon: Icons.person_outline,
              label: 'profile',
              route: QyAppRoutesProvider.routeProfile,
            ),
          ],
        ));
  }
}
