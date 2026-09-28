import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/domain/model/comingto_model.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/widget/actions_widget.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/widget/urgent_fund_rising_widget.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';
import 'package:percent_indicator/linear_percent_indicator.dart';

class ComingEndScree extends StatelessWidget {
  const ComingEndScree({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        forceMaterialTransparency: true,
        title: Text(
          "Coming to an end (${comingModelList.length})",
          style: ThemeTextStyles.appNavigation,
        ),
        actions: const [
          ActionWidget(
              actionIcon: Icon(
            Icons.more_vert,
            color: ColorsAppQy.qyTextOnPrimary,
          ))
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(ThemeDimensions.defaultSize),
        child: Column(
          children: [
            const UrgentFundRisingWidget(),
            Container(
              decoration: BoxDecoration(
                  color: Theme.of(context).hintColor.withOpacity(0.2),
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
            const SizedBox(
              height: 5,
            ),
            Expanded(
                child: ListView.builder(
                    itemCount: comingModelList.length,
                    itemBuilder: (_, index) {
                      return Padding(
                        padding: const EdgeInsets.symmetric(
                            vertical: ThemeDimensions.paddingSizeSeven),
                        child: Container(
                          decoration: BoxDecoration(
                              borderRadius:
                                  BorderRadius.circular(ThemeDimensions.defaultSize),
                              border: Border.all(
                                  width: 1.5,
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
                                        height: ThemeDimensions.sizeOneTwenty,
                                        width: ThemeDimensions.sizeOneTwenty,
                                        decoration: const BoxDecoration(
                                            color: ColorsAppQy.qyTextTertiary,
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
                                                "${comingModelList[index].image}",
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
                                            " ${comingModelList[index].title}",
                                            style: ThemeTextStyles.textBold,
                                          ),
                                          const SizedBox(
                                            height: 10,
                                          ),
                                          Row(
                                            children: [
                                              Text(
                                                "\$ ${comingModelList[index].found},",
                                                style: ThemeTextStyles.textMedium.copyWith(
                                                    color: ColorsAppQy.qySuccess),
                                              ),
                                              const Text(
                                                " fund reusing from the ",
                                                style: ThemeTextStyles.textMedium,
                                              ),
                                            ],
                                          ),
                                          Padding(
                                            padding: const EdgeInsets.symmetric(
                                                vertical: ThemeDimensions
                                                    .paddingSizeExtraSmall),
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
                                              Row(
                                                children: [
                                                  Text(
                                                    "${comingModelList[index].donat},",
                                                    style: ThemeTextStyles.textMedium.copyWith(
                                                        color: ColorsAppQy.qySuccess),
                                                  ),
                                                  const Text(
                                                    " Donations",
                                                    style: ThemeTextStyles.textMedium,
                                                  ),
                                                ],
                                              ),
                                              Row(
                                                children: [
                                                  Text(
                                                    "& ${comingModelList[index].days},",
                                                    style: ThemeTextStyles.textMedium.copyWith(
                                                        color: ColorsAppQy.qySuccess),
                                                  ),
                                                  const Text(
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
                        ),
                      );
                    }))
          ],
        ),
      ),
    );
  }
}
