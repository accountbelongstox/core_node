import 'package:flutter/material.dart';
import '../../../models_app_travel/subnav_model.dart';
import '../../../resources_app_travel/assets_images_app_travel.dart';

class HomeSubnav extends StatelessWidget {
  final List<SubnavModel> subnavs;

  const HomeSubnav({
    super.key,
    required this.subnavs,
  });

  Widget _buildSubnavIcon(int index) {
    const iconSize = 48.0;
    final iconPath = index < AssetsImagesAppTravel.travelSubnavIcons.length
        ? AssetsImagesAppTravel.travelSubnavIcons[index]
        : null;

    if (iconPath == null) {
      return SizedBox(
        width: iconSize,
        height: iconSize,
        child: Container(
          color: Colors.grey[300],
          child: const Icon(
            Icons.image_not_supported,
            size: 24,
            color: Colors.grey,
          ),
        ),
      );
    }

    return SizedBox(
      width: iconSize,
      height: iconSize,
      child: Image.asset(
        iconPath,
        width: iconSize,
        height: iconSize,
        fit: BoxFit.contain,
        errorBuilder: (context, error, stackTrace) {
          return Container(
            color: Colors.grey[300],
            child: const Icon(
              Icons.image_not_supported,
              size: 24,
              color: Colors.grey,
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final displaySubnavs = subnavs.length > 10 ? subnavs.sublist(0, 10) : subnavs;

    return Container(
      margin: const EdgeInsets.fromLTRB(24.0, 0, 24.0, 24.0),
      child: Column(
        children: [
          Row(
            children: List.generate(5, (index) {
              if (index >= displaySubnavs.length) return const Expanded(child: SizedBox());
              final subnav = displaySubnavs[index];
              return Expanded(
                child: GestureDetector(
                  onTap: () {
                    debugPrint('Subnav tapped: ${subnav.title}');
                  },
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8.0),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        _buildSubnavIcon(index),
                        const SizedBox(height: 6.0),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 2.0),
                          child: Text(
                            subnav.title,
                            style: const TextStyle(
                              fontSize: 11.0,
                              color: Colors.black87,
                              height: 1.2,
                            ),
                            textAlign: TextAlign.center,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }),
          ),
          if (displaySubnavs.length > 5)
            Row(
              children: List.generate(5, (index) {
                final actualIndex = index + 5;
                if (actualIndex >= displaySubnavs.length) return const Expanded(child: SizedBox());
                final subnav = displaySubnavs[actualIndex];
                return Expanded(
                  child: GestureDetector(
                    onTap: () {
                      debugPrint('Subnav tapped: ${subnav.title}');
                    },
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8.0),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          _buildSubnavIcon(actualIndex),
                          const SizedBox(height: 6.0),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 2.0),
                            child: Text(
                              subnav.title,
                              style: const TextStyle(
                                fontSize: 11.0,
                                color: Colors.black87,
                                height: 1.2,
                              ),
                              textAlign: TextAlign.center,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }),
            ),
        ],
      ),
    );
  }
}
