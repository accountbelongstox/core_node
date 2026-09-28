import 'package:flutter/material.dart';
import '../../../models_app_travel/travel_map_model.dart';
import '../../../testdata/travel_map_data.dart';

class HomeContentMix extends StatelessWidget {
  const HomeContentMix({super.key});

  Widget _buildTravelCard(TravelMapModel card) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8.0),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 4.0,
            offset: const Offset(0, 2.0),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(8.0)),
              child: Image.asset(
                card.imagePath,
                fit: BoxFit.cover,
                width: double.infinity,
                errorBuilder: (context, error, stackTrace) {
                  return Container(
                    color: Colors.grey[200],
                    child: const Center(
                      child: Icon(
                        Icons.image_not_supported,
                        color: Colors.grey,
                        size: 32.0,
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  card.title,
                  style: const TextStyle(
                    fontSize: 13.0,
                    fontWeight: FontWeight.w600,
                    color: Colors.black87,
                    height: 1.2,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (card.subtitle.isNotEmpty) ...[
                  const SizedBox(height: 2.0),
                  Text(
                    card.subtitle,
                    style: TextStyle(
                      fontSize: 11.0,
                      color: Colors.grey[600],
                      height: 1.2,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                const SizedBox(height: 6.0),
                Row(
                  children: [
                    CircleAvatar(
                      radius: 10.0,
                      backgroundColor: Colors.grey[300],
                      child: Icon(
                        Icons.person,
                        size: 12.0,
                        color: Colors.grey[600],
                      ),
                    ),
                    const SizedBox(width: 6.0),
                    Expanded(
                      child: Text(
                        card.userName,
                        style: TextStyle(
                          fontSize: 10.0,
                          color: Colors.grey[600],
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
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

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final cardWidth = (screenWidth - 40.0) / 2;
    final cardHeight = cardWidth * 1.35;

    final travelCards = TravelMapData.getTravelMaps();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 12.0),
          child: Text(
            '趣玩地图',
            style: TextStyle(
              fontSize: 18.0,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
            ),
          ),
        ),
        const SizedBox(height: 12.0),
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 12.0),
          child: Wrap(
            spacing: 8.0,
            runSpacing: 8.0,
            children: travelCards.map((card) {
              return SizedBox(
                width: cardWidth,
                height: cardHeight,
                child: _buildTravelCard(card),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }
}
