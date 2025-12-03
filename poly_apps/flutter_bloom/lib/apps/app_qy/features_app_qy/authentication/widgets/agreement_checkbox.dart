/// Agreement checkbox widget for terms and privacy
library;

import 'package:flutter/material.dart';
import '../../../../resources_app_qy/colors_app_qy.dart';
import '../../../../common/theme/base/theme_dimensions.dart';
import '../../../../common/theme/base/theme_text_styles.dart';
import '../../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../../common/localization/localization_manager.dart';

class AgreementCheckbox extends StatefulWidget {
  final bool value;
  final ValueChanged<bool>? onChanged;

  const AgreementCheckbox({
    super.key,
    required this.value,
    this.onChanged,
  });

  @override
  State<AgreementCheckbox> createState() => _AgreementCheckboxState();
}

class _AgreementCheckboxState extends State<AgreementCheckbox> {
  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Transform.scale(
          scale: 0.9,
          child: Checkbox(
            value: widget.value,
            onChanged: (value) => widget.onChanged?.call(value ?? false),
            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
            activeColor: ColorsAppQy.qySuccess,
          ),
        ),
        SizedBox(width: ThemeDimensions.spacing4),
        Expanded(
          child: RichText(
            text: TextSpan(
              style: ThemeTextStyles.caption.copyWith(
                color: ColorsAppQy.qyTextSecondary,
                height: 1.4,
              ),
              children: [
                TextSpan(text: QyAppLocalizationKeys.qyAgreementPrefix.tr(context)),
                WidgetSpan(
                  child: GestureDetector(
                    onTap: () {
                      // TODO: Show terms of service
                    },
                    child: Text(
                      QyAppLocalizationKeys.qyUserAgreement.tr(context),
                      style: ThemeTextStyles.caption.copyWith(
                        color: ColorsAppQy.qySuccess,
                        decoration: TextDecoration.underline,
                      ),
                    ),
                  ),
                ),
                TextSpan(text: ' ${QyAppLocalizationKeys.qyAnd.tr(context)} '),
                WidgetSpan(
                  child: GestureDetector(
                    onTap: () {
                      // TODO: Show privacy policy
                    },
                    child: Text(
                      QyAppLocalizationKeys.qyPrivacyPolicy.tr(context),
                      style: ThemeTextStyles.caption.copyWith(
                        color: ColorsAppQy.qySuccess,
                        decoration: TextDecoration.underline,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}