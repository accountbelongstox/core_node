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
import 'package:qyflutter/apps/app_qy/features_app_qy/home/domain/model/wacth_impact_model.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/views/play_video_screen.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/widget/actions_widget.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:get/get.dart';

class WatchTheImpactScreen extends StatefulWidget {
  const WatchTheImpactScreen({super.key});

  @override
  State<WatchTheImpactScreen> createState() => _WatchTheImpactScreenState();
}

class _WatchTheImpactScreenState extends State<WatchTheImpactScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
        appBar: AppBar(
          title: const Text(
            "Watch the Impact of....",
            style: ThemeTextStyles.textSemiBold,
          ),
          actions: const [
            ActionWidget(
              actionIcon: Icon(
                Icons.more_vert,
                color: Colors.white,
              ),
            )
          ],
        ),
        body: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 0),
          child: GridView.builder(
              itemCount: watchImpactList.length,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2, childAspectRatio: 4 / 5),
              itemBuilder: (_, index) {
                return InkWell(
                  onTap: () {
                    Get.to(const PlayVideoScreen());
                  },
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    child: Stack(
                      children: [
                        // Container(
                        //   color: Colors.grey,
                        // ),
                        ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: Image.asset(
                              watchImpactList[index].watchImage,
                              height: 230,
                              fit: BoxFit.fitHeight,
                            )),

                        const Positioned(
                          top: 65,
                          left: 60,
                          child: Icon(
                            Icons.play_circle_outline,
                            color: Colors.white,
                            size: 50,
                          ),
                        ),
                        Positioned(
                            //top: 150,
                            bottom: 30,
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: ThemeDimensions.defaultSize),
                              child: Text(
                                watchImpactList[index].watchName,
                                style: ThemeTextStyles.textMedium.copyWith(color: ThemeColors.white),
                              ),
                            )),
                      ],
                    ),
                  ),
                );
              }),
        ));
  }
}
