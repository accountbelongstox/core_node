import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_example/features_app_example/inbox/domain/model/inbox_model.dart';
import 'package:qyflutter/apps/app_example/router_app_example/routes_provider_app_example.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:get/get.dart';

class InBoxScreenView extends StatelessWidget {
  const InBoxScreenView({super.key});

  @override
  Widget build(BuildContext context) {
    // Using common text styles directly
    return Scaffold(
        appBar: AppBar(
          forceMaterialTransparency: true,
          title: Text(
            'Inbox',
            style: ThemeTextStyles.appNavigation,
          ),
        ),
        body: Padding(
          padding: const EdgeInsets.all(ThemeDimensions.defaultSize),
          child: Column(
            children: [
              const SizedBox(height: ThemeDimensions.defaultSize),
              Container(
                decoration: BoxDecoration(
                    color: Theme.of(context).hintColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(ThemeDimensions.radiusBig)),
                child: const TextField(
                  decoration: InputDecoration(
                      contentPadding: EdgeInsets.symmetric(
                          vertical: ThemeDimensions.defaultSize,
                          horizontal: ThemeDimensions.defaultSize),
                      border: OutlineInputBorder(
                        borderSide: BorderSide.none,
                        borderRadius: BorderRadius.all(Radius.circular(50)),
                      ),
                      hintText: 'Search',
                      suffixIcon: Icon(Icons.search)),
                ),
              ),
              Expanded(
                  child: ListView.builder(
                      itemCount: inboxUsersList.length,
                      itemBuilder: (_, index) {
                        return InkWell(
                          onTap: () {
                            Get.toNamed(ExampleAppRoutesProvider.routeChat);
                          },
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                                vertical: ThemeDimensions.paddingSizeExtraSmall),
                            child: Container(
                              decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(
                                      ThemeDimensions.defaultSize),
                                  border: Border.all(
                                      width: 1.5,
                                      color: Colors.grey.withOpacity(0.2))),
                              child: Padding(
                                padding: const EdgeInsets.all(8.0),
                                child: Row(
                                  children: [
                                    CircleAvatar(
                                        radius: ThemeDimensions.sizeTwentyFive,
                                        backgroundColor: Colors.grey,
                                        backgroundImage: AssetImage(
                                            inboxUsersList[index].userImage)),
                                    const SizedBox(
                                        width: ThemeDimensions.defaultSize),
                                    Expanded(
                                      child: Row(
                                        children: [
                                          Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                inboxUsersList[index].userName,
                                                style: ThemeTextStyles.textBold,
                                              ),
                                              const SizedBox(
                                                  height: ThemeDimensions
                                                      .paddingSizeExtraSmall),
                                              Text(
                                                inboxUsersList[index].message,
                                                style: ThemeTextStyles.textMedium,
                                              ),
                                            ],
                                          )
                                        ],
                                      ),
                                    ),
                                    Text(inboxUsersList[index].dateTime,
                                        style: ThemeTextStyles.textMedium),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        );
                      }))
            ],
          ),
        ));
  }
}
