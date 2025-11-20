// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/widgets/custom_search_input.dart';

class DiscoverAppBar extends StatelessWidget implements PreferredSizeWidget {
  final bool showSearch;
  final VoidCallback? onSearchToggle;
  final Function(String)? onSearchChanged;
  final VoidCallback? onRefresh;

  const DiscoverAppBar({
    super.key,
    this.showSearch = false,
    this.onSearchToggle,
    this.onSearchChanged,
    this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    return AppBar(
      title: showSearch
        ? CustomSearchInput(
            search_placeholder: 'achat_search'.tr(context),
            onChanged: onSearchChanged ?? (value) {},
          )
        : Text(
            'achat_tab_discover'.tr(context),
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              color: Theme.of(context).appBarTheme.foregroundColor,
              fontWeight: FontWeight.bold,
            ),
          ),
      backgroundColor: Theme.of(context).appBarTheme.backgroundColor,
      elevation: 0,
      leading: showSearch
        ? IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: onSearchToggle,
          )
        : null,
      actions: showSearch
        ? null
        : [
            IconButton(
              icon: const Icon(Icons.search),
              onPressed: onSearchToggle,
              tooltip: 'achat_search'.tr(context),
            ),
            IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: onRefresh,
              tooltip: 'Refresh',
            ),
          ],
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
}