/// Check-in challenge screen
library;

import 'package:flutter/material.dart';
import '../../../../../../common/theme/app_theme.dart';
import '../../../../../../common/widgets/gradient_button.dart';
import '../../../resources_app_qy/colors_app_qy.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../config_app_qy/storage_app_qy.dart';

class CheckinChallengeScreen extends StatefulWidget {
  const CheckinChallengeScreen({super.key});

  @override
  State<CheckinChallengeScreen> createState() => _CheckinChallengeScreenState();
}

class _CheckinChallengeScreenState extends State<CheckinChallengeScreen> {
  final StorageAppQy _storage = StorageAppQy.instance;
  int _currentStreak = 0;
  int _totalFlowers = 0;
  int _vouchers = 0;
  bool _isCheckedInToday = false;
  List<DailyReward> _dailyRewards = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadCheckinData();
  }

  Future<void> _loadCheckinData() async {
    setState(() {
      _isLoading = true;
    });

    try {
      await _storage.initAppStorage();

      // Load streak, flowers, vouchers
      _currentStreak =
          await _storage.getApp<int>(StorageAppQy.keyCheckinStreak) ?? 0;
      _totalFlowers =
          await _storage.getApp<int>(StorageAppQy.keyCheckinFlowers) ?? 0;
      _vouchers =
          await _storage.getApp<int>(StorageAppQy.keyCheckinVouchers) ?? 0;

      // Load daily rewards from storage
      final storedRewards =
          await _storage.getApp<List<dynamic>>(StorageAppQy.keyCheckinRewards);
      if (storedRewards != null && storedRewards.isNotEmpty) {
        _dailyRewards = storedRewards
            .map((json) => DailyReward.fromJson(json as Map<String, dynamic>))
            .toList();
      } else {
        // Initialize with default rewards
        _dailyRewards = _getDefaultRewards();
        await _saveRewardsToStorage();
      }
    } catch (e) {
      _dailyRewards = _getDefaultRewards();
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  List<DailyReward> _getDefaultRewards() {
    return [
      DailyReward(day: 1, flowers: 1, checked: false),
      DailyReward(day: 2, flowers: 1, checked: false),
      DailyReward(day: 3, flowers: 2, checked: false),
      DailyReward(day: 4, flowers: 2, checked: false),
      DailyReward(day: 5, flowers: 3, checked: false),
      DailyReward(day: 6, flowers: 3, checked: false),
      DailyReward(day: 7, flowers: 5, checked: false),
    ];
  }

  Future<void> _saveRewardsToStorage() async {
    try {
      final rewardsJson = _dailyRewards.map((r) => r.toJson()).toList();
      await _storage.setApp<List<dynamic>>(
          StorageAppQy.keyCheckinRewards, rewardsJson);
    } catch (e) {
      // Silently fail
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        body: Center(
          child: CircularProgressIndicator(
            color: AppTheme.primaryGreen,
          ),
        ),
      );
    }

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              AppTheme.primaryGreen.withOpacity(0.1),
              ColorsAppQy.qyTextOnPrimary,
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
                    _buildShareSection(context),
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
              QyAppLocalizationKeys.qyCheckinChallenge.tr(context),
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
                color: ColorsAppQy.qyWarning,
                size: 32,
              ),
              const SizedBox(width: 8),
              Text(
                '$_currentStreak${QyAppLocalizationKeys.qyCheckinConsecutiveDays.tr(context)}',
                style: const TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.bold,
                  color: ColorsAppQy.qyTextOnPrimary,
                ),
              ),
              Text(
                QyAppLocalizationKeys.qyCheckinStreak.tr(context),
                style: TextStyle(
                  fontSize: 18,
                  color: ColorsAppQy.qyFrostWhite,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _buildStreakStat(
                  QyAppLocalizationKeys.qyCheckinFlowers.tr(context),
                  '$_totalFlowers',
                  Icons.local_florist),
              _buildStreakStat(
                  QyAppLocalizationKeys.qyCheckinVouchers.tr(context),
                  '$_vouchers',
                  Icons.card_giftcard),
              _buildStreakStat(
                  QyAppLocalizationKeys.qyCheckinFindPartner.tr(context),
                  QyAppLocalizationKeys.qyCheckinFindPartner.tr(context),
                  Icons.people),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStreakStat(String label, String value, IconData icon) {
    return Column(
      children: [
        Icon(icon, color: ColorsAppQy.qyTextOnPrimary, size: 24),
        const SizedBox(height: 4),
        Text(
          value,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: ColorsAppQy.qyTextOnPrimary,
          ),
        ),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: ColorsAppQy.qyFrostMedium,
          ),
        ),
      ],
    );
  }

  Widget _buildChallengeInfo() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: ColorsAppQy.qyTextOnPrimary,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: ColorsAppQy.qyShadowLight,
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
                color: ColorsAppQy.qyWarning,
                size: 24,
              ),
              const SizedBox(width: 12),
              Text(
                QyAppLocalizationKeys.qyCheckinNewChallengeStarted.tr(context),
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
              color: ColorsAppQy.qyWarning.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Icon(
                  Icons.card_giftcard,
                  color: ColorsAppQy.qyWarning,
                  size: 20,
                ),
                const SizedBox(width: 8),
                Text(
                  QyAppLocalizationKeys.qyCheckinFlowerToVoucher.tr(context),
                  style: TextStyle(
                    fontSize: 14,
                    color: ColorsAppQy.qyWarning,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Text(
            QyAppLocalizationKeys.qyCheckinFlowerToVoucher.tr(context),
            style: TextStyle(
              fontSize: 14,
              color: ColorsAppQy.qyTextTertiary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDailyCheckIn() {
    return Container(
      decoration: BoxDecoration(
        color: ColorsAppQy.qyTextOnPrimary,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: ColorsAppQy.qyShadowLight,
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
                    QyAppLocalizationKeys.qyCheckinDailyCheckin.tr(context),
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                ),
                if (!_isCheckedInToday)
                  GradientButton(
                    text: QyAppLocalizationKeys.qyCheckinClickToCheckin
                        .tr(context),
                    onPressed: _checkIn,
                    gradient: AppTheme.primaryGradient,
                  )
                else
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppTheme.accentGreen,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      QyAppLocalizationKeys.qyCheckinCheckedIn.tr(context),
                      style: const TextStyle(
                        color: ColorsAppQy.qyTextOnPrimary,
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
                          : ColorsAppQy.qyBorderLight,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Icon(
                      Icons.local_florist,
                      color: reward.checked
                          ? ColorsAppQy.qySuccess
                          : ColorsAppQy.qyTextTertiary,
                      size: 20,
                    ),
                  ),
                  title: Text(
                    QyAppLocalizationKeys.qyCheckinDay
                        .tr(context)
                        .replaceAll('{day}', '${reward.day}'),
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: reward.checked
                          ? AppTheme.accentGreen
                          : AppTheme.textPrimary,
                    ),
                  ),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.add,
                        color: reward.checked
                            ? ColorsAppQy.qySuccess
                            : ColorsAppQy.qyTextTertiary,
                        size: 16,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        QyAppLocalizationKeys.qyCheckinFlowersX
                            .tr(context)
                            .replaceAll('{count}', '${reward.flowers}'),
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: reward.checked
                              ? ColorsAppQy.qySuccess
                              : ColorsAppQy.qyTextTertiary,
                        ),
                      ),
                    ],
                  ),
                ),
                if (!isLast) const Divider(height: 1, indent: 72),
              ],
            );
          }),
        ],
      ),
    );
  }

  Widget _buildShareSection(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: ColorsAppQy.qyTextOnPrimary,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: ColorsAppQy.qyShadowLight,
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          _buildShareCard(
            context,
            QyAppLocalizationKeys.qyCheckinShareGinsengSoup.tr(context),
            '0/5',
            QyAppLocalizationKeys.qyCheckinShareGinsengSoupDesc.tr(context),
            ColorsAppQy.qyWarning,
            () => _shareCheckIn(context, 'ginseng_soup'),
          ),
          const SizedBox(height: 16),
          _buildShareCard(
            context,
            QyAppLocalizationKeys.qyCheckinShareTravelBear.tr(context),
            '0/9',
            QyAppLocalizationKeys.qyCheckinShareTravelBearDesc.tr(context),
            AppTheme.primaryGreen,
            () => _shareCheckIn(context, 'travel_bear'),
          ),
        ],
      ),
    );
  }

  Widget _buildShareCard(BuildContext context, String title, String progress,
      String description, Color color, VoidCallback onTap) {
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
                    color: ColorsAppQy.qyTextTertiary,
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
                  foregroundColor: ColorsAppQy.qyTextOnPrimary,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  minimumSize: Size.zero,
                ),
                child: Text(QyAppLocalizationKeys.qyCheckinGoShare.tr(context)),
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
            color: ColorsAppQy.qyInfo.withOpacity(0.3),
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
                color: ColorsAppQy.qyTextOnPrimary,
                size: 32,
              ),
              const SizedBox(width: 12),
              Text(
                QyAppLocalizationKeys.qyCheckinGoToLottery.tr(context),
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: ColorsAppQy.qyTextOnPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            QyAppLocalizationKeys.qyCheckinUseVouchers.tr(context),
            style: TextStyle(
              fontSize: 16,
              color: ColorsAppQy.qyFrostWhite,
            ),
          ),
          const SizedBox(height: 12),
          GradientButton(
            text: QyAppLocalizationKeys.qyCheckinLotteryNow.tr(context),
            onPressed: _showLotteryDialog,
            gradient: LinearGradient(
              colors: [ColorsAppQy.qyTextOnPrimary, ColorsAppQy.qyFrostMedium],
            ),
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
        content: Text(
            '${QyAppLocalizationKeys.qyCheckinCheckinSuccess.tr(context)}${QyAppLocalizationKeys.qyCheckinGotFlowers.tr(context).replaceAll('{count}', '${_dailyRewards[_currentStreak % 7].flowers}')}'),
        backgroundColor: AppTheme.accentGreen,
      ),
    );
  }

  void _shareCheckIn(BuildContext context, String type) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(QyAppLocalizationKeys.qyCheckinShareImage.tr(context)),
        content:
            Text(QyAppLocalizationKeys.qyCheckinShareFeatureInDev.tr(context)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(QyAppLocalizationKeys.qyOk.tr(context)),
          ),
        ],
      ),
    );
  }

  void _showLotteryDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(QyAppLocalizationKeys.qyCheckinLotterySystem.tr(context)),
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
              QyAppLocalizationKeys.qyCheckinCurrentVouchers
                  .tr(context)
                  .replaceAll('{count}', '$_vouchers'),
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '${QyAppLocalizationKeys.qyCheckinVoucherConversion.tr(context)}\n${QyAppLocalizationKeys.qyCheckinVoucherRequired.tr(context)}',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: ColorsAppQy.qyTextTertiary,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(QyAppLocalizationKeys.qyOk.tr(context)),
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

  Map<String, dynamic> toJson() {
    return {
      'day': day,
      'flowers': flowers,
      'checked': checked,
    };
  }

  factory DailyReward.fromJson(Map<String, dynamic> json) {
    return DailyReward(
      day: json['day'] as int,
      flowers: json['flowers'] as int,
      checked: json['checked'] as bool? ?? false,
    );
  }
}
