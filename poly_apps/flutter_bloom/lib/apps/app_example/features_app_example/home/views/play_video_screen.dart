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
// import 'package:qyflutter/theme/assets_icons.dart';
import 'package:percent_indicator/percent_indicator.dart';
import 'package:qyflutter/common/assets/common_assets_images.dart';

class PlayVideoScreen extends StatelessWidget {
  const PlayVideoScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(),
      body: Column(
        children: [
          const Image(
              image: AssetImage(
            CommonAssetsImages.baby1,
          )),
          const Spacer(),
          Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: ThemeDimensions.defaultSize),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text("Video to play"),
                LinearPercentIndicator(
                    barRadius: const Radius.circular(10),
                    lineHeight: 8.0,
                    percent: 0.10,
                    progressColor: Theme.of(context).colorScheme.surfaceTint),
                const Padding(
                  padding:
                      EdgeInsets.symmetric(vertical: ThemeDimensions.defaultSize),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text("0:32/10:52"),
                      Icon(
                        Icons.arrow_back_ios,
                        color: Colors.green,
                        size: 20,
                      ),
                      Icon(
                        Icons.play_circle_outline,
                        color: Colors.green,
                        size: 40,
                      ),
                      Icon(
                        Icons.arrow_forward_ios,
                        color: Colors.green,
                        size: 20,
                      ),
                      Icon(
                        Icons.volume_down_sharp,
                        color: Colors.green,
                        size: 30,
                      ),
                      Icon(
                        Icons.settings,
                        color: Colors.green,
                        size: 20,
                      ),
                    ],
                  ),
                )
              ],
            ),
          ),
          const SizedBox(
            height: ThemeDimensions.topSpace,
          ),
        ],
      ),
    );
  }
}
