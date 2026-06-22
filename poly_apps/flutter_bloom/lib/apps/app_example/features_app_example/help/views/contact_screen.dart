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
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class ContactScreenView extends StatelessWidget {
  const ContactScreenView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Contact us', style: ThemeTextStyles.textMedium)),
      body: Padding(
        padding: const EdgeInsets.all(ThemeDimensions.defaultSize),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(
              height: ThemeDimensions.defaultSize,
            ),
            const Padding(padding: EdgeInsets.all(8.0), child: Text('Name')),
            const CustomTextField(
              showBorder: true,
              hintText: "Name",
              showCountryCode: false,
            ),
            const SizedBox(
              height: ThemeDimensions.defaultSize,
            ),
            const Padding(padding: EdgeInsets.all(8.0), child: Text('Email')),
            const CustomTextField(
              showBorder: true,
              hintText: "email",
              showCountryCode: false,
            ),
            const SizedBox(
              height: ThemeDimensions.defaultSize,
            ),
            const Padding(
                padding: EdgeInsets.all(8.0), child: Text('  Massage')),
            const CustomTextField(
              showBorder: true,
              hintText: "Massage",
              maxLines: 6,
              borderRadius: ThemeDimensions.defaultSize,
              showCountryCode: false,
            ),
            const Spacer(),
            Align(
                alignment: Alignment.bottomCenter,
                child: CustomButton(
                    buttonText: "Sand Massage",
                    radius: ThemeDimensions.radiusBig,
                    backgroundColor:
                        Theme.of(context).colorScheme.surfaceTint)),
            const SizedBox(
              height: ThemeDimensions.defaultSize,
            )
          ],
        ),
      ),
    );
  }
}
