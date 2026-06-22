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
import 'package:qyflutter/apps/app_example/features_app_example/setting/domain/model/invite_friend_model.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class InvitedFriendScreen extends StatelessWidget {
  const InvitedFriendScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        appBar: AppBar(
          title: Text(
            "Invited Friend",
            style: ThemeTextStyles.title1,
          ),
        ),
        body: ListView.builder(
            itemCount: inviteFriendModelList.length,
            itemBuilder: (_, index) {
              return Padding(
                padding: EdgeInsets.symmetric(
                    horizontal: ThemeDimensions.spacing16,
                    vertical: ThemeDimensions.spacing8),
                child: Container(
                  decoration: BoxDecoration(
                      border: Border.all(
                        width: 1.9,
                        color: Theme.of(context).canvasColor,
                      ),
                      borderRadius: BorderRadius.circular(10)),
                  child: Padding(
                    padding: ThemeDimensions.paddingM,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          width: 60.0,
                          height: 60.0,
                          decoration: BoxDecoration(
                            color: Theme.of(context).colorScheme.surfaceTint,
                            shape: BoxShape.rectangle,
                            borderRadius: BorderRadius.circular(10),
                            image: DecorationImage(
                              image: AssetImage(
                                  inviteFriendModelList[index].userImage),
                              fit: BoxFit.cover,
                            ),
                          ),
                        ),
                        SizedBox(width: ThemeDimensions.spacing16),
                        Expanded(
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(inviteFriendModelList[index].userName,
                                      style: ThemeTextStyles.title3Bold),
                                  Text(inviteFriendModelList[index].userNumber,
                                      style: ThemeTextStyles.body),
                                ],
                              ),
                              CustomCircular(
                                radius: ThemeDimensions.radiusL,
                                outlineColor:
                                    Theme.of(context).colorScheme.surfaceTint,
                                widget: Padding(
                                    padding: EdgeInsets.symmetric(
                                        vertical: ThemeDimensions.spacing8,
                                        horizontal: ThemeDimensions.spacing20),
                                    child:
                                        Text("Invite", style: ThemeTextStyles.calloutBold)),
                              )
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }));
  }
}
