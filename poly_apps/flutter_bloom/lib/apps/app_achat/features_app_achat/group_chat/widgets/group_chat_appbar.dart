import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class GroupChatAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String groupName;
  final String groupMembers;
  final VoidCallback? onSearch;
  final VoidCallback? onMore;

  const GroupChatAppBar({
    super.key,
    this.groupName = '',
    this.groupMembers = '',
    this.onSearch,
    this.onMore,
  });

  @override
  Widget build(BuildContext context) {
    return AppBar(
      systemOverlayStyle: SystemUiOverlayStyle.dark,
      elevation: 0,
      backgroundColor: ThemeColors.primary,
      leading: IconButton(
        icon: Icon(
          Icons.arrow_back,
          color: ThemeColors.white,
          size: ThemeDimensions.iconSizeMedium,
        ),
        onPressed: () => Navigator.of(context).pop(),
      ),
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            groupName.isNotEmpty ? groupName : 'achat_group_chat_default_name'.tr(context),
            style: ThemeTextStyles.titleMedium.copyWith(
              color: ThemeColors.white,
              fontWeight: FontWeight.w500,
            ),
          ),
          Text(
            groupMembers.isNotEmpty ? groupMembers : 'achat_group_chat_default_members'.tr(context),
            style: ThemeTextStyles.bodySmall.copyWith(
              color: ThemeColors.white.withValues(alpha: 0.7),
            ),
          ),
        ],
      ),
      actions: [
        IconButton(
          icon: Icon(
            Icons.search,
            color: ThemeColors.white,
            size: ThemeDimensions.iconSizeMedium,
          ),
          onPressed: onSearch,
          tooltip: 'achat_group_chat_search_tooltip'.tr(context),
        ),
        IconButton(
          icon: Icon(
            Icons.more_horiz,
            color: ThemeColors.white,
            size: ThemeDimensions.iconSizeMedium,
          ),
          onPressed: onMore,
          tooltip: 'achat_group_chat_more_tooltip'.tr(context),
        ),
      ],
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
} 
