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
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class SettingWidget extends StatelessWidget {
  final Icon icon;
  final String settingTitle;
  final Color? backgroundColor;
  final Icon? trailingIcon;
  final Function()? onTap;
  const SettingWidget(
      {super.key,
      required this.icon,
      required this.settingTitle,
      this.trailingIcon,
      this.onTap,
      this.backgroundColor});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(ThemeDimensions.defaultSize),
      child: InkWell(
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(ThemeDimensions.defaultSize),
              border: Border.all(
                  width: 1.5,
                  color: Colors.grey.withValues(
                      red: 128, green: 128, blue: 128, alpha: 0.1))),
          child: Padding(
            padding: const EdgeInsets.all(8.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(children: [
                  CircleAvatar(
                      radius: ThemeDimensions.sizeTwenty,
                      backgroundColor: backgroundColor ??
                          Theme.of(context).colorScheme.tertiary,
                      child: icon),
                  const SizedBox(
                    width: ThemeDimensions.defaultSize,
                  ),
                  Text(settingTitle,
                      style: ThemeTextStyles.textMedium.copyWith(
                          fontSize: ThemeDimensions.fontSizeDefault))
                ]),
                Icon(
                  Icons.arrow_forward_ios,
                  color: Theme.of(context).primaryColor,
                  size: 20,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
