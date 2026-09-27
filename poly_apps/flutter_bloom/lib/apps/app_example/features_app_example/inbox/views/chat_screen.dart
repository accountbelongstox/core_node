import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class ChatScreenView extends StatelessWidget {
  const ChatScreenView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        appBar: AppBar(
          title: Text(
            "Person name",
            style: ThemeTextStyles.appNavigation,
          ),
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(ThemeDimensions.defaultSize),
            child: Column(
              children: [
                const Spacer(),
                Align(
                  alignment: Alignment.bottomCenter,
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius:
                          BorderRadius.circular(ThemeDimensions.sizeTwenty),
                      border: Border.all(
                          width: 1.5,
                          color: Theme.of(context).colorScheme.surfaceTint),
                      color: Theme.of(context).cardColor,
                    ),
                    child: TextField(
                      expands: false,
                      decoration: InputDecoration(
                          contentPadding:
                              const EdgeInsets.all(ThemeDimensions.defaultSize),
                          hintText: "Enter your message",
                          hintStyle: ThemeTextStyles.contentBody,
                          suffixIcon: Icon(
                            Icons.send,
                            color: Theme.of(context).colorScheme.surfaceTint,
                          )),
                    ),
                  ),
                )
              ],
            ),
          ),
        ));
  }
}
