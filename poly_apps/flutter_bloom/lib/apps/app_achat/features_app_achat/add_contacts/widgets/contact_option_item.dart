import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/add_contacts/models/contact_option_model.dart';

class ContactOptionItem extends StatelessWidget {
  final ContactOptionModel option;
  final VoidCallback? onTap;

  const ContactOptionItem({
    super.key,
    required this.option,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusDefault),
        child: Padding(
          padding: const EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: option.iconColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(ThemeDimensions.radiusDefault),
                ),
                child: Icon(
                  option.icon,
                  color: option.iconColor,
                  size: ThemeDimensions.iconSizeMedium,
                ),
              ),
              const SizedBox(width: ThemeDimensions.paddingSizeDefault),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      option.title,
                      style: ThemeTextStyles.textSemiBold.copyWith(
                        fontSize: ThemeDimensions.fontSizeMedium,
                        color: Theme.of(context).textTheme.bodyLarge?.color,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      option.subtitle,
                      style: ThemeTextStyles.textRegular.copyWith(
                        fontSize: ThemeDimensions.fontSizeSmall,
                        color: Theme.of(context).hintColor,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.arrow_forward_ios,
                size: ThemeDimensions.iconSizeSmall,
                color: Theme.of(context).hintColor,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
