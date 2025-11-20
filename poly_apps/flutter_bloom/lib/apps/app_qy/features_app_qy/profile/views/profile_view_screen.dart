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
import 'package:qyflutter/common/widgets/outelineborder.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/views/prayer_screen.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/profile/domain/model/about_model.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/fundraising/views/fundrasing.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';

class ProfileViewScreen extends StatefulWidget {
  const ProfileViewScreen({super.key});

  @override
  State<ProfileViewScreen> createState() => _ProfileViewScreenState();
}

class _ProfileViewScreenState extends State<ProfileViewScreen> {
  int selectedindex = 0;

  void setSelectedIndex(int index) {
    setState(() {
      selectedindex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        appBar: AppBar(
          leading: Padding(
              padding: const EdgeInsets.all(8.0),
              child: Icon(
                Icons.arrow_back,
                color: Theme.of(context).colorScheme.surfaceTint,
              )),
          actions: [
            Icon(
              Icons.more_vert,
              color: Theme.of(context).colorScheme.surfaceTint,
            ),
            SizedBox(
              width: ThemeDimensions.spacing16,
            ),
          ],
          centerTitle: false,
          title: const Text("Profile"),
        ),
        body: Padding(
          padding: EdgeInsets.symmetric(
              horizontal: ThemeDimensions.paddingSizeDefault),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              SizedBox(
                height: ThemeDimensions.defaultSize,
              ),
              Center(
                child: CircleAvatar(
                  backgroundColor: Theme.of(context).hoverColor,
                  radius: ThemeDimensions.radiusBig,
                  child: Icon(
                    Icons.night_shelter_outlined,
                    color: Theme.of(context).colorScheme.surfaceTint,
                    size: ThemeDimensions.iconSizeOffline,
                  ),
                ),
              ),
              Padding(
                padding: EdgeInsets.symmetric(
                    vertical: ThemeDimensions.defaultSize),
                child: Text("Healthy Home",
                    style: ThemeTextStyles.title3),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  CustomCircular(
                    radius: ThemeDimensions.defaultSize,
                    outlineColor: Theme.of(context).hoverColor,
                    widget: Padding(
                      padding: EdgeInsets.all(ThemeDimensions.sizeFifteen),
                      child: Column(
                        children: [
                          Text(
                            "4.365",
                            style: ThemeTextStyles.title3Bold,
                          ),
                          SizedBox(
                            height: ThemeDimensions.defaultSize,
                          ),
                          Text(
                            "Fundraising",
                            style: ThemeTextStyles.body,
                          ),
                        ],
                      ),
                    ),
                  ),
                  CustomCircular(
                    radius: ThemeDimensions.defaultSize,
                    outlineColor: Theme.of(context).hoverColor,
                    widget: Padding(
                      padding: EdgeInsets.all(ThemeDimensions.sizeFifteen),
                      child: Column(
                        children: [
                          Text(
                            "67.5k",
                            style: ThemeTextStyles.title3Bold,
                          ),
                          SizedBox(
                            height: ThemeDimensions.defaultSize,
                          ),
                          Text(
                            "Followers",
                            style: ThemeTextStyles.body,
                          ),
                        ],
                      ),
                    ),
                  ),
                  CustomCircular(
                    radius: ThemeDimensions.defaultSize,
                    outlineColor: Theme.of(context).hoverColor,
                    widget: Padding(
                      padding: EdgeInsets.all(ThemeDimensions.sizeFifteen),
                      child: Column(
                        children: [
                          Text(
                            "186",
                            style: ThemeTextStyles.title3Bold,
                          ),
                          SizedBox(
                            height: ThemeDimensions.defaultSize,
                          ),
                          Text(
                            "Following",
                            style: ThemeTextStyles.body,
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  GestureDetector(
                    onTap: () {
                      setSelectedIndex(0);
                    },
                    child: CustomCircular(
                      bottomColor: (selectedindex == 0)
                          ? ThemeColors.green
                          : (selectedindex == 2)
                              ? ThemeColors.green
                              : (selectedindex == 3)
                                  ? ThemeColors.green
                                  : (selectedindex == 4)
                                      ? ThemeColors.green
                                      : ThemeColors.white,
                      outlineColor:
                          (selectedindex == 0) ? ThemeColors.white : ThemeColors.green,
                      radius: ThemeDimensions.radiusBig,
                      widget: Padding(
                          padding: EdgeInsets.symmetric(
                              vertical: ThemeDimensions.defaultSize,
                              horizontal: ThemeDimensions.largeExtraSize),
                          child: Text(
                            'Follower',
                            style: TextStyle(
                                color: (selectedindex == 0)
                                    ? ThemeColors.white
                                    : (selectedindex == 1)
                                        ? ThemeColors.green
                                        : ThemeColors.white),
                          )),
                    ),
                  ),
                  GestureDetector(
                    onTap: () {
                      setSelectedIndex(1);
                    },
                    child: CustomCircular(
                      bottomColor:
                          (selectedindex == 1) ? ThemeColors.green : ThemeColors.white,
                      outlineColor:
                          (selectedindex == 1) ? ThemeColors.white : ThemeColors.green,
                      radius: ThemeDimensions.radiusBig,
                      widget: Padding(
                          padding: EdgeInsets.symmetric(
                              vertical: ThemeDimensions.defaultSize,
                              horizontal: ThemeDimensions.largeExtraSize),
                          child: Text(
                            'Messages',
                            style: TextStyle(
                              color: (selectedindex == 1)
                                  ? ThemeColors.white
                                  : ThemeColors.green,
                            ),
                          )),
                    ),
                  ),
                ],
              ),
              SizedBox(
                height: ThemeDimensions.sizeTwentyFive,
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  GestureDetector(
                    onTap: () {
                      setSelectedIndex(2);
                    },
                    child: CustomCircular(
                      bottomColor: (selectedindex == 2)
                          ? ThemeColors.green
                          : (selectedindex == 0)
                              ? ThemeColors.green
                              : ThemeColors.white,
                      outlineColor:
                          (selectedindex == 2) ? ThemeColors.white : ThemeColors.green,
                      radius: ThemeDimensions.radiusBig,
                      widget: Padding(
                          padding: EdgeInsets.symmetric(
                              vertical: ThemeDimensions.defaultSize,
                              horizontal: ThemeDimensions.mediumSize),
                          child: Text(
                            'About',
                            style: TextStyle(
                              color: (selectedindex == 0)
                                  ? ThemeColors.white
                                  : (selectedindex == 2)
                                      ? ThemeColors.white
                                      : ThemeColors.green,
                            ),
                          )),
                    ),
                  ),
                  GestureDetector(
                    onTap: () {
                      setSelectedIndex(3);
                    },
                    child: CustomCircular(
                        bottomColor:
                            (selectedindex == 3) ? ThemeColors.green : ThemeColors.white,
                        outlineColor:
                            (selectedindex == 3) ? ThemeColors.white : ThemeColors.green,
                        radius: ThemeDimensions.radiusBig,
                        widget: Padding(
                            padding: EdgeInsets.symmetric(
                                vertical: ThemeDimensions.defaultSize,
                                horizontal: ThemeDimensions.mediumSize),
                            child: Text(
                              'Fundraising',
                              style: TextStyle(
                                color: (selectedindex == 3)
                                    ? ThemeColors.white
                                    : ThemeColors.green,
                              ),
                            ))),
                  ),
                  GestureDetector(
                    onTap: () {
                      setSelectedIndex(4);
                    },
                    child: CustomCircular(
                      bottomColor:
                          (selectedindex == 4) ? ThemeColors.green : ThemeColors.white,
                      outlineColor:
                          (selectedindex == 4) ? ThemeColors.white : ThemeColors.green,
                      radius: ThemeDimensions.radiusBig,
                      widget: Padding(
                          padding: EdgeInsets.symmetric(
                              vertical: ThemeDimensions.defaultSize,
                              horizontal: ThemeDimensions.defaultSize),
                          child: Text(
                            'Prayers',
                            style: TextStyle(
                              color: (selectedindex == 4)
                                  ? ThemeColors.white
                                  : ThemeColors.green,
                            ),
                          )),
                    ),
                  ),
                ],
              ),
              Padding(
                padding: EdgeInsets.symmetric(
                    vertical: ThemeDimensions.defaultSize),
                child: Align(
                    alignment: Alignment.topLeft,
                    child: selectedindex == 0
                        ? Text(
                            "About",
                            style: ThemeTextStyles.title3Bold,
                          )
                        : selectedindex == 2
                            ? Text(
                                "About",
                                style: ThemeTextStyles.title3Bold,
                              )
                            : selectedindex == 3
                                ? Text(
                                    "Fundraising",
                                    style: ThemeTextStyles.title3Bold,
                                  )
                                : Text(
                                    "Prayer",
                                    style: ThemeTextStyles.title3Bold,
                                  )),
              ),
              selectedindex == 0
                  ? Text(aboutData, style: ThemeTextStyles.body)
                  : selectedindex == 2
                      ? Text(aboutData,
                          style: ThemeTextStyles.body)
                      : selectedindex == 3
                          ? Fundraising()
                          : selectedindex == 4
                              ? const PrayerScreen()
                              : Text(aboutData,
                                  style: ThemeTextStyles.body),
            ],
          ),
        ));
  }
}
