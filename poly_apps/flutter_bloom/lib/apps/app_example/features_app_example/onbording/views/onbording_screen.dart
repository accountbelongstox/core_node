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
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:qyflutter/apps/app_example/features_app_example/authentication/views/welcom_screen.dart';
import 'package:qyflutter/apps/app_example/features_app_example/onbording/model/on_boarding_model.dart';
// Updated: Dimensions class still in util/dimensions.dart but now uses new ResponsiveHelper
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/utils/web/web_tools.dart';
import 'package:get/get.dart';
import 'package:smooth_page_indicator/smooth_page_indicator.dart';
import 'package:go_router/go_router.dart';

class OnbordingView extends StatefulWidget {
  const OnbordingView({super.key});
  @override
  State<OnbordingView> createState() => _IntoScreenState();
}

class _IntoScreenState extends State<OnbordingView> {
  final webTools = getWebTools();
  final PageController pagcontroller = PageController();
  var skiptextstyle = const TextStyle(
      fontSize: 16, fontWeight: FontWeight.w600, color: Colors.green);
  bool lastpage = false;

  @override
  void initState() {
    super.initState();
    if (kIsWeb) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        showDialog(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Platform Info'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Platform: Web'),
                Text(
                    'In iframe: ${webTools.isWebAndInIframe() ? 'Yes' : 'No'}'),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => context.pop(),
                child: const Text('OK'),
              ),
            ],
          ),
        );
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          PageView.builder(
            itemCount: onBoardingData.length,
            itemBuilder: (context, index) {
              return Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                      child:
                          Image.asset(onBoardingData[index].onBoardingImage)),
                  Expanded(
                    child: Container(
                      width: double.maxFinite,
                      decoration: BoxDecoration(
                          color: Theme.of(context).cardColor,
                          borderRadius: const BorderRadius.only(
                              topLeft: Radius.circular(30),
                              topRight: Radius.circular(30))),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Text(
                            "_____",
                            style: TextStyle(
                                color: Theme.of(context).hintColor,
                                fontSize: 20,
                                fontWeight: FontWeight.bold),
                          ),
                          Padding(
                            padding: const EdgeInsets.all(
                                ThemeDimensions.paddingSizeSmall),
                            child: Text(
                              onBoardingData[index].onBoardingTitle,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w500,
                                  color: Colors.black),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.all(
                                ThemeDimensions.paddingSizeSmall),
                            child: Text(onBoardingData[index].onBoardingBody,
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w400,
                                    color: Colors.black)),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              );
            },
            controller: pagcontroller,
            onPageChanged: (value) {
              setState(() {
                lastpage = (value == 2);
              });
            },
          ),
          Padding(
            padding: const EdgeInsets.all(ThemeDimensions.paddingSizeLarge),
            child: Align(
              alignment: Alignment.bottomCenter,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  SmoothPageIndicator(
                      controller: pagcontroller, // PageController
                      count: 3,
                      effect: WormEffect(
                        dotColor: Theme.of(context).hintColor,
                        activeDotColor:
                            Theme.of(context).colorScheme.surfaceTint,
                      ),
                      // your preferred effect
                      onDotClicked: (index) {}),
                  Padding(
                    padding: const EdgeInsets.symmetric(
                        vertical: ThemeDimensions.paddingSizeLarge),
                    child: InkWell(
                      onTap: () {
                        Get.to(() => const WelcomeScreenView());
                      },
                      child: Text(
                        "SKIP",
                        style: skiptextstyle,
                      ),
                    ),
                  ),
                  lastpage
                      ? InkWell(
                          onTap: () {
                            Get.to(() => const WelcomeScreenView());
                          },
                          child: Container(
                            height: ThemeDimensions.largeExtraSize,
                            width: double.infinity,
                            decoration: BoxDecoration(
                                color:
                                    Theme.of(context).colorScheme.surfaceTint,
                                borderRadius: BorderRadius.circular(
                                    ThemeDimensions.radiusBig)),
                            child: Center(
                              child: Text(
                                "Next",
                                style: skiptextstyle.copyWith(
                                    color: Theme.of(context).cardColor),
                              ),
                            ),
                          ),
                        )
                      : InkWell(
                          onTap: () {
                            pagcontroller.nextPage(
                                duration: const Duration(
                                  milliseconds: 50,
                                ),
                                curve: Curves.bounceIn);
                          },
                          child: Container(
                            height: ThemeDimensions.largeExtraSize,
                            width: double.infinity,
                            decoration: BoxDecoration(
                                color:
                                    Theme.of(context).colorScheme.surfaceTint,
                                borderRadius: BorderRadius.circular(
                                    ThemeDimensions.radiusBig)),
                            child: Center(
                              child: Text(
                                "Next",
                                style: skiptextstyle.copyWith(
                                    color: Theme.of(context).cardColor),
                              ),
                            ),
                          ),
                        )
                ],
              ),
            ),
          )
        ],
      ),
    );
  }
}
