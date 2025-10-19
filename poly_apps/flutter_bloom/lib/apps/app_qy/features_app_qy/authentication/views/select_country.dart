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
import 'package:qyflutter/apps/app_qy/features_app_qy/authentication/views/congratulation_screen.dart';
import 'package:qyflutter/common/widgets/custom_button.dart';
import 'package:qyflutter/common/widgets/country_picker.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/widgets/custom_app_bar.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/profile/views/profile_screen.dart';
import 'package:get/get.dart';

class SelectCountryScreen extends StatefulWidget {
  const SelectCountryScreen({super.key});

  @override
  State<SelectCountryScreen> createState() => _SelectCountryScreenState();
}

class _SelectCountryScreenState extends State<SelectCountryScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
        backgroundColor: Theme.of(context).cardColor,
        appBar: const CustomAppBar(
          title: "Select Your Country",
        ),
        body: Padding(
          padding: const EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
          child: Column(
            children: [
              const CodePickerWidget(),
              const Spacer(),
              CustomButton(
                radius: ThemeDimensions.radiusBig,
                backgroundColor: Theme.of(context).colorScheme.surfaceTint,
                borderColor: Theme.of(context).colorScheme.surfaceTint,
                height: ThemeDimensions.largeExtraSize,
                width: double.infinity,
                buttonText: "Continue",
                onPressed: () {
                  Get.to(ProfileScreenView());
                },
              ),
            ],
          ),
        ));
  }
}
