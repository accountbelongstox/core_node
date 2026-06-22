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
import 'package:qyflutter/apps/app_example/features_app_example/home/widget/all_screen.dart';
import 'package:qyflutter/apps/app_example/features_app_example/home/widget/disaster_screen.dart';
import 'package:qyflutter/apps/app_example/features_app_example/home/widget/education_screen.dart';
import 'package:qyflutter/apps/app_example/features_app_example/home/widget/medical_screen.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';

class TabWidget extends StatelessWidget {
  const TabWidget({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Expanded(
          flex: 2,
          child: DefaultTabController(
              length: 4,
              child: Column(
                children: [
                  Container(
                    color: Theme.of(context).cardColor,
                    child: TabBar(
                        isScrollable: true,
                        enableFeedback: true,
                        labelPadding: const EdgeInsets.symmetric(
                            horizontal: ThemeDimensions.defaultSize),
                        indicator: BoxDecoration(
                          border: Border.all(
                            width: 2.5,
                            color: Theme.of(context).colorScheme.surfaceTint,
                          ),
                          borderRadius:
                              BorderRadius.circular(ThemeDimensions.sizeTwentyFive),
                          color: Theme.of(context).colorScheme.surfaceTint,
                        ),
                        unselectedLabelColor:
                            Theme.of(context).colorScheme.surfaceTint,
                        tabs: const [
                          Tab(
                              child: TabContainer(
                            tabText: Text("All"),
                          )),
                          Tab(
                              child: TabContainer(
                            tabText: Text("Medical"),
                          )),
                          Tab(
                              child: TabContainer(
                            tabText: Text("Dilate"),
                          )),
                          Tab(child: TabContainer(tabText: Text("Education"))),
                        ]),
                  ),
                  const Expanded(
                    child: TabBarView(children: [
                      AllScreenView(),
                      MedicalScreenView(),
                      DisasterScreenView(),
                      EducationScreenView(),
                    ]),
                  )
                ],
              )))
    ]);
  }
}

class TabContainer extends StatelessWidget {
  final Widget tabText;
  const TabContainer({super.key, required this.tabText});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusBig),
          border: Border.all(
            color: Theme.of(context).colorScheme.surfaceTint,
          )),
      child: Align(
        alignment: Alignment.center,
        child: Padding(
          padding:
              const EdgeInsets.symmetric(horizontal: ThemeDimensions.mediumSize),
          child: tabText,
        ),
      ),
    );
  }
}
