import 'package:flutter/material.dart';
import 'package:qyflutter/common/widgets/outelineborder.dart';
import 'package:qyflutter/apps/app_example/features_app_example/donation/domain/model/doantion_model.dart';
import 'package:qyflutter/apps/app_example/features_app_example/home/widget/actions_widget.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:percent_indicator/percent_indicator.dart';

class MyDonationAllScreen extends StatelessWidget {
  const MyDonationAllScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
          title:
              Text("My Donations ( ${donationModelList.length.toString()} )"),
          actions: const [
            ActionWidget(
                actionIcon: Icon(
              Icons.more_vert,
              color: Colors.white,
            ))
          ]),
      body: Expanded(
          child: Padding(
        padding: const EdgeInsets.all(8.0),
        child: ListView.builder(
            itemCount: donationModelList.length,
            itemBuilder: (_, index) {
              return Padding(
                padding: const EdgeInsets.symmetric(
                    vertical: ThemeDimensions.defaultSize),
                child: Container(
                    decoration: BoxDecoration(
                        color: Theme.of(context).cardColor,
                        borderRadius:
                            BorderRadius.circular(ThemeDimensions.defaultSize),
                        border: Border.all(
                            width: 3.5, color: Colors.grey.withOpacity(0.2))),
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
                                              "${donationModelList[index].image}",
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
                                      "${donationModelList[index].title}",
                                      style: ThemeTextStyles.textBold,
                                    ),
                                    const SizedBox(
                                      height: 10,
                                    ),
                                    Row(children: [
                                      Text(
                                        "\$ ${donationModelList[index].donators}",
                                        style: ThemeTextStyles.textBold.copyWith(
                                            color: Colors.green),
                                      ),
                                      const Text(" fund raising from the ",
                                          style: ThemeTextStyles.textMedium)
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
                                                "${donationModelList[index].donators}",
                                                style: ThemeTextStyles.textBold.copyWith(
                                                    color: Colors.green)),
                                            const Text(" Donations",
                                                style: ThemeTextStyles.textSemiBold)
                                          ]),
                                          Row(children: [
                                            Text(
                                              "${donationModelList[index].days}",
                                              style: ThemeTextStyles.textBold.copyWith(
                                                  color: Colors.green),
                                            ),
                                            const Text(" days left"),
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
                                  const Text(
                                    "You have donated ",
                                    style: ThemeTextStyles.textBold,
                                  ),
                                  Text(
                                    "${donationModelList[index].donators}",
                                    style:
                                        ThemeTextStyles.textBold.copyWith(color: Colors.green),
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
                                        child: Text("Donate Again",
                                            style: ThemeTextStyles.textSemiBold.copyWith(
                                                color: Colors.green)))),
                              ]))
                    ])),
              );
            }),
      )),
    );
  }
}
