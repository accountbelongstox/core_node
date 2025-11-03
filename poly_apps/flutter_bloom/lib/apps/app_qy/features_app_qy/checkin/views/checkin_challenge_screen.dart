/// Check-in challenge screen
library checkin_challenge_screen;

import 'package:flutter/material.dart';
import '../../../../../../common/i18n/i18n_service.dart';
import '../../../../../../common/theme/app_theme.dart';
import '../../../../../../common/widgets/gradient_button.dart';

class CheckinChallengeScreen extends StatefulWidget {
  const CheckinChallengeScreen({super.key});

  @override
  State<CheckinChallengeScreen> createState() => _CheckinChallengeScreenState();
}

class _CheckinChallengeScreenState extends State<CheckinChallengeScreen> {
  int _currentStreak = 0;
  int _totalFlowers = 0;
  int _vouchers = 0;
  bool _isCheckedInToday = false;

  final List<DailyReward> _dailyRewards = [
    DailyReward(day: 1, flowers: 1, checked: false),
    DailyReward(day: 2, flowers: 1, checked: false),
    DailyReward(day: 3, flowers: 2, checked: false),
    DailyReward(day: 4, flowers: 2, checked: false),
    DailyReward(day: 5, flowers: 3, checked: false),
    DailyReward(day: 6, flowers: 3, checked: false),
    DailyReward(day: 7, flowers: 5, checked: false),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              AppTheme.primaryGreen.withOpacity(0.1),
              Colors.white,
            ],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              _buildAppBar(),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    _buildStreakCard(),
                    const SizedBox(height: 24),
                    _buildChallengeInfo(),
                    const SizedBox(height: 24),
                    _buildDailyCheckIn(),
                    const SizedBox(height: 24),
                    _buildShareSection(),
                    const SizedBox(height: 24),
                    _buildLotterySection(),
                    const SizedBox(height: 40),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAppBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back, color: AppTheme.textPrimary),
            onPressed: () => Navigator.of(context).pop(),
          ),
          Expanded(
            child: Text(
              '打卡挑战',
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: AppTheme.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStreakCard() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: AppTheme.primaryGradient,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppTheme.primaryGreen.withOpacity(0.3),
            blurRadius: 15,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.local_fire_department,
                color: Colors.orange,
                size: 32,
              ),
              const SizedBox(width: 8),
              Text(
                '$_currentStreak天',
                style: const TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              Text(
                '连续打卡',
                style: TextStyle(
                  fontSize: 18,
                  color: Colors.white.withOpacity(0.9),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _buildStreakStat('花瓣', '$_totalFlowers', Icons.local_florist),
              _buildStreakStat('赏花券', '$_vouchers', Icons.card_giftcard),
              _buildStreakStat('同桌', '寻找', Icons.people),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStreakStat(String label, String value, IconData icon) {
    return Column(
      children: [
        Icon(icon, color: Colors.white, size: 24),
        const SizedBox(height: 4),
        Text(
          value,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: Colors.white.withOpacity(0.8),
          ),
        ),
      ],
    );
  }

  Widget _buildChallengeInfo() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.emoji_events,
                color: Colors.orange,
                size: 24,
              ),
              const SizedBox(width: 12),
              Text(
                '新一期挑战已开始',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            '集徽章领���励',
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppTheme.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.orange.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Icon(
                  Icons.card_giftcard,
                  color: Colors.orange,
                  size: 20,
                ),
                const SizedBox(width: 8),
                Text(
                  '秋日任务派送站\n赚赏花券 得「小组件皮肤」',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.orange,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '10花瓣=1赏花券',
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey[600],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDailyCheckIn() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  AppTheme.primaryGreen.withOpacity(0.1),
                  AppTheme.secondaryGreen.withOpacity(0.05),
                ],
              ),
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(16),
                topRight: Radius.circular(16),
              ),
            ),
            child: Row(
              children: [
                Icon(
                  Icons.calendar_today,
                  color: AppTheme.primaryGreen,
                  size: 24,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    '开学每日签到',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                ),
                if (!_isCheckedInToday)
                  GradientButton(
                    text: '点击签到',
                    onPressed: _checkIn,
                    gradient: AppTheme.primaryGradient,
                  )
                else
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppTheme.accentGreen,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Text(
                      '已签到',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          ..._dailyRewards.asMap().entries.map((entry) {
            final index = entry.key;
            final reward = entry.value;
            final isLast = index == _dailyRewards.length - 1;

            return Column(
              children: [
                ListTile(
                  leading: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: reward.checked
                          ? AppTheme.accentGreen.withOpacity(0.1)
                          : Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Icon(
                      Icons.local_florist,
                      color: reward.checked ? AppTheme.accentGreen : Colors.grey,
                      size: 20,
                    ),
                  ),
                  title: Text(
                    '第${reward.day}天',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: reward.checked ? AppTheme.accentGreen : AppTheme.textPrimary,
                    ),
                  ),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.add,
                        color: reward.checked ? AppTheme.accentGreen : Colors.grey,
                        size: 16,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '花瓣x${reward.flowers}',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: reward.checked ? AppTheme.accentGreen : Colors.grey,
                        ),
                      ),
                    ],
                  ),
                ),
                if (!isLast)
                  const Divider(height: 1, indent: 72),
              ],
            );
          }).toList(),
        ],
      ),
    );
  }

  Widget _buildShareSection() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          _buildShareCard(
            '分享人参汤打卡图',
            '0/5',
            '• 花瓣x1 累计分享1/3/5天还能得限定徽章',
            Colors.orange,
            () => _shareCheckIn('人参汤'),
          ),
          const SizedBox(height: 16),
          _buildShareCard(
            '分享旅行熊熊打卡图',
            '0/9',
            '分享打卡图获得额外花瓣奖励',
            AppTheme.primaryGreen,
            () => _shareCheckIn('旅行熊熊'),
          ),
        ],
      ),
    );
  }

  Widget _buildShareCard(String title, String progress, String description, Color color, VoidCallback onTap) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withOpacity(0.05),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Row(
        children: [
          Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              Icons.share,
              color: color,
              size: 24,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  description,
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey[600],
                  ),
                ),
              ],
            ),
          ),
          Column(
            children: [
              Text(
                progress,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: color,
                ),
              ),
              const SizedBox(height: 4),
              ElevatedButton(
                onPressed: onTap,
                style: ElevatedButton.styleFrom(
                  backgroundColor: color,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  minimumSize: Size.zero,
                ),
                child: const Text('去分享'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildLotterySection() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: AppTheme.oceanGradient,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.blue.withOpacity(0.3),
            blurRadius: 15,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.casino,
                color: Colors.white,
                size: 32,
              ),
              const SizedBox(width: 12),
              Text(
                '去抽奖',
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            '使用赏花券参与抽奖',
            style: TextStyle(
              fontSize: 16,
              color: Colors.white.withOpacity(0.9),
            ),
          ),
          const SizedBox(height: 12),
          GradientButton(
            text: '立即抽奖',
            onPressed: _showLotteryDialog,
            gradient: LinearGradient(
              colors: [Colors.white, Colors.white.withOpacity(0.8)],
            ),
            textColor: AppTheme.primaryGreen,
          ),
        ],
      ),
    );
  }

  void _checkIn() {
    setState(() {
      _isCheckedInToday = true;
      _currentStreak++;
      _totalFlowers += _dailyRewards[_currentStreak % 7].flowers;
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('签到成功！获得花瓣x${_dailyRewards[_currentStreak % 7].flowers}'),
        backgroundColor: AppTheme.accentGreen,
      ),
    );
  }

  void _shareCheckIn(String type) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('分享打卡图'),
        content: Text('分享$type打卡图功能开发中...'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text('确定'),
          ),
        ],
      ),
    );
  }

  void _showLotteryDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('抽奖系统'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.casino,
              color: AppTheme.primaryGreen,
              size: 64,
            ),
            const SizedBox(height: 16),
            Text(
              '当前赏花券: $_vouchers',
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '10花瓣=1赏花券\n需要赏花券参与抽奖',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: Colors.grey[600],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text('确定'),
          ),
        ],
      ),
    );
  }
}

class DailyReward {
  final int day;
  final int flowers;
  bool checked;

  DailyReward({
    required this.day,
    required this.flowers,
    this.checked = false,
  });
}