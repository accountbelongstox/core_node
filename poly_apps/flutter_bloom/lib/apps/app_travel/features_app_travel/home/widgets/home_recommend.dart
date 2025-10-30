import 'package:flutter/material.dart';
import '../../../models_app_travel/recommend_item_model.dart';
import '../../../widgets/travel_icons.dart';

class HomeRecommend extends StatelessWidget {
  final List<List<RecommendItemModel>> recommend;

  const HomeRecommend({
    Key? key,
    required this.recommend,
  }) : super(key: key);

  Widget _buildFirstRow(BuildContext context) {
    if (recommend.isEmpty || recommend[0].isEmpty) {
      return const SizedBox.shrink();
    }

    final screenWidth = MediaQuery.of(context).size.width;
    final firstItem = recommend[0].length > 0 ? recommend[0][0] : null;
    final secondItem = recommend[0].length > 1 ? recommend[0][1] : null;

    return Row(
      children: [
        if (firstItem != null)
          Expanded(
            flex: 2,
            child: _buildImageColumn(
              context,
              firstItem,
              screenWidth,
              hasTitle: true,
              hasBorder: secondItem != null,
            ),
          ),
        if (secondItem != null)
          Expanded(
            flex: 1,
            child: Container(
              decoration: const BoxDecoration(
                border: Border(
                  left: BorderSide(color: Colors.white, width: 2.0),
                ),
              ),
              child: _buildImageColumn(
                context,
                secondItem,
                screenWidth,
                hasTitle: true,
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildSecondRow(BuildContext context) {
    if (recommend.length < 2 || recommend[1].isEmpty) {
      return const SizedBox.shrink();
    }

    final screenWidth = MediaQuery.of(context).size.width;

    return Container(
      decoration: const BoxDecoration(
        border: Border(
          top: BorderSide(color: Colors.white, width: 2.0),
        ),
      ),
      child: Row(
        children: recommend[1].asMap().entries.map((entry) {
          final index = entry.key;
          final item = entry.value;
          return Expanded(
            child: Container(
              decoration: index > 0
                  ? const BoxDecoration(
                      border: Border(
                        left: BorderSide(color: Colors.white, width: 2.0),
                      ),
                    )
                  : null,
              child: _buildImageColumn(
                context,
                item,
                screenWidth,
                hasSightInfo: true,
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildImageColumn(
    BuildContext context,
    RecommendItemModel item,
    double screenWidth, {
    bool hasTitle = false,
    bool hasSightInfo = false,
    bool hasBorder = false,
  }) {
    final imageHeight = (screenWidth - 48.0) / 3;

    return Stack(
      children: [
        Column(
          children: [
            Container(
              width: double.infinity,
              height: imageHeight,
              color: const Color(0xFFEEEEEE),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  item.getFullImageUrl().startsWith('assets/')
                      ? Image.asset(
                          item.getFullImageUrl(),
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stackTrace) {
                            return Container(
                              color: const Color(0xFFEEEEEE),
                              child: const Icon(
                                Icons.broken_image,
                                color: Colors.grey,
                              ),
                            );
                          },
                        )
                      : Image.network(
                          item.getFullImageUrl(),
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stackTrace) {
                            return Container(
                              color: const Color(0xFFEEEEEE),
                              child: const Icon(
                                Icons.broken_image,
                                color: Colors.grey,
                              ),
                            );
                          },
                        ),
                  if (hasTitle && item.title != null && item.title!.isNotEmpty)
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: imageHeight * 0.5,
                      child: Container(
                        padding: const EdgeInsets.fromLTRB(24.0, 0, 24.0, 24.0),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              Colors.black.withOpacity(0.0),
                              Colors.black.withOpacity(0.2),
                            ],
                          ),
                        ),
                        child: Align(
                          alignment: Alignment.bottomLeft,
                          child: Text(
                            item.title!,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 16.0,
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            if (hasSightInfo) ...[
              Container(
                margin: const EdgeInsets.only(bottom: 12.0),
                child: Column(
                  children: [
                    if (item.sight != null && item.sight!.isNotEmpty)
                      Container(
                        height: 40.0,
                        alignment: Alignment.center,
                        child: Text(
                          item.sight!,
                          style: const TextStyle(
                            fontSize: 16.0,
                            color: Colors.black87,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    if (item.about != null && item.about!.isNotEmpty)
                      Container(
                        height: 40.0,
                        alignment: Alignment.center,
                        child: Text(
                          item.about!,
                          style: const TextStyle(
                            fontSize: 24.0,
                            color: Color(0xFF666666),
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ],
        ),
        if (item.tag != null && item.tag!.isNotEmpty)
          Positioned(
            top: 0,
            left: 0,
            child: Container(
              padding: const EdgeInsets.fromLTRB(10.0, 8.0, 10.0, 8.0),
              decoration: const BoxDecoration(
                color: Color(0xFFFF7700),
                borderRadius: BorderRadius.only(
                  bottomRight: Radius.circular(4.0),
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    item.tag!,
                    style: const TextStyle(
                      fontSize: 22.0,
                      color: Colors.white,
                    ),
                  ),
                  Icon(
                    TravelIcons.video,
                    size: 22.0,
                    color: Colors.white,
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    if (recommend.isEmpty) {
      return const SizedBox.shrink();
    }

    return Container(
      margin: const EdgeInsets.fromLTRB(24.0, 0, 24.0, 24.0),
      padding: const EdgeInsets.only(bottom: 20.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16.0),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 12.0,
            offset: const Offset(0, 0),
          ),
        ],
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(24.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  '玩法研究院',
                  style: TextStyle(
                    fontSize: 36.0,
                    fontWeight: FontWeight.normal,
                    color: Colors.black87,
                  ),
                ),
                GestureDetector(
                  onTap: () {
                    debugPrint('More recommendations tapped');
                  },
                  child: Row(
                    children: [
                      const Text(
                        '更多',
                        style: TextStyle(
                          fontSize: 24.0,
                          color: Color(0xFF999999),
                        ),
                      ),
                      Icon(
                        TravelIcons.arrowRight,
                        size: 24.0,
                        color: const Color(0xFF999999),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          ClipRRect(
            borderRadius: const BorderRadius.only(
              bottomLeft: Radius.circular(16.0),
              bottomRight: Radius.circular(16.0),
            ),
            child: Column(
              children: [
                _buildFirstRow(context),
                _buildSecondRow(context),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
