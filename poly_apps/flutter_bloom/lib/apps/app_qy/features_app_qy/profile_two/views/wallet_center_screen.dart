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
import 'package:qyflutter/apps/app_qy/features_app_qy/home/domain/model/notification_model.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/widget/actions_widget.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:get/get.dart';

import 'top_up_screen.dart';
import 'withdraw_screen.dart';

class WalletCenterScreen extends StatefulWidget {
  const WalletCenterScreen({super.key});

  @override
  State<WalletCenterScreen> createState() => _WalletCenterScreenState();
}

class _WalletCenterScreenState extends State<WalletCenterScreen> {
  int selectedindex = 0;
  List<Icon> notificationsicon = [
    const Icon(
      Icons.check_circle,
    ),
    const Icon(Icons.cancel_rounded),
    const Icon(Icons.check_circle),
    const Icon(Icons.cancel_rounded),
    const Icon(Icons.check_circle),
    const Icon(Icons.cancel_rounded),
    const Icon(Icons.check_circle),
    const Icon(Icons.cancel_rounded),
  ];
  List<Color> circularcolor = [
    Colors.red,
    Colors.blue,
    Colors.green,
    Colors.yellow,
    Colors.orange,
    Colors.purple,
    Colors.teal,
    Colors.indigo,
  ];

  void setSelectedIndex(int index) {
    setState(() {
      selectedindex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Wallet Center"),
        actions: const [
          ActionWidget(
              actionIcon: Icon(
            Icons.more_vert,
            color: Colors.white,
          )),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: ThemeDimensions.defaultSize),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: double.infinity,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(15),
                border: Border.all(width: 1.5, color: Colors.green),
              ),
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(vertical: ThemeDimensions.fortySize),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Text(
                      "\$346",
                      style:
                          ThemeTextStyles.textBold.copyWith(fontSize: 24, color: Colors.green),
                    ),
                    const SizedBox(
                      height: ThemeDimensions.defaultSize,
                    ),
                    const Text('Balance'),
                  ],
                ),
              ),
            ),
            const SizedBox(
              height: ThemeDimensions.defaultSize,
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                GestureDetector(
                  onTap: () {
                    setSelectedIndex(0);
                    Get.to(const TopUpScreenView());
                  },
                  child: CustomCircular(
                    bottomColor: (selectedindex == 0)
                        ? Colors.green
                        : (selectedindex == 2)
                            ? Colors.green
                            : (selectedindex == 1)
                                ? Colors.green
                                : (selectedindex == 4)
                                    ? Colors.green
                                    : Colors.white,
                    outlineColor:
                        (selectedindex == 0) ? Colors.green : Colors.green,
                    radius: ThemeDimensions.radiusBig,
                    widget: Padding(
                        padding: const EdgeInsets.symmetric(
                            vertical: ThemeDimensions.defaultSize,
                            horizontal: ThemeDimensions.largeExtraSize),
                        child: Row(
                          children: [
                            Icon(Icons.arrow_circle_up,
                                color: (selectedindex == 0)
                                    ? Colors.green
                                    : (selectedindex == 1)
                                        ? Colors.white
                                        : Colors.green),
                            const SizedBox(
                              width: ThemeDimensions.defaultSize,
                            ),
                            Text(
                              'Top up',
                              style: ThemeTextStyles.textBold.copyWith(
                                  fontSize: 16,
                                  color: (selectedindex == 0)
                                      ? Colors.white
                                      : (selectedindex == 1)
                                          ? Colors.green
                                          : Colors.green),
                            ),
                          ],
                        )),
                  ),
                ),
                GestureDetector(
                  onTap: () {
                    setSelectedIndex(3);
                    Get.to(const WithDrawScreenView());
                  },
                  child: CustomCircular(
                      bottomColor:
                          (selectedindex == 3) ? Colors.green : Colors.white,
                      outlineColor:
                          (selectedindex == 3) ? Colors.white : Colors.green,
                      radius: ThemeDimensions.radiusBig,
                      widget: Padding(
                          padding: const EdgeInsets.symmetric(
                              vertical: ThemeDimensions.defaultSize,
                              horizontal: ThemeDimensions.mediumSize),
                          child: Row(
                            children: [
                              Icon(Icons.arrow_circle_down,
                                  color: (selectedindex == 0)
                                      ? Colors.green
                                      : (selectedindex == 1)
                                          ? Colors.white
                                          : Colors.white),
                              const SizedBox(
                                width: ThemeDimensions.defaultSize,
                              ),
                              Text(
                                'Withdraw',
                                style: ThemeTextStyles.textBold.copyWith(
                                    fontSize: 16,
                                    color: (selectedindex == 0)
                                        ? Colors.green
                                        : (selectedindex == 1)
                                            ? Colors.white
                                            : Colors.white),
                              ),
                            ],
                          ))),
                ),
              ],
            ),
            Padding(
              padding:
                  const EdgeInsets.symmetric(vertical: ThemeDimensions.sizeFifteen),
              child: Text(
                "Activity",
                style: ThemeTextStyles.textBold.copyWith(fontSize: 18),
              ),
            ),
            Text(
              "Today,December 25, 2025",
              style: ThemeTextStyles.textRegular.copyWith(fontSize: 18),
            ),
            Expanded(
                child: notificationList.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            CircleAvatar(
                              radius: 50,
                              backgroundColor:
                                  Theme.of(context).colorScheme.surfaceTint,
                              child: const Icon(
                                Icons.notifications,
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(
                              height: ThemeDimensions.sizeFifteen,
                            ),
                            Text("You have no notification",
                                style: ThemeTextStyles.textBold.copyWith(
                                    color: Colors.green, fontSize: 18)),
                          ],
                        ),
                      )
                    : ListView.builder(
                        itemCount: notificationList.length,
                        itemBuilder: (_, index) {
                          return Padding(
                            padding: const EdgeInsets.all(8.0),
                            child: Container(
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(10),
                                color: Theme.of(context).hoverColor,
                              ),
                              child: ListTile(
                                leading: CircleAvatar(
                                    radius: 25,
                                    backgroundColor: circularcolor[index],
                                    child: Icon(notificationsicon[index].icon)),
                                title: Text(
                                  notificationList[index].notificationTitle,
                                  style: ThemeTextStyles.textBold,
                                ),
                                subtitle: Text(
                                    notificationList[index].notificationBody),
                              ),
                            ),
                          );
                        }))
          ],
        ),
      ),
    );
  }
}
