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

class ChatScreenView extends StatelessWidget {
  const ChatScreenView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        appBar: AppBar(
          title: Text(
            "Person name",
            style: ThemeTextStyles.appNavigation,
          ),
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(ThemeDimensions.defaultSize),
            child: Column(
              children: [
                const Spacer(),
                Align(
                  alignment: Alignment.bottomCenter,
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius:
                          BorderRadius.circular(ThemeDimensions.sizeTwenty),
                      border: Border.all(
                          width: 1.5,
                          color: Theme.of(context).colorScheme.surfaceTint),
                      color: Theme.of(context).cardColor,
                    ),
                    child: TextField(
                      expands: false,
                      decoration: InputDecoration(
                          contentPadding:
                              const EdgeInsets.all(ThemeDimensions.defaultSize),
                          hintText: "Enter your message",
                          hintStyle: ThemeTextStyles.contentBody,
                          suffixIcon: Icon(
                            Icons.send,
                            color: Theme.of(context).colorScheme.surfaceTint,
                          )),
                    ),
                  ),
                )
              ],
            ),
          ),
        ));
  }
}
