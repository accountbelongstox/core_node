import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class FeedHeader extends StatelessWidget implements PreferredSizeWidget {
  final TabController tabController;
  final VoidCallback onFilterTap;

  const FeedHeader({
    super.key,
    required this.tabController,
    required this.onFilterTap,
  });

  @override
  Widget build(BuildContext context) {
    return AppBar(
      elevation: 0,
      title: TabBar(
        controller: tabController,
        isScrollable: true,
        labelStyle: ThemeTextStyles.contentSubtitle,
        unselectedLabelStyle: ThemeTextStyles.contentBody,
        tabs: const [
          Tab(text: 'All'),
          Tab(text: 'Photos'),
          Tab(text: 'Videos'),
          Tab(text: 'Posts'),
        ],
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.filter_list),
          onPressed: onFilterTap,
        ),
      ],
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
}
