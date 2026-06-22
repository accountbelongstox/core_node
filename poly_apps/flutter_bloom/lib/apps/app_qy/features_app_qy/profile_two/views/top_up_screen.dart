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
import 'package:qyflutter/common/widgets/custom_button.dart';
import 'package:qyflutter/common/widgets/outelineborder.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/widget/actions_widget.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/profile_two/views/topup_method_screen.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:get/get.dart';

class TopUpScreenView extends StatefulWidget {
  const TopUpScreenView({super.key});

  @override
  State<TopUpScreenView> createState() => _TopUpScreenViewState();
}

class _TopUpScreenViewState extends State<TopUpScreenView> {
  int selectedindex = 0;

  void setSelectedIndex(int index) {
    setState(() {
      selectedindex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
          title: const Text(
            "Top Up",
            style: ThemeTextStyles.textBold,
          ),
          actions: const [
            ActionWidget(actionIcon: Icon(Icons.more_vert, color: Colors.white))
          ]),
      body: Padding(
        padding: const EdgeInsets.all(ThemeDimensions.defaultSize),
        child: Column(
          children: [
            Padding(
                padding: const EdgeInsets.all(ThemeDimensions.sizeFifteen),
                child: Center(
                    child: Text('Enter the Amount',
                        style: ThemeTextStyles.textBold.copyWith(fontSize: 18)))),
            Container(
                height: ThemeDimensions.bigMediumSize,
                width: double.infinity,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(15),
                  border: Border.all(width: 1.5, color: Colors.green),
                ),
                child: Center(
                    child: Text(
                  selectedindex == 0
                      ? "\$ 5"
                      : selectedindex == 1
                          ? "\$ 10"
                          : selectedindex == 2
                              ? "\$ 25"
                              : selectedindex == 3
                                  ? "\$ 50"
                                  : selectedindex == 4
                                      ? "\$ 100"
                                      : "\$ 200",
                  style: ThemeTextStyles.textBold.copyWith(fontSize: 24, color: Colors.green),
                ))),
            const SizedBox(
              height: ThemeDimensions.sizeTwentyFive,
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                GestureDetector(
                    onTap: () {
                      setSelectedIndex(0);
                    },
                    child: CustomCircular(
                        width: ThemeDimensions.sizeOneTwenty,
                        bottomColor:
                            (selectedindex == 0) ? Colors.green : Colors.white,
                        outlineColor:
                            (selectedindex == 0) ? Colors.white : Colors.green,
                        radius: ThemeDimensions.radiusBig,
                        widget: Center(
                            child: Padding(
                                padding: const EdgeInsets.symmetric(
                                    vertical: ThemeDimensions.defaultSize,
                                    horizontal: ThemeDimensions.mediumSize),
                                child: Text('\$5',
                                    style: TextStyle(
                                        color: (selectedindex == 0)
                                            ? Colors.white
                                            : Colors.green)))))),
                GestureDetector(
                    onTap: () {
                      setSelectedIndex(1);
                    },
                    child: CustomCircular(
                        width: ThemeDimensions.sizeOneTwenty,
                        bottomColor:
                            (selectedindex == 1) ? Colors.green : Colors.white,
                        outlineColor:
                            (selectedindex == 1) ? Colors.white : Colors.green,
                        radius: ThemeDimensions.radiusBig,
                        widget: Center(
                            child: Padding(
                                padding: const EdgeInsets.symmetric(
                                    vertical: ThemeDimensions.defaultSize,
                                    horizontal: ThemeDimensions.mediumSize),
                                child: Text('\$10',
                                    style: TextStyle(
                                        color: (selectedindex == 1)
                                            ? Colors.white
                                            : Colors.green)))))),
                GestureDetector(
                    onTap: () {
                      setSelectedIndex(2);
                    },
                    child: CustomCircular(
                        width: ThemeDimensions.sizeOneTwenty,
                        bottomColor:
                            (selectedindex == 2) ? Colors.green : Colors.white,
                        outlineColor:
                            (selectedindex == 2) ? Colors.white : Colors.green,
                        radius: ThemeDimensions.radiusBig,
                        widget: Center(
                            child: Padding(
                                padding: const EdgeInsets.symmetric(
                                    vertical: ThemeDimensions.defaultSize,
                                    horizontal: ThemeDimensions.defaultSize),
                                child: Text('\$25',
                                    style: TextStyle(
                                        color: (selectedindex == 2)
                                            ? Colors.white
                                            : Colors.green)))))),
              ],
            ),
            const SizedBox(
              height: ThemeDimensions.defaultSize,
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                GestureDetector(
                    onTap: () {
                      setSelectedIndex(3);
                    },
                    child: CustomCircular(
                        width: ThemeDimensions.sizeOneTwenty,
                        bottomColor:
                            (selectedindex == 3) ? Colors.green : Colors.white,
                        outlineColor:
                            (selectedindex == 3) ? Colors.white : Colors.green,
                        radius: ThemeDimensions.radiusBig,
                        widget: Center(
                            child: Padding(
                                padding: const EdgeInsets.symmetric(
                                    vertical: ThemeDimensions.defaultSize,
                                    horizontal: ThemeDimensions.mediumSize),
                                child: Text('\$50',
                                    style: TextStyle(
                                        color: (selectedindex == 3)
                                            ? Colors.white
                                            : Colors.green)))))),
                GestureDetector(
                    onTap: () {
                      setSelectedIndex(4);
                    },
                    child: CustomCircular(
                        width: ThemeDimensions.sizeOneTwenty,
                        bottomColor:
                            (selectedindex == 4) ? Colors.green : Colors.white,
                        outlineColor:
                            (selectedindex == 4) ? Colors.white : Colors.green,
                        radius: ThemeDimensions.radiusBig,
                        widget: Center(
                            child: Padding(
                                padding: const EdgeInsets.symmetric(
                                    vertical: ThemeDimensions.defaultSize,
                                    horizontal: ThemeDimensions.mediumSize),
                                child: Text('\$100',
                                    style: TextStyle(
                                        color: (selectedindex == 4)
                                            ? Colors.white
                                            : Colors.green)))))),
                GestureDetector(
                    onTap: () {
                      setSelectedIndex(5);
                    },
                    child: CustomCircular(
                        width: ThemeDimensions.sizeOneTwenty,
                        bottomColor:
                            (selectedindex == 5) ? Colors.green : Colors.white,
                        outlineColor:
                            (selectedindex == 5) ? Colors.white : Colors.green,
                        radius: ThemeDimensions.radiusBig,
                        widget: Center(
                            child: Padding(
                                padding: const EdgeInsets.symmetric(
                                    vertical: ThemeDimensions.defaultSize,
                                    horizontal: ThemeDimensions.defaultSize),
                                child: Text('\$200',
                                    style: TextStyle(
                                        color: (selectedindex == 5)
                                            ? Colors.white
                                            : Colors.green)))))),
              ],
            ),
            const Spacer(),
            CustomButton(
                height: ThemeDimensions.paddingSizeOver,
                buttonText: "Continue",
                onPressed: () {
                  Get.to(const TopUpMethodScreenView());
                },
                radius: ThemeDimensions.radiusBig,
                backgroundColor: Theme.of(context).colorScheme.surfaceTint)
          ],
        ),
      ),
    );
  }
}
