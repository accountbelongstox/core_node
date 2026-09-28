import 'package:flutter/material.dart';
import 'package:qyflutter/common/assets/common_assets_icons.dart';
import 'package:flutter_svg/flutter_svg.dart';

class CustomImage extends StatelessWidget {
  final String? image;
  final double? height;
  final double? width;
  final BoxFit fit;
  final double radius;
  final String placeholder;
  final String? svg;
  const CustomImage({
    super.key,
    this.image,
    this.height,
    this.width,
    this.fit = BoxFit.cover,
    this.placeholder = CommonAssetsIcons.placeholder,
    this.radius = 0,
    this.svg,
  });

  @override
  Widget build(BuildContext context) {
    return svg != null
        ? SvgPicture.asset(
            svg!,
            height: height,
            width: width,
            fit: fit,
          )
        : ClipRRect(
            borderRadius: BorderRadius.circular(radius),
            child: FadeInImage.assetNetwork(
              image: image!,
              height: height,
              width: width,
              fit: fit,
              placeholder: CommonAssetsIcons.placeholder,
              imageErrorBuilder: (context, url, error) => Image.asset(
                  placeholder,
                  height: height,
                  width: width,
                  fit: fit),
            ),
          );
  }
}
