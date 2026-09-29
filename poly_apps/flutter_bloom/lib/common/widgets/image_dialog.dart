import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/assets/common_assets_icons.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:go_router/go_router.dart';

class ImageDialog extends StatelessWidget {
  final String imageUrl;
  final String? title;
  final String? subTitle;
  const ImageDialog(
      {super.key, required this.imageUrl, this.title, this.subTitle});

  @override
  Widget build(BuildContext context) {
    ThemeDimensions.refresh(context);
    return AlertDialog(
      elevation: 0,
      backgroundColor: Theme.of(context).cardColor,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(10.0))),
      titlePadding: const EdgeInsets.all(0),
      contentPadding: const EdgeInsets.all(0),
      title: Align(
        alignment: Alignment.topRight,
        child: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => context.pop(),
        ),
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(
                  horizontal: ThemeDimensions.paddingSizeDefault),
              child: Column(children: [
                title != null
                    ? Text(title!,
                        style: ThemeTextStyles.textMedium.copyWith(
                            color: Theme.of(context)
                                .textTheme
                                .bodyMedium!
                                .color!
                                .withOpacity(0.7),
                            fontSize: ThemeDimensions.fontSizeDefault))
                    : const SizedBox.shrink(),
                SizedBox(
                  height: title != null ? ThemeDimensions.paddingSizeDefault : 0,
                ),
                Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(10),
                    color: Theme.of(context).primaryColor.withOpacity(0.20),
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: FadeInImage.assetNetwork(
                      placeholder: CommonAssetsIcons.placeholder,
                      image: imageUrl,
                      fit: BoxFit.contain,
                      imageErrorBuilder: (c, o, s) => Image.asset(
                        CommonAssetsIcons.placeholder,
                        height: MediaQuery.of(context).size.width - 130,
                        width: MediaQuery.of(context).size.width,
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                ),
                SizedBox(
                  height: subTitle != null ? ThemeDimensions.paddingSizeDefault : 0,
                ),
                subTitle != null
                    ? Text(
                        subTitle!,
                        style: ThemeTextStyles.textMedium.copyWith(
                          color: Theme.of(context)
                              .textTheme
                              .bodyMedium!
                              .color!
                              .withOpacity(0.5),
                          fontSize: ThemeDimensions.fontSizeDefault,
                        ),
                        textAlign: TextAlign.justify,
                      )
                    : const SizedBox.shrink(),
                const SizedBox(height: ThemeDimensions.paddingSizeDefault),
              ]),
            )
          ],
        ),
      ),
    );
  }
}
