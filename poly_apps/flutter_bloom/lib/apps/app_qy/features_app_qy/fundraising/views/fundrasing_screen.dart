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
import 'package:qyflutter/apps/app_qy/features_app_qy/fundraising/views/my_fudrasing_screen.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'activity_screen.dart';

class FundrasingScreenView extends StatelessWidget {
  const FundrasingScreenView({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
          appBar: AppBar(
              centerTitle: true,
              title: const Text(
                "My Fundraising",
                style: ThemeTextStyles.textMedium,
              ),
              bottom: TabBar(
                  indicatorColor: Theme.of(context).colorScheme.surfaceTint,
                  labelColor: Theme.of(context).colorScheme.surfaceTint,
                  tabs: const [
                    Tab(
                      child: Text(
                        "My Fundraising",
                        style: ThemeTextStyles.textMedium,
                      ),
                    ),
                    Tab(
                      child: Text(
                        "Activity",
                        style: ThemeTextStyles.textMedium,
                      ),
                    ),
                  ])),
          body: TabBarView(
              children: [MyFundraisingScreen(), const ActivityScreen()])),
    );
  }
}
