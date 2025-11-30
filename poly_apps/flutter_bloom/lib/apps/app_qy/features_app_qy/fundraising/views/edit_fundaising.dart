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
import 'package:qyflutter/apps/app_qy/features_app_qy/fundraising/widget/card_widget.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/assets/common_assets_icons.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class EditFundraisingScreen extends StatelessWidget {
  const EditFundraisingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Edit Fundraising'), actions: <Widget>[
        IconButton(
            icon: const Icon(
              Icons.delete,
              color: Colors.red,
            ),
            onPressed: () {})
      ]),
      body: Padding(
        padding: const EdgeInsets.all(ThemeDimensions.defaultSize),
        child: SingleChildScrollView(
          scrollDirection: Axis.vertical,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                  decoration: BoxDecoration(
                      borderRadius:
                          BorderRadius.circular(ThemeDimensions.defaultSize)),
                  child: ClipRRect(
                      borderRadius:
                          BorderRadius.circular(ThemeDimensions.defaultSize),
                      child: Image.asset(CommonAssetsIcons.education))),
              const SizedBox(
                height: ThemeDimensions.sizeFifteen,
              ),
              const Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    FundaisingSubImageWidget(),
                    FundaisingSubImageWidget(),
                    FundaisingSubImageWidget(),
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
              Padding(
                padding: const EdgeInsets.symmetric(
                    vertical: ThemeDimensions.defaultSize),
                child: CustomButton(
                    radius: ThemeDimensions.radiusBig,
                    backgroundColor: Theme.of(context).colorScheme.surfaceTint,
                    buttonText: "Update & Submit"),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
