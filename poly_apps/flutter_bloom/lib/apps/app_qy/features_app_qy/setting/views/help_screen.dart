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
import 'package:qyflutter/apps/app_qy/features_app_qy/setting/widgets/notification_setting_widget.dart';
import 'package:qyflutter/apps/app_qy/router_app_qy/routes_provider_app_qy.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:get/get.dart';

class HelpScreenView extends StatelessWidget {
  HelpScreenView({super.key});
  final List helpCardsNames = [
    "Facebook",
    'Twitter',
    'YouTube',
    'Website',
  ];
  final List bodyText = [
    "FQA",
    "Contact us",
    "Themes & Conditions",
    "Privacy Policy",
    "About Us"
  ];
  final List image = [
    "assets/common_images/facebook.png",
    "assets/common_images/twitter.png",
    "assets/common_images/youtube.png",
    "assets/common_images/website.png",
  ];
  @override
  Widget build(BuildContext context) {
    return Scaffold(
        appBar: AppBar(
          title: const Text(
            'Help',
            style: ThemeTextStyles.textMedium,
          ),
        ),
        body: Padding(
          padding: const EdgeInsets.all(ThemeDimensions.defaultSize),
          child: Column(
            children: [
              Expanded(
                // flex: 1,
                child: GridView.builder(
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                            childAspectRatio: 2 / 1.5, crossAxisCount: 2),
                    itemCount: image.length,
                    itemBuilder: (_, index) {
                      return Padding(
                        padding: const EdgeInsets.all(8.0),
                        child: Container(
                          decoration: BoxDecoration(
                              borderRadius:
                                  BorderRadius.circular(ThemeDimensions.defaultSize),
                              color: Colors.green.withOpacity(0.9)),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: [
                              Image.asset(
                                image[index],
                                height: 50,
                                width: 60,
                              ),
                              //const Icon(Icons.face_2_outlined,color: Colors.white,),
                              const SizedBox(
                                height: ThemeDimensions.defaultSize,
                              ),
                              Text(
                                helpCardsNames[index],
                                style:
                                    ThemeTextStyles.contentSubtitle.copyWith(color: Colors.white),
                              ),
                            ],
                          ),
                        ),
                      );
                    }),
              ),
              Expanded(
                child: ListView.builder(
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: bodyText.length,
                    itemBuilder: (_, index) {
                      return Padding(
                        padding: const EdgeInsets.symmetric(
                            vertical: ThemeDimensions.paddingSizeExtraSmall),
                        child: CustomSettingCard(
                          title: "${bodyText[index]}",
                          icon: const Icon(
                            Icons.arrow_forward_ios_sharp,
                            color: Colors.green,
                          ),
                          ontap: () {
                            if (bodyText[index] == "FQA") {
                              Get.toNamed(QyAppRoutesProvider.routeHelp); // Using help route for FAQ
                            } else if (bodyText[index] == "Contact us") {
                              Get.toNamed(QyAppRoutesProvider.routeHelp); // Using help route for Contact
                            } else if (bodyText[index] ==
                                "Themes & Conditions") {
                              Get.toNamed(QyAppRoutesProvider.routeHelp); // Using help route for Terms
                            } else if (bodyText[index] == "Privacy Policy") {
                              Get.toNamed(QyAppRoutesProvider.routeHelp); // Using help route for Privacy
                            } else if (bodyText[index] == "About Us") {
                              // Updated: Now using correct routeAbout which exists in routes provider
                              Get.toNamed(QyAppRoutesProvider.routeAbout);
                            }
                          },
                        ),
                      );
                    }),
              )
            ],
          ),
        ));
  }
}
