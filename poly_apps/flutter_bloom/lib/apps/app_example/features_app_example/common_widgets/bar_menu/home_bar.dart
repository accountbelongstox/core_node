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
import 'package:qyflutter/common/widgets/custom_search_input.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/apps/app_example/router_app_example/routes_provider_app_example.dart';

class HomeBar extends StatelessWidget implements PreferredSizeWidget {
  final VoidCallback onMenuTap;

  const HomeBar({
    super.key,
    required this.onMenuTap,
  });

  @override
  Widget build(BuildContext context) {
    return AppBar(
      forceMaterialTransparency: false,
      backgroundColor: Theme.of(context).colorScheme.primary,
      leading: Padding(
        padding: const EdgeInsets.all(8.0),
        child: GestureDetector(
          onTap: onMenuTap,
          child: CircleAvatar(
            backgroundColor:
                Theme.of(context).colorScheme.onPrimary.withAlpha(51),
            child: Icon(
              Icons.dashboard,
              color: Theme.of(context).colorScheme.onPrimary,
            ),
          ),
        ),
      ),
      titleSpacing: 0,
      title: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8.0),
        child: SizedBox(
          height: 40,
          child: CustomSearchInput(
            search_placeholder: 'search_placeholder'.tr(context),
            borderColor: Theme.of(context).colorScheme.onPrimary.withAlpha(128),
            textColor: Theme.of(context).colorScheme.onPrimary,
            backgroundColor: Colors.transparent,
            borderWidth: 1.0,
            onTap: () {
              showDialog(
                context: context,
                builder: (BuildContext context) {
                  return AlertDialog(
                    title: Text('search'.tr(context)),
                    content: CustomSearchInput(
                      search_placeholder: 'enter_search_text'.tr(context),
                      borderColor: Theme.of(context).colorScheme.primary,
                      textColor: Theme.of(context).colorScheme.onSurface,
                      backgroundColor: Colors.transparent,
                      borderWidth: 1.0,
                      onChanged: (value) {},
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => context.pop(),
                        child: Text('cancel'.tr(context)),
                      ),
                      TextButton(
                        onPressed: () {
                          context.pop();
                          // Note: routeProfileTwo doesn't exist, using routeProfile instead
                          context.push(ExampleAppRoutesProvider.routeProfile);
                        },
                        child: Text('search'.tr(context)),
                      ),
                    ],
                  );
                },
              );
            },
          ),
        ),
      ),
      actions: [
        ActionWidget(
            onTap: () {
              // Note: routeNotificationSettings doesn't exist, using routeNotifications instead
              context.push(ExampleAppRoutesProvider.routeNotifications);
            },
            actionIcon: Icon(
              Icons.notifications,
              color: Theme.of(context).colorScheme.onPrimary,
            )),
        ActionWidget(
            onTap: () {
              // Note: Using routeBookmarks (plural) as defined in routes provider
              context.push(ExampleAppRoutesProvider.routeBookmarks);
            },
            actionIcon: Icon(
              Icons.bookmark,
              color: Theme.of(context).colorScheme.onPrimary,
            )),
        Padding(
            padding: const EdgeInsets.all(8.0),
            child: IconButton(
                color: Theme.of(context).colorScheme.onPrimary,
                icon: Icon(Icons.more_vert,
                    color: Theme.of(context).colorScheme.onPrimary),
                onPressed: () {
                  // Note: routeSettingView doesn't exist, using routeSettings instead
                  context.push(ExampleAppRoutesProvider.routeSettings);
                }))
      ],
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
}

class ActionWidget extends StatelessWidget {
  final VoidCallback onTap;
  final Widget actionIcon;

  const ActionWidget({
    super.key,
    required this.onTap,
    required this.actionIcon,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(8.0),
      child: GestureDetector(
        onTap: onTap,
        child: CircleAvatar(
          backgroundColor:
              Theme.of(context).colorScheme.onPrimary.withAlpha(51),
          child: actionIcon,
        ),
      ),
    );
  }
}
