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