import 'package:flutter/material.dart';
import '../../../models_app_travel/sight_model.dart';
import 'home_waterfall_item.dart';

class HomeWaterfall extends StatelessWidget {
  final List<SightModel> sights;

  const HomeWaterfall({
    super.key,
    required this.sights,
  });

  @override
  Widget build(BuildContext context) {
    if (sights.isEmpty) {
      return const SizedBox.shrink();
    }

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20.0),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final itemWidth = (constraints.maxWidth - 10.0) / 2;

          final leftItems = <Widget>[];
          final rightItems = <Widget>[];

          for (int i = 0; i < sights.length; i++) {
            final item = Container(
              width: itemWidth,
              margin: const EdgeInsets.only(bottom: 10.0),
              child: HomeWaterfallItem(sight: sights[i]),
            );

            if (i % 2 == 0) {
              leftItems.add(item);
            } else {
              rightItems.add(item);
            }
          }

          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  children: leftItems,
                ),
              ),
              const SizedBox(width: 10.0),
              Expanded(
                child: Column(
                  children: rightItems,
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
