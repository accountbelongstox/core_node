import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';

/// Custom list tile with enhanced styling
class StyledListTile extends StatelessWidget {
  final Widget? leading;
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;
  final Color? backgroundColor;
  final EdgeInsetsGeometry? padding;

  const StyledListTile({
    super.key,
    this.leading,
    required this.title,
    this.subtitle,
    this.trailing,
    this.onTap,
    this.backgroundColor,
    this.padding,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      color: backgroundColor,
      elevation: 0,
      child: ListTile(
        leading: leading,
        title: Text(
          title,
          style: ThemeTextStyles.bodyLarge,
        ),
        subtitle: subtitle != null
            ? Text(
                subtitle!,
                style: ThemeTextStyles.bodyMedium.copyWith(
                  color: ThemeColors.neutralGrey,
                ),
              )
            : null,
        trailing: trailing ??
            (onTap != null
                ? Icon(
                    Icons.chevron_right,
                    color: ThemeColors.neutralGrey,
                  )
                : null),
        onTap: onTap,
        contentPadding: padding ??
            EdgeInsets.symmetric(
              horizontal: ThemeDimensions.defaultPadding,
              vertical: ThemeDimensions.smallPadding,
            ),
      ),
    );
  }
}

/// Icon list tile with circular icon background
class IconListTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;
  final Color? iconColor;
  final Color? iconBackgroundColor;

  const IconListTile({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.trailing,
    this.onTap,
    this.iconColor,
    this.iconBackgroundColor,
  });

  @override
  Widget build(BuildContext context) {
    final color = iconColor ?? ThemeColors.primaryBlue;
    final bgColor = iconBackgroundColor ?? color.withOpacity(0.1);

    return StyledListTile(
      leading: Container(
        width: 48,
        height: 48,
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
        ),
        child: Icon(
          icon,
          color: color,
          size: 24,
        ),
      ),
      title: title,
      subtitle: subtitle,
      trailing: trailing,
      onTap: onTap,
    );
  }
}

/// Settings list tile with switch
class SettingsSwitchTile extends StatelessWidget {
  final String title;
  final String? subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;
  final IconData? icon;
  final Color? activeColor;

  const SettingsSwitchTile({
    super.key,
    required this.title,
    this.subtitle,
    required this.value,
    required this.onChanged,
    this.icon,
    this.activeColor,
  });

  @override
  Widget build(BuildContext context) {
    return SwitchListTile(
      secondary: icon != null
          ? Icon(
              icon,
              color: value
                  ? (activeColor ?? ThemeColors.primaryBlue)
                  : ThemeColors.neutralGrey,
            )
          : null,
      title: Text(
        title,
        style: ThemeTextStyles.bodyLarge,
      ),
      subtitle: subtitle != null
          ? Text(
              subtitle!,
              style: ThemeTextStyles.bodySmall.copyWith(
                color: ThemeColors.neutralGrey,
              ),
            )
          : null,
      value: value,
      onChanged: onChanged,
      activeColor: activeColor ?? ThemeColors.primaryBlue,
      contentPadding: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.defaultPadding,
      ),
    );
  }
}

/// Expandable list tile
class ExpandableListTile extends StatefulWidget {
  final String title;
  final IconData? icon;
  final List<Widget> children;
  final bool initiallyExpanded;

  const ExpandableListTile({
    super.key,
    required this.title,
    this.icon,
    required this.children,
    this.initiallyExpanded = false,
  });

  @override
  State<ExpandableListTile> createState() => _ExpandableListTileState();
}

class _ExpandableListTileState extends State<ExpandableListTile> {
  late bool _isExpanded;

  @override
  void initState() {
    super.initState();
    _isExpanded = widget.initiallyExpanded;
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      elevation: 0,
      child: Column(
        children: [
          ListTile(
            leading: widget.icon != null
                ? Icon(
                    widget.icon,
                    color: ThemeColors.primaryBlue,
                  )
                : null,
            title: Text(
              widget.title,
              style: ThemeTextStyles.bodyLarge.copyWith(
                fontWeight: FontWeight.w500,
              ),
            ),
            trailing: Icon(
              _isExpanded ? Icons.expand_less : Icons.expand_more,
              color: ThemeColors.neutralGrey,
            ),
            onTap: () {
              setState(() {
                _isExpanded = !_isExpanded;
              });
            },
          ),
          if (_isExpanded) ...widget.children,
        ],
      ),
    );
  }
}

