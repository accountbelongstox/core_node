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
import 'package:qyflutter/common/widgets/custom_text_field.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/fundraising/widget/create_fundraisig_image_widget.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class CreateNewFundraisingScreen extends StatefulWidget {
  const CreateNewFundraisingScreen({super.key});

  @override
  State<CreateNewFundraisingScreen> createState() =>
      _CreateNewFundraisingScreenState();
}

class _CreateNewFundraisingScreenState
    extends State<CreateNewFundraisingScreen> {
  bool isCheck = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        appBar: AppBar(title: const Text('Create New Fundraising')),
        body: Padding(
            padding: const EdgeInsets.all(ThemeDimensions.defaultSize),
            child: SingleChildScrollView(
                scrollDirection: Axis.vertical,
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const CreateFundraisingImageWidget(
                        height: 200,
                      ),
                      const SizedBox(height: ThemeDimensions.defaultSize),
                      const Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            CreateFundraisingImageWidget(
                                height: 100, width: 120),
                            CreateFundraisingImageWidget(
                                height: 100, width: 120),
                            CreateFundraisingImageWidget(
                                height: 100, width: 120)
                          ]),
                      Padding(
                          padding: const EdgeInsets.symmetric(
                              vertical: ThemeDimensions.defaultSize),
                          child: Text("Fundraising Details",
                              style: ThemeTextStyles.textBold.copyWith(fontSize: 18))),
                      const Text('  Title'),
                      const CustomTextField(
                        showCountryCode: false,
                      ),
                      const SizedBox(
                        height: ThemeDimensions.defaultSize,
                      ),
                      const Text('  Category'),
                      const CustomTextField(
                        showCountryCode: false,
                      ),
                      const SizedBox(
                        height: ThemeDimensions.defaultSize,
                      ),
                      const Text('  Total Donations Required'),
                      const CustomTextField(
                        showCountryCode: false,
                      ),
                      const SizedBox(
                        height: ThemeDimensions.defaultSize,
                      ),
                      const Text('  Choose Donation Expiration Date'),
                      const CustomTextField(
                        showCountryCode: false,
                      ),
                      const SizedBox(
                        height: ThemeDimensions.defaultSize,
                      ),
                      const Text('  Fund Usage Plan'),
                      const CustomTextField(
                        borderRadius: ThemeDimensions.defaultSize,
                        showCountryCode: false,
                        maxLines: 5,
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(
                            vertical: ThemeDimensions.sizeFifteen),
                        child: Text(
                          "Donation Recipient Details",
                          style: ThemeTextStyles.textBold.copyWith(fontSize: 18),
                        ),
                      ),
                      const SizedBox(
                        height: ThemeDimensions.defaultSize,
                      ),
                      const Text('  Name of Recipients proposal Document'),
                      const CustomTextField(
                        showCountryCode: false,
                      ),
                      const SizedBox(
                        height: ThemeDimensions.defaultSize,
                      ),
                      const Text('  Upload Medical Documents'),
                      const CustomTextField(
                        showCountryCode: false,
                      ),
                      const SizedBox(
                        height: ThemeDimensions.defaultSize,
                      ),
                      const Text('  Stay'),
                      const CustomTextField(
                        borderRadius: ThemeDimensions.defaultSize,
                        showCountryCode: false,
                        maxLines: 5,
                      ),
                      Row(children: [
                        Checkbox(
                            value: isCheck,
                            onChanged: (boolean) {
                              setState(() {
                                isCheck = !isCheck;
                              });
                            }),
                        const Text(
                          "I have read and agree to the terms and conditions",
                          style: ThemeTextStyles.textMedium,
                        ),
                      ]),
                      Padding(
                          padding: const EdgeInsets.symmetric(
                              vertical: ThemeDimensions.defaultSize),
                          child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                CustomButton(
                                    width: ThemeDimensions.bigMediumSize,
                                    borderColor: Theme.of(context)
                                        .colorScheme
                                        .surfaceTint,
                                    radius: ThemeDimensions.radiusBig,
                                    buttonText: "Draft"),
                                CustomButton(
                                    width: ThemeDimensions.bigExtraSize,
                                    radius: ThemeDimensions.radiusBig,
                                    backgroundColor: Theme.of(context)
                                        .colorScheme
                                        .surfaceTint,
                                    buttonText: "Create & Submit"),
                              ])),
                    ]))));
  }
}
