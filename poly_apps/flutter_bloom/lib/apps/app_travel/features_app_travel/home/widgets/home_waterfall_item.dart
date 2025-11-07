import 'package:flutter/material.dart';
import '../../../models_app_travel/sight_model.dart';

class HomeWaterfallItem extends StatelessWidget {
  final SightModel sight;

  const HomeWaterfallItem({
    super.key,
    required this.sight,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(4.0),
      ),
      clipBehavior: Clip.hardEdge,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          sight.getFullImageUrl().startsWith('assets/')
              ? Image.asset(
                  sight.getFullImageUrl(),
                  width: double.infinity,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) {
                    return Container(
                      width: double.infinity,
                      height: 150,
                      color: const Color(0xFFEEEEEE),
                      child: const Icon(
                        Icons.broken_image,
                        color: Colors.grey,
                      ),
                    );
                  },
                )
              : Image.network(
                  sight.getFullImageUrl(),
                  width: double.infinity,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) {
                    return Container(
                      width: double.infinity,
                      height: 150,
                      color: const Color(0xFFEEEEEE),
                      child: const Icon(
                        Icons.broken_image,
                        color: Colors.grey,
                      ),
                    );
                  },
                ),
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  sight.name,
                  style: const TextStyle(
                    fontSize: 16.0,
                    height: 24.0 / 16.0,
                    color: Colors.black87,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                if (sight.shortFeatures.isNotEmpty) ...[
                  const SizedBox(height: 2.0),
                  Wrap(
                    spacing: 4.0,
                    runSpacing: 2.0,
                    children: sight.shortFeatures.map((feature) {
                      return Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 4.0,
                          vertical: 2.5,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEBF5FF),
                          borderRadius: BorderRadius.circular(2.0),
                        ),
                        child: Text(
                          feature,
                          style: const TextStyle(
                            fontSize: 10.0,
                            height: 1.0,
                            color: Color(0xFF0086F6),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ],
                if (sight.sightCategoryInfo.isNotEmpty) ...[
                  const SizedBox(height: 2.0),
                  Text(
                    sight.sightCategoryInfo,
                    style: const TextStyle(
                      fontSize: 11.0,
                      height: 24.0 / 11.0,
                      color: Color(0xFF666666),
                    ),
                  ),
                ],
                const SizedBox(height: 2.0),
                Row(
                  children: [
                    RichText(
                      text: TextSpan(
                        style: const TextStyle(
                          fontSize: 11.0,
                          color: Color(0xFFFF6600),
                        ),
                        children: [
                          const TextSpan(text: '¥'),
                          TextSpan(
                            text: sight.price.toString(),
                            style: const TextStyle(
                              fontSize: 18.0,
                            ),
                          ),
                          const TextSpan(text: '起'),
                        ],
                      ),
                    ),
                    const SizedBox(width: 10.0),
                    Text(
                      sight.distanceStr,
                      style: const TextStyle(
                        fontSize: 11.0,
                        color: Color(0xFF666666),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