/// Radio list tile with custom styling
class StyledRadioListTile<T> extends StatelessWidget {
  final String title;
  final String? subtitle;
  final T value;
  final T groupValue;
  final ValueChanged<T?> onChanged;
  final Color? activeColor;

  const StyledRadioListTile({
    super.key,
    required this.title,
    this.subtitle,
    required this.value,
    required this.groupValue,
    required this.onChanged,
    this.activeColor,
  });

  @override
  Widget build(BuildContext context) {
    return RadioListTile<T>(
      title: Text(
        title,
        style: ThemeTextStyles.bodyLarge,
      ),
      subtitle: subtitle != null
          ? Text(
              subtitle!,
              style: ThemeTextStyles.bodySmall.copyWith(
                color: ThemeColors.neutralGrey,
              ),
            )
          : null,
      value: value,
      groupValue: groupValue,
      onChanged: onChanged,
      activeColor: activeColor ?? ThemeColors.primaryBlue,
      contentPadding: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.defaultPadding,
      ),
    );
  }
}

/// Dismissible list item
class DismissibleListItem extends StatelessWidget {
  final String itemKey;
  final Widget child;
  final Future<bool?> Function(DismissDirection)? confirmDismiss;
  final void Function(DismissDirection)? onDismissed;
  final Widget? background;
  final Widget? secondaryBackground;

  const DismissibleListItem({
    super.key,
    required this.itemKey,
    required this.child,
    this.confirmDismiss,
    this.onDismissed,
    this.background,
    this.secondaryBackground,
  });

  @override
  Widget build(BuildContext context) {
    return Dismissible(
      key: Key(itemKey),
      confirmDismiss: confirmDismiss,
      onDismissed: onDismissed,
      background: background ??
          Container(
            color: ThemeColors.errorRed,
            alignment: Alignment.centerLeft,
            padding: EdgeInsets.only(left: ThemeDimensions.defaultPadding),
            child: Icon(
              Icons.delete,
              color: ThemeColors.neutralWhite,
            ),
          ),
      secondaryBackground: secondaryBackground ??
          Container(
            color: ThemeColors.errorRed,
            alignment: Alignment.centerRight,
            padding: EdgeInsets.only(right: ThemeDimensions.defaultPadding),
            child: Icon(
              Icons.delete,
              color: ThemeColors.neutralWhite,
            ),
          ),
      child: child,
    );
  }
}

/// Section header for lists
class ListSectionHeader extends StatelessWidget {
  final String title;
  final String? action;
  final VoidCallback? onActionTap;
  final EdgeInsetsGeometry? padding;

  const ListSectionHeader({
    super.key,
    required this.title,
    this.action,
    this.onActionTap,
    this.padding,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding ??
          EdgeInsets.symmetric(
            horizontal: ThemeDimensions.defaultPadding,
            vertical: ThemeDimensions.smallPadding,
          ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            title,
            style: ThemeTextStyles.headlineSmall.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          if (action != null)
            TextButton(
              onPressed: onActionTap,
              child: Text(
                action!,
                style: ThemeTextStyles.bodyMedium.copyWith(
                  color: ThemeColors.primaryBlue,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Custom divider with text
class DividerWithText extends StatelessWidget {
  final String text;
  final Color? color;
  final double? thickness;

  const DividerWithText({
    super.key,
    required this.text,
    this.color,
    this.thickness,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Divider(
            color: color ?? ThemeColors.neutralGrey.withOpacity(0.3),
            thickness: thickness ?? 1,
          ),
        ),
        Padding(
          padding: EdgeInsets.symmetric(
            horizontal: ThemeDimensions.defaultPadding,
          ),
          child: Text(
            text,
            style: ThemeTextStyles.bodySmall.copyWith(
              color: ThemeColors.neutralGrey,
            ),
          ),
        ),
        Expanded(
          child: Divider(
            color: color ?? ThemeColors.neutralGrey.withOpacity(0.3),
            thickness: thickness ?? 1,
          ),
        ),
      ],
    );
  }
}

/// Custom separator with padding
class CustomSeparator extends StatelessWidget {
  final double? height;
  final double? thickness;
  final Color? color;
  final EdgeInsetsGeometry? padding;

  const CustomSeparator({
    super.key,
    this.height,
    this.thickness,
    this.color,
    this.padding,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding ?? EdgeInsets.symmetric(
        vertical: ThemeDimensions.smallPadding,
      ),
      child: Container(
        height: thickness ?? 1,
        color: color ?? ThemeColors.neutralGrey.withOpacity(0.2),
      ),
    );
  }
}
