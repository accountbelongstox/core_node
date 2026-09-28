import 'package:flutter/material.dart';
import 'package:qyflutter/common/assets/common_assets_icons.dart';

class FundaisingSubImageWidget extends StatelessWidget {
  const FundaisingSubImageWidget({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
        height: 100,
        width: 120,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
        ),
        child: ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: const Image(
              image: AssetImage(
                CommonAssetsIcons.education,
              ),
              fit: BoxFit.cover,
            )));
  }
}
