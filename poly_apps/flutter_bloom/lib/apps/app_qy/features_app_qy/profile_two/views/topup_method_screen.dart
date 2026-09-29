import 'package:flutter/material.dart';
import 'package:qyflutter/common/widgets/custom_button.dart';
import 'package:qyflutter/common/widgets/outelineborder.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/widget/actions_widget.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:get/get.dart';

import 'add_card_screen.dart';
import 'set_withdraw_mail_screen.dart';

class TopUpMethodScreenView extends StatelessWidget {
  const TopUpMethodScreenView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        appBar: AppBar(
            title: const Text(
              "Top up ",
              style: ThemeTextStyles.textBold,
            ),
            actions: const [
              ActionWidget(
                  actionIcon: Icon(Icons.view_cozy, color: Colors.white))
            ]),
        body: Padding(
          padding: const EdgeInsets.all(ThemeDimensions.sizeFifteen),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(
                    vertical: ThemeDimensions.sizeFifteen),
                child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text("Select Top Up Method ",
                          style: ThemeTextStyles.textBold.copyWith(fontSize: 16)),
                      InkWell(
                          onTap: () {
                            Get.to(const AddNewCardScreen());
                          },
                          child: Text("Add New Card ",
                              style: ThemeTextStyles.textBold.copyWith(
                                  fontSize: 14, color: Colors.green)))
                    ]),
              ),
              CustomCircular(
                  outlineColor: Theme.of(context).hintColor.withOpacity(0.4),
                  radius: ThemeDimensions.defaultSize,
                  widget: Padding(
                      padding: const EdgeInsets.all(ThemeDimensions.sizeFifteen),
                      child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(children: [
                              const Icon(
                                Icons.paypal,
                                color: Colors.green,
                              ),
                              Text("PayPal",
                                  style: ThemeTextStyles.textMedium.copyWith(fontSize: 16)),
                            ]),
                            const Icon(Icons.circle_outlined)
                          ]))),
              Padding(
                  padding: const EdgeInsets.symmetric(
                      vertical: ThemeDimensions.sizeFifteen),
                  child: CustomCircular(
                      outlineColor: Theme.of(context).hintColor,
                      radius: ThemeDimensions.defaultSize,
                      widget: Padding(
                          padding: const EdgeInsets.all(ThemeDimensions.sizeFifteen),
                          child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(children: [
                                  const Icon(
                                    Icons.paypal,
                                    color: Colors.green,
                                  ),
                                  Text("Google Pay",
                                      style: ThemeTextStyles.textMedium.copyWith(fontSize: 16)),
                                ]),
                                const Icon(Icons.circle_outlined)
                              ])))),
              CustomCircular(
                  outlineColor: Theme.of(context).hintColor.withOpacity(0.5),
                  radius: ThemeDimensions.defaultSize,
                  widget: Padding(
                      padding: const EdgeInsets.all(ThemeDimensions.sizeFifteen),
                      child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(children: [
                              const Icon(
                                Icons.paypal,
                                color: Colors.green,
                              ),
                              Text("Apple Pay",
                                  style: ThemeTextStyles.textMedium.copyWith(fontSize: 16)),
                            ]),
                            const Icon(Icons.circle_outlined)
                          ]))),
              Padding(
                  padding: const EdgeInsets.symmetric(
                      vertical: ThemeDimensions.sizeTwenty),
                  child: Text("Pay With Debit/Cradit Card",
                      style: ThemeTextStyles.textMedium.copyWith(fontSize: 18))),
              CustomCircular(
                  outlineColor: Theme.of(context).hintColor.withOpacity(0.5),
                  radius: ThemeDimensions.defaultSize,
                  widget: Padding(
                      padding: const EdgeInsets.all(ThemeDimensions.sizeFifteen),
                      child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(children: [
                              const Icon(
                                Icons.paypal,
                                color: Colors.green,
                              ),
                              Text("*****01250253",
                                  style: ThemeTextStyles.textMedium.copyWith(fontSize: 16)),
                            ]),
                            const Icon(Icons.circle_outlined)
                          ]))),
              const Spacer(),
              CustomButton(
                height: ThemeDimensions.paddingSizeOver,
                buttonText: "Continue",
                onPressed: () {
                  Get.to((const WithdrawGmailSetScreen()));
                },
                radius: ThemeDimensions.radiusBig,
                backgroundColor: Theme.of(context).colorScheme.surfaceTint,
              )
            ],
          ),
        ));
  }
}
