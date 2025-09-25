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
import 'package:qyflutter/apps/app_example/features_app_example/setting/widgets/notification_setting_widget.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class SecuritySettingScreen extends StatelessWidget {
  const SecuritySettingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        appBar: AppBar(
          title: const Text(
            "Security",
            style: ThemeTextStyles.textSemiBold,
          ),
        ),
        body: Padding(
          padding: const EdgeInsets.all(ThemeDimensions.defaultSize),
          child: Column(
            children: [
              const CustomSettingCard(
                  title: "Face ID",
                  icon: Icon(
                    Icons.toggle_on,
                    color: Colors.green,
                    size: 30,
                  )),
              const Padding(
                padding: EdgeInsets.symmetric(vertical: ThemeDimensions.defaultSize),
                child: CustomSettingCard(
                    title: "Remember me",
                    icon: Icon(
                      Icons.toggle_on_outlined,
                      color: Colors.grey,
                      size: 30,
                    )),
              ),
              const CustomSettingCard(
                  title: "Touch ID",
                  icon: Icon(Icons.toggle_on, color: Colors.green, size: 30)),
              Padding(
                padding: const EdgeInsets.symmetric(
                    vertical: ThemeDimensions.paddingSizeExtraLarge),
                child: Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(ThemeDimensions.radiusBig),
                      border: Border.all(
                        width: 1.5,
                        color: Theme.of(context).colorScheme.surfaceTint,
                      ),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                          vertical: ThemeDimensions.sizeFifteen),
                      child: Center(
                        child: Text(
                          "Change Password",
                          style: ThemeTextStyles.primaryButton,
                        ),
                      ),
                    )),
              ),
              Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(ThemeDimensions.radiusBig),
                    border: Border.all(
                      width: 1.5,
                      color: Theme.of(context).colorScheme.surfaceTint,
                    ),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                        vertical: ThemeDimensions.sizeFifteen),
                    child: Center(
                      child: Text(
                        "Change PIN",
                        style: ThemeTextStyles.primaryButton,
                      ),
                    ),
                  )),
            ],
          ),
        ));
  }
}
