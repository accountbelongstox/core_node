import 'package:flutter/material.dart';
import '../models/order_detail_model.dart';

/// 酒店推荐横向列表
class HotelRecommendationList extends StatelessWidget {
  final List<HotelRecommendation> recommendations;
  final Function(HotelRecommendation)? onTapHotel;

  const HotelRecommendationList({
    super.key,
    required this.recommendations,
    this.onTapHotel,
  });

  @override
  Widget build(BuildContext context) {
    if (recommendations.isEmpty) return const SizedBox.shrink();

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  '您可能喜欢的酒店',
                  style: TextStyle(
                    color: Colors.black87,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                GestureDetector(
                  onTap: () {
                    // 关闭推荐列表
                  },
                  child: const Icon(
                    Icons.close,
                    size: 18,
                    color: Color(0xFFAAAAAA),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 180,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              itemCount: recommendations.length,
              itemBuilder: (context, index) {
                final hotel = recommendations[index];
                return _buildHotelCard(context, hotel);
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHotelCard(BuildContext context, HotelRecommendation hotel) {
    return GestureDetector(
      onTap: () {
        if (onTapHotel != null) {
          onTapHotel!(hotel);
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('查看 ${hotel.name}')),
          );
        }
      },
      child: Container(
        width: 180,
        margin: const EdgeInsets.symmetric(horizontal: 4),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: const Color(0xFFE8E8E8)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 酒店图片
            ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(6)),
              child: Image.asset(
                hotel.imageUrl,
                width: 180,
                height: 100,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) {
                  return Container(
                    width: 180,
                    height: 100,
                    color: const Color(0xFFF5F5F5),
                    child: const Icon(Icons.hotel, size: 32, color: Color(0xFFCCCCCC)),
                  );
                },
              ),
            ),
            // 酒店信息
            Padding(
              padding: const EdgeInsets.all(8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 酒店名称
                  Text(
                    hotel.name,
                    style: const TextStyle(
                      color: Colors.black87,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  // 评分和价格
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Text(
                            '${hotel.rating}',
                            style: const TextStyle(
                              color: Color(0xFFFF8800),
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(width: 2),
                          Text(
                            hotel.ratingText,
                            style: const TextStyle(
                              color: Color(0xFF999999),
                              fontSize: 10,
                            ),
                          ),
                        ],
                      ),
                      Text(
                        '¥${hotel.price.toStringAsFixed(0)}起',
                        style: const TextStyle(
                          color: Color(0xFFFF6B35),
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
