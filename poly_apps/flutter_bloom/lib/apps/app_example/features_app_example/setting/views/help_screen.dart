import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_example/features_app_example/setting/widgets/notification_setting_widget.dart';
import 'package:qyflutter/apps/app_example/router_app_example/routes_provider_app_example.dart';
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
                              Get.toNamed(ExampleAppRoutesProvider.routeHelp); // Using help route for FAQ
                            } else if (bodyText[index] == "Contact us") {
                              Get.toNamed(ExampleAppRoutesProvider.routeHelp); // Using help route for Contact
                            } else if (bodyText[index] ==
                                "Themes & Conditions") {
                              Get.toNamed(ExampleAppRoutesProvider.routeHelp); // Using help route for Terms
                            } else if (bodyText[index] == "Privacy Policy") {
                              Get.toNamed(ExampleAppRoutesProvider.routeHelp); // Using help route for Privacy
                            } else if (bodyText[index] == "About Us") {
                              // Updated: Now using correct routeAbout which exists in routes provider
                              Get.toNamed(ExampleAppRoutesProvider.routeAbout);
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
