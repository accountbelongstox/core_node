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
