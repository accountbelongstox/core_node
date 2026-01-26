// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';
import '../../../widgets_app_bank/bank_section_card.dart';
import '../../../widgets_app_bank/bank_loading_dialog.dart';
import '../../../resources_app_bank/assets_images_app_bank.dart';

class LocalGoodStuffTabs extends StatefulWidget {
  const LocalGoodStuffTabs({super.key});

  @override
  State<LocalGoodStuffTabs> createState() => _LocalGoodStuffTabsState();
}

class _LocalGoodStuffTabsState extends State<LocalGoodStuffTabs>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BankSectionCard(
      gradient: const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          Color(0xFFFBFCFE),
          Color(0xFFFBFCFE),
        ],
      ),
      border: Border.all(
        color: Colors.transparent,
        width: 0,
      ),
      boxShadow: const [],
      children: [
        AnimatedBuilder(
          animation: _tabController,
          builder: (context, child) {
            return TabBar(
              controller: _tabController,
              indicatorSize: TabBarIndicatorSize.label,
              indicator: const BoxDecoration(),
              dividerColor: Colors.transparent,
              tabs: [
                Tab(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '本地',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: _tabController.index == 0
                              ? const Color(0xFFFF6B35)
                              : Colors.black87,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '优惠享不停',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.normal,
                          color: _tabController.index == 0
                              ? const Color(0xFFFF6B35)
                              : Colors.black87,
                        ),
                      ),
                    ],
                  ),
                ),
                Tab(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '好物',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: _tabController.index == 1
                              ? const Color(0xFFFF6B35)
                              : Colors.black87,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '人气必买',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.normal,
                          color: _tabController.index == 1
                              ? const Color(0xFFFF6B35)
                              : Colors.black87,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
        const SizedBox(height: 16),
        AnimatedBuilder(
          animation: _tabController,
          builder: (context, child) {
            return AnimatedSize(
              duration: const Duration(milliseconds: 200),
              curve: Curves.easeInOut,
              child: _tabController.index == 0
                  ? _buildLocalContent()
                  : _buildGoodStuffContent(),
            );
          },
        ),
      ],
    );
  }

  Widget _buildLocalContent() {
    return LayoutBuilder(
      builder: (context, constraints) {
        final cardWidth = (constraints.maxWidth - 12) / 2;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 1,
                  child: _buildLocalCard(
                    imagePath: BankImages.localCard1,
                    title: '以旧换新优惠加倍',
                    subtitle: '本地国补攻略快速看',
                    buttonText: '立即查看',
                    gradientColor: const Color(0xFFE4F8FF),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 1,
                  child: _buildLocalCard(
                    imagePath: BankImages.localCard2,
                    title: '建"社"开卡享好礼',
                    subtitle: '至高可得288元立减金',
                    buttonText: '立即查看',
                    gradientColor: const Color(0xFFFEE8EA),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerLeft,
              child: SizedBox(
                width: cardWidth,
                child: _buildLocalCard(
                  imagePath: BankImages.goodStuffCard1,
                  title: '龙卡新卡消费达标',
                  subtitle: '享至高366元立减金',
                  buttonText: '立即查看',
                  gradientColor: const Color(0xFFFEFDDE),
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildLocalCard({
    required String imagePath,
    required String title,
    required String subtitle,
    required String buttonText,
    required Color gradientColor,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          ClipRRect(
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(8),
              topRight: Radius.circular(8),
            ),
            child: Image.asset(
              imagePath,
              width: double.infinity,
              height: 140,
              fit: BoxFit.cover,
            ),
          ),
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  gradientColor,
                  Colors.white,
                ],
              ),
              borderRadius: const BorderRadius.only(
                bottomLeft: Radius.circular(8),
                bottomRight: Radius.circular(8),
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: Text(
                      title,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w900,
                        color: Colors.black87,
                        fontFamily: 'PingFang SC',
                      ),
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.visible,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: Text(
                      subtitle,
                      style: const TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.normal,
                        color: Color(0xFF999999),
                        fontFamily: 'PingFang SC',
                      ),
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.visible,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Center(
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Color(0xFFFF6B35),
                            Color(0xFFFF8C42),
                            Color(0xFFFFA500),
                          ],
                          stops: [0.0, 0.5, 1.0],
                        ),
                        borderRadius: BorderRadius.circular(16),
                      ),
                        child: Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: () {
                            BankLoadingDialog.show(context, title: title);
                          },
                          borderRadius: BorderRadius.circular(16),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 3),
                            child: Text(
                              buttonText,
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildGoodStuffContent() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // 文字标题区域（独立，不叠加）
        const Padding(
          padding: EdgeInsets.only(bottom: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '龙卡新卡消费达标',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF8B4513),
                  fontFamily: 'PingFang SC',
                ),
              ),
              SizedBox(height: 8),
              Text(
                '享至高366元立减金',
                style: TextStyle(
                  fontSize: 14,
                  color: Color(0xFF8B4513),
                  fontFamily: 'PingFang SC',
                ),
              ),
            ],
          ),
        ),
        // 背景图区域（独立，不叠加）
        Image.asset(
          BankImages.goodStuffBg,
          width: double.infinity,
          fit: BoxFit.cover,
        ),
      ],
    );
  }
}
