/// Phone login button widget
library;

import 'package:flutter/material.dart';
import '../../../../resources_app_qy/colors_app_qy.dart';
import '../../../../common/theme/base/theme_dimensions.dart';
import '../../../../common/theme/base/theme_text_styles.dart';
import '../../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../../common/localization/localization_manager.dart';

class PhoneLoginButton extends StatelessWidget {
  final VoidCallback? onPressed;
  final double? width;
  final double? height;

  const PhoneLoginButton({
    super.key,
    this.onPressed,
    this.width,
    this.height,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width ?? double.infinity,
      height: height ?? ThemeDimensions.buttonHeightM,
      child: ElevatedButton.icon(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: ColorsAppQy.qySuccess,
          foregroundColor: ColorsAppQy.qyTextOnPrimary,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusM),
          ),
          padding: EdgeInsets.symmetric(horizontal: ThemeDimensions.spacing16, vertical: ThemeDimensions.spacing12),
        ),
        icon: const Icon(Icons.phone, size: ThemeDimensions.iconSizeM),
        label: Text(
          QyAppLocalizationKeys.qyPhoneLogin.tr(context),
          style: ThemeTextStyles.body1.copyWith(
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }
}