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
import 'package:qyflutter/apps/app_qy/features_app_qy/home/domain/model/banner_model.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:smooth_page_indicator/smooth_page_indicator.dart';

class BannerWidget extends StatelessWidget {
  const BannerWidget({super.key});

  @override
  Widget build(BuildContext context) {
    PageController pageController = PageController();
    return Padding(
      padding:
          const EdgeInsets.symmetric(vertical: ThemeDimensions.paddingSizeDefault),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          color: Theme.of(context).cardColor,
        ),
        height: ThemeDimensions.bigExtraSize,
        child: Stack(children: [
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: PageView.builder(
              itemCount: sliderImage.length,
              controller: pageController,
              itemBuilder: (_, index) {
                return ClipRRect(
                    borderRadius: BorderRadius.circular(20),
                    child: Image.asset(
                      sliderImage[index],
                      fit: BoxFit.cover,
                    ));
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: Align(
              alignment: Alignment.bottomCenter,
              child: SmoothPageIndicator(
                  controller: pageController, // PageController
                  count: sliderImage.length,
                  effect: WormEffect(
                    dotHeight: 8,
                    dotWidth: 8,
                    dotColor: Theme.of(context).hintColor,
                    activeDotColor: Theme.of(context).colorScheme.surfaceTint,
                  ),
                  onDotClicked: (index) {}),
            ),
          ),
        ]),
      ),
    );
  }
}
