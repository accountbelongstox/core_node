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
import 'package:qyflutter/apps/app_qy/features_app_qy/home/widget/actions_widget.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/domain/model/prayer_model.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/data/prayer_data.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/widget/prayer_widget.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';

class PrayerScreen extends StatelessWidget {
  final PrayerModel? prayerModel;
  const PrayerScreen({super.key, this.prayerModel});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        appBar: AppBar(
          title: const Text(
            'Prayer From Goo..',
            style: ThemeTextStyles.textBold,
          ),
          actions: const [
            ActionWidget(
                actionIcon: Icon(
              Icons.search,
              color: ColorsAppQy.qyTextOnPrimary,
            )),
            ActionWidget(
                actionIcon: Icon(
              Icons.more_vert,
              color: ColorsAppQy.qyTextOnPrimary,
            ))
          ],
        ),
        body: Column(
          children: [
            Expanded(
              child: ListView.builder(
                  itemCount: PrayerData.getMockPrayers().length,
                  itemBuilder: (_, index) {
                    final prayers = PrayerData.getMockPrayers();
                    return Container(
                        height: 230,
                        decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(50)),
                        child: PrayerWidget(prayerModel: prayers[index]));
                  }),
            ),
            Padding(
              padding: const EdgeInsets.all(ThemeDimensions.defaultSize),
              child: TextField(
                decoration: InputDecoration(
                  border: OutlineInputBorder(
                    borderRadius: const BorderRadius.all(
                        Radius.circular(ThemeDimensions.radiusBig)),
                    borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.surfaceTint,
                        width: 2.5),
                  ),
                  hintText: 'Search',
                  suffixIcon: const Icon(
                    Icons.send,
                    color: ColorsAppQy.qySuccess,
                  ),
                ),
              ),
            ),
            const SizedBox(
              height: ThemeDimensions.defaultSize,
            )
          ],
        ));
  }
}
