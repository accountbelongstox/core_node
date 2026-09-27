import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_bank/config_app_bank/constants.dart';
import '../../../widgets_app_bank/bank_section_card.dart';
import '../../../widgets_app_bank/bank_simple_card.dart';
import '../../../widgets_app_bank/bank_action_button.dart';
import '../../../widgets_app_bank/bank_small_button.dart';
import '../../../widgets_app_bank/bank_loading_dialog.dart';
import '../../../resources_app_bank/assets_images_app_bank.dart';

class NowShowingSection extends StatelessWidget {
  const NowShowingSection({super.key});

  @override
  Widget build(BuildContext context) {
    final movies = [
      {
        'title': '飞行家',
        'rating': '9.5',
        'tag': '口碑佳作 全家快乐',
        'image': BankImages.movieFlyer1
      },
      {
        'title': '匿杀',
        'rating': '9.4',
        'tag': '',
        'image': BankImages.movieFlyer2
      },
      {
        'title': '阿凡达3',
        'rating': '9.3',
        'tag': '19.9元起购票 寒假暴爽刺激',
        'image': BankImages.movieFlyer3
      },
    ];

    return BankSectionCard(
      title: '正在热映',
      moreText: '更多',
      gradient: const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          Color(0xFFFBFCFE),
          Color(0xFFFBFCFE),
        ],
      ),
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: movies.map((movie) {
              final hasTag = movie['tag']!.toString().isNotEmpty;
              return Container(
                width: 120,
                margin: const EdgeInsets.only(right: 12),
                child: BankSimpleCard(
                  padding: const EdgeInsets.all(8),
                  child: SizedBox(
                    height: 280,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          height: 160,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(
                                BankConstants.borderRadius),
                            image: DecorationImage(
                              image: AssetImage(movie['image'] as String),
                              fit: BoxFit.cover,
                            ),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          movie['title']!,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: Colors.black87,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            const Text(
                              '评分: ',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.grey,
                              ),
                            ),
                            Text(
                              movie['rating']!,
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFFFF6B35),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        if (hasTag)
                          Text(
                            movie['tag']!,
                            style: const TextStyle(
                              fontSize: 10,
                              color: Color(0xFF666666),
                              fontWeight: FontWeight.w400,
                            ),
                          )
                        else
                          const SizedBox.shrink(),
                        const Spacer(),
                        BankActionButton(
                          text: '去购票',
                          backgroundColor: Colors.transparent,
                          textColor: const Color(0xFFE68A48),
                          borderColor: const Color(0xFFE68A48),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 4),
                          fontSize: 12,
                          onTap: () {
                            BankLoadingDialog.show(context, title: movie['title'] as String);
                          },
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }
}
