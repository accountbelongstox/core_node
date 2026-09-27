import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';

class CustomLoader extends StatelessWidget {
  const CustomLoader({super.key});

  @override
  Widget build(BuildContext context) {
    ThemeDimensions.refresh(context);
    return Center(
        child: Container(
            height: 100,
            width: 100,
            decoration: BoxDecoration(
                color: Theme.of(context).cardColor,
                borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall)),
            alignment: Alignment.center,
            child: SpinKitCircle(
              color: Theme.of(context).primaryColor,
              size: 40.0,
            )));
  }
}
