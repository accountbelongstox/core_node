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
import 'package:qyflutter/apps/app_qy/features_app_qy/home/domain/model/notification_model.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class NotificationScreen extends StatelessWidget {
  NotificationScreen({super.key});
  final List<Icon> notificationsIcon = [
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
  final List<Color> circularColor = [
    Colors.red,
    Colors.blue,
    Colors.green,
    Colors.yellow,
    Colors.orange,
    Colors.purple,
    Colors.teal,
    Colors.indigo,
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        appBar: AppBar(
          forceMaterialTransparency: true,
          elevation: 0,
          backgroundColor: Theme.of(context).cardColor,
          title: Text('Notifications', style: ThemeTextStyles.title1),
          actions: const [
            Padding(
              padding: EdgeInsets.all(8.0),
              child: Icon(
                Icons.more_vert,
                color: Colors.green,
              ),
            )
          ],
        ),
        body: notificationList.isEmpty
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
                    SizedBox(
                      height: ThemeDimensions.spacing16,
                    ),
                    Text("You have no notification",
                        style: ThemeTextStyles.title3Bold),
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
                          borderRadius:
                              BorderRadius.circular(ThemeDimensions.radiusM),
                          border: Border.all(
                              width: 1.5, color: Colors.grey.withValues(alpha: 0.1))
                          // borderRadius: BorderRadius.circular(10),
                          // color: Theme.of(context).hoverColor,
                          ),
                      child: ListTile(
                        leading: CircleAvatar(
                            radius: 25,
                            backgroundColor: circularColor[index],
                            child: Icon(notificationsIcon[index].icon)),
                        title: Text(
                          notificationList[index].notificationTitle,
                          style: ThemeTextStyles.bodyBold,
                        ),
                        subtitle:
                            Text(notificationList[index].notificationBody),
                      ),
                    ),
                  );
                }));
  }
}
