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
import 'package:qyflutter/apps/app_qy/features_app_qy/home/widget/coming_widget.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/widget/urgent_fund_rising_widget.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';

class BookMarkScreenView extends StatelessWidget {
  BookMarkScreenView({super.key});
  final List testlist = [0];
  @override
  Widget build(BuildContext context) {
    // Using common text styles directly

    return Scaffold(
      appBar: AppBar(
          forceMaterialTransparency: true,
          title: Text(
            "Bookmark",
            style: ThemeTextStyles.appNavigation,
          ),
          actions: const [
            Padding(
                padding: EdgeInsets.all(8.0),
                child: Icon(Icons.more_vert, color: ColorsAppQy.qySuccess))
          ]),
      body: Column(
        children: [
          const Padding(
              padding: EdgeInsets.symmetric(horizontal: ThemeDimensions.defaultSize),
              child: UrgentFundRisingWidget()),
          Expanded(
              child: testlist.isEmpty
                  ? Center(
                      child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                          CircleAvatar(
                              radius: 50,
                              backgroundColor:
                                  Theme.of(context).colorScheme.surfaceTint,
                              child: Icon(Icons.bookmark,
                                  color: ColorsAppQy.qyTextOnPrimary)),
                          const SizedBox(
                            height: ThemeDimensions.sizeFifteen,
                          ),
                          Text("You have no Bookmark",
                              style: ThemeTextStyles.contentTitle.copyWith(
                                  color: ThemeColors.primaryBrand)),
                        ]))
                  : ListView.builder(
                      itemCount: 10,
                      itemBuilder: (_, index) {
                        return const ComingEndWidget();
                      }))
        ],
      ),
    );
  }
}
