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
import 'package:qyflutter/common/widgets/custom_card.dart';
import 'package:qyflutter/common/widgets/outelineborder.dart';
import 'package:qyflutter/apps/app_example/features_app_example/fundraising/domain/model/fundraising_model.dart';
import 'package:qyflutter/apps/app_example/features_app_example/fundraising/views/edit_fundaising.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/assets/common_assets_images.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:get/get.dart';

class FundraisingResultView extends StatelessWidget {
  const FundraisingResultView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('See Results'), actions: [
        IconButton(
          icon: Icon(
            Icons.more_vert,
            color: Theme.of(context).colorScheme.surfaceTint,
          ),
          onPressed: () {
            Get.to(const EditFundraisingScreen());
          },
        ),
      ]),
      body: Padding(
        padding: const EdgeInsets.all(ThemeDimensions.defaultSize),
        child: Column(
          children: [
            const CustomCardWidget(
              title: 'Help victims of flash ...',
              donation: "4,481",
              found: "\$ 8,778",
              days: "9",
              image: CommonAssetsImages.urgent1,
            ),
            Padding(
              padding:
                  const EdgeInsets.symmetric(vertical: ThemeDimensions.sizeFifteen),
              child: Text('Fundraising',
                  style: ThemeTextStyles.textSemiBold.copyWith(fontSize: 16)),
            ),
            Expanded(
              child: GridView.builder(
                  itemCount: fundraisinglist.length,
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3, mainAxisSpacing: 5),
                  itemBuilder: (_, index) {
                    return Padding(
                        padding: const EdgeInsets.all(8),
                        child: CustomCircular(
                            radius: ThemeDimensions.defaultSize,
                            outlineColor:
                                Theme.of(context).colorScheme.surfaceTint,
                            widget: Column(
                                crossAxisAlignment: CrossAxisAlignment.center,
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(
                                    fundraisinglist[index].results,
                                    style: ThemeTextStyles.textBold.copyWith(fontSize: 18),
                                  ),
                                  const SizedBox(
                                    height: ThemeDimensions.defaultSize,
                                  ),
                                  Text(
                                    fundraisinglist[index].resultstype,
                                    style: ThemeTextStyles.textSemiBold.copyWith(fontSize: 14),
                                  ),
                                ])));
                  }),
            ),
            CustomButton(
              radius: ThemeDimensions.radiusBig,
              backgroundColor: Theme.of(context).colorScheme.surfaceTint,
              buttonText: 'Withdraw Funds(\$ 8.775)',
            )
          ],
        ),
      ),
    );
  }
}
