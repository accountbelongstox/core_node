import 'package:flutter/material.dart';
import '../../../models_app_travel/subnav_model.dart';

class HomeSubnav extends StatelessWidget {
  final List<SubnavModel> subnavs;

  const HomeSubnav({
    Key? key,
    required this.subnavs,
  }) : super(key: key);

  Widget _buildSubnavIcon(int index) {
    const spriteImagePath = 'assets/apps/app_travel/images/un_ico_subnav2x@v7.152.png';
    final yOffset = -56.0 * index;

    return Container(
      width: 56.0,
      height: 56.0,
      margin: const EdgeInsets.fromLTRB(0, 20.0, 0, 10.0),
      child: ClipRect(
        child: OverflowBox(
          minHeight: 56.0,
          maxHeight: 560.0,
          alignment: Alignment.topCenter,
          child: Transform.translate(
            offset: Offset(0, yOffset),
            child: Image.asset(
              spriteImagePath,
              width: 56.0,
              fit: BoxFit.none,
              alignment: Alignment.topCenter,
              errorBuilder: (context, error, stackTrace) {
                return Container(
                  width: 56.0,
                  height: 56.0,
                  color: Colors.grey[300],
                  child: const Icon(
                    Icons.image_not_supported,
                    size: 30,
                    color: Colors.grey,
                  ),
                );
              },
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final displaySubnavs = subnavs.length > 10 ? subnavs.sublist(0, 10) : subnavs;

    return Container(
      height: 220.0,
      margin: const EdgeInsets.fromLTRB(24.0, 0, 24.0, 24.0),
      child: Wrap(
        children: List.generate(displaySubnavs.length, (index) {
          final subnav = displaySubnavs[index];
          return SizedBox(
            width: MediaQuery.of(context).size.width * 0.2,
            height: 110.0,
            child: GestureDetector(
              onTap: () {
                debugPrint('Subnav tapped: ${subnav.title}');
              },
              child: Column(
                mainAxisAlignment: MainAxisAlignment.start,
                children: [
                  _buildSubnavIcon(index),
                  Text(
                    subnav.title,
                    style: const TextStyle(
                      fontSize: 24.0,
                      color: Colors.black87,
                    ),
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          );
        }),
      ),
    );
  }
}
