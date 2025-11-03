/// Certificate Center screen for achievements and certificates
library certificate_center_screen;

import 'package:flutter/material.dart';
import '../../../../../../common/i18n/i18n_service.dart';
import '../../../../../../common/theme/app_theme.dart';
import '../../../../../../common/widgets/animations/animation_utils.dart';

class CertificateCenterScreen extends StatefulWidget {
  const CertificateCenterScreen({super.key});

  @override
  State<CertificateCenterScreen> createState() => _CertificateCenterScreenState();
}

class _CertificateCenterScreenState extends State<CertificateCenterScreen>
    with TickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;

  final List<Map<String, dynamic>> _certificates = [
    {
      'title': '英语学习初级证书',
      'description': '完成基础英语学习课程',
      'earnedDate': '2024-01-15',
      'level': '初级',
      'color': AppTheme.newColor,
      'icon': Icons.school,
      'badge': '新手',
      'locked': false,
    },
    {
      'title': '单词掌握达人',
      'description': '累计掌握1000个单词',
      'earnedDate': '2024-02-20',
      'level': '中级',
      'color': AppTheme.learningColor,
      'icon': Icons.menu_book,
      'badge': '勤奋',
      'locked': false,
    },
    {
      'title': '听力挑战大师',
      'description': '连续30天完成听力练习',
      'earnedDate': '2024-03-10',
      'level': '高级',
      'color': AppTheme.masteredColor,
      'icon': Icons.headphones,
      'badge': '坚持',
      'locked': false,
    },
    {
      'title': '学习全勤奖',
      'description': '连续学习90天不间断',
      'earnedDate': '2024-04-05',
      'level': '高级',
      'color': AppTheme.primaryGreen,
      'icon': Icons.emoji_events,
      'badge': '全勤',
      'locked': false,
    },
    {
      'title': '词汇专家认证',
      'description': '掌握5000个高阶词汇',
      'level': '专家',
      'color': AppTheme.darkGreen,
      'icon': Icons.workspace_premium,
      'badge': '专家',
      'locked': true,
    },
    {
      'title': '雅思高分证书',
      'description': '雅思考试7.5分以上',
      'level': '专家',
      'color': AppTheme.error,
      'icon': Stars.star,
      'badge': '卓越',
      'locked': true,
    },
  ];

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: ComponentStyles.normalDuration,
      vsync: this,
    );
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: ComponentStyles.primaryCurve),
    );
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              AppTheme.midnightGradient.colors[0].withOpacity(0.15),
              AppTheme.midnightGradient.colors[1].withOpacity(0.08),
              Colors.white,
            ],
          ),
        ),
        child: SafeArea(
          child: FadeTransition(
            opacity: _fadeAnimation,
            child: Column(
              children: [
                _buildAppBar(),
                _buildStatsHeader(),
                Expanded(
                  child: _buildCertificatesGrid(),
                ),
              ],
            ),
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
          BouncingButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Icon(
              Icons.arrow_back,
              color: AppTheme.textPrimary,
              size: 24,
            ),
          ),
          Expanded(
            child: Column(
              children: [
                Text(
                  '证书中心',
                  style: AppTextStyles.headline4.copyWith(
                    color: AppTheme.textPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  '查看你的学习成就',
                  style: AppTextStyles.bodyMedium.copyWith(
                    color: AppTheme.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          BouncingButton(
            onPressed: _showShareOptions,
            child: Icon(
              Icons.share,
              color: AppTheme.primaryGreen,
              size: 24,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatsHeader() {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: AppTheme.midnightGradient,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          Expanded(
            child: _buildStatItem(
              '已获得',
              '${_certificates.where((c) => !(c['locked'] as bool)).length}',
              Icons.workspace_premium,
              Colors.white,
            ),
          ),
          Container(
            width: 1,
            height: 40,
            color: Colors.white.withOpacity(0.3),
          ),
          Expanded(
            child: _buildStatItem(
              '进行中',
              '2',
              Icons.pending,
              Colors.white,
            ),
          ),
          Container(
            width: 1,
            height: 40,
            color: Colors.white.withOpacity(0.3),
          ),
          Expanded(
            child: _buildStatItem(
              '总积分',
              '2850',
              Icons.trending_up,
              Colors.white,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(String label, String value, IconData icon, Color color) {
    return Column(
      children: [
        Icon(icon, color: color, size: 24),
        const SizedBox(height: 8),
        Text(
          value,
          style: AppTextStyles.headline4.copyWith(
            color: color,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: AppTextStyles.bodySmall.copyWith(
            color: color.withOpacity(0.9),
          ),
        ),
      ],
    );
  }

  Widget _buildCertificatesGrid() {
    return GridView.builder(
      padding: const EdgeInsets.all(16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        childAspectRatio: 0.85,
        crossAxisSpacing: 16,
        mainAxisSpacing: 16,
      ),
      itemCount: _certificates.length,
      itemBuilder: (context, index) {
        final certificate = _certificates[index];
        return AnimationUtils.staggeredAnimation(
          index: index,
          child: _buildCertificateCard(certificate, index),
        );
      },
    );
  }

  Widget _buildCertificateCard(Map<String, dynamic> certificate, int index) {
    final isLocked = certificate['locked'] as bool;

    return BouncingButton(
      onPressed: isLocked ? _showLockedMessage : () => _viewCertificate(certificate),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: isLocked
              ? LinearGradient(
                  colors: [Colors.grey.shade300, Colors.grey.shade200],
                )
              : (certificate['color'] as Color) == AppTheme.darkGreen
                  ? AppTheme.midnightGradient
                  : LinearGradient(
                      colors: [
                        (certificate['color'] as Color).withOpacity(0.2),
                        (certificate['color'] as Color).withOpacity(0.1),
                      ],
                    ),
          border: Border.all(
            color: isLocked ? Colors.grey.shade400 : Colors.transparent,
            width: 2,
          ),
          boxShadow: [
            BoxShadow(
              color: isLocked
                  ? Colors.grey.shade300
                  : (certificate['color'] as Color).withOpacity(0.3),
              blurRadius: isLocked ? 8 : 15,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            gradient: isLocked
                ? LinearGradient(
                    colors: [Colors.grey.shade50, Colors.white],
                  )
                : LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Colors.white.withOpacity(0.9),
                      Colors.white.withOpacity(0.7),
                    ],
                  ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 50,
                    height: 50,
                    decoration: BoxDecoration(
                      color: isLocked
                          ? Colors.grey.shade200
                          : (certificate['color'] as Color).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(25),
                    ),
                    child: isLocked
                        ? Icon(
                            Icons.lock,
                            color: Colors.grey.shade400,
                            size: 24,
                          )
                        : Icon(
                            certificate['icon'] as IconData,
                            color: certificate['color'] as Color,
                            size: 24,
                          ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                certificate['title'] as String,
                                style: AppTextStyles.bodyLarge.copyWith(
                                  color: isLocked
                                      ? Colors.grey.shade600
                                      : AppTheme.textPrimary,
                                  fontWeight: FontWeight.bold,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            if (!isLocked && certificate['badge'] != null)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: (certificate['badgeColor'] as Color),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  certificate['badge'] as String,
                                  style: AppTextStyles.bodySmall.copyWith(
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 10,
                                  ),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          certificate['level'] as String,
                          style: AppTextStyles.bodySmall.copyWith(
                            color: isLocked
                                ? Colors.grey.shade500
                                : (certificate['color'] as Color),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                certificate['description'] as String,
                style: AppTextStyles.bodyMedium.copyWith(
                  color: isLocked
                      ? Colors.grey.shade500
                      : AppTheme.textSecondary,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 12),
              if (!isLocked) ...[
                Row(
                  children: [
                    Icon(
                      Icons.calendar_today,
                      color: AppTheme.textHint,
                      size: 16,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      '获得时间: ${certificate['earnedDate']}',
                      style: AppTextStyles.bodySmall.copyWith(
                        color: AppTheme.textSecondary,
                      ),
                    ),
                  ],
                ),
              ],
              if (isLocked) ...[
                Row(
                  children: [
                    Icon(
                      Icons.lock_outline,
                      color: Colors.grey.shade400,
                      size: 16,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      '未解锁',
                      style: AppTextStyles.bodySmall.copyWith(
                        color: Colors.grey.shade500,
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  void _viewCertificate(Map<String, dynamic> certificate) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => CertificateDetailScreen(certificate: certificate),
      ),
    );
  }

  void _showLockedMessage() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('继续努力，早日解锁这个证书！'),
        backgroundColor: AppTheme.warning,
      ),
    );
  }

  void _showShareOptions() {
    showModalBottomSheet(
      context: context,
      builder: (context) => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 60,
              height: 4,
              decoration: BoxDecoration(
                color: AppTheme.borderLight,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            _buildShareOption('分享到微信', 'assets/icons/wechat.png', () {}),
            _buildShareOption('分享到朋友圈', 'assets/icons/wechat_moments.png', () {}),
            _buildShareOption('保存图片', 'assets/icons/save.png', () {}),
            _buildShareOption('复制链接', 'assets/icons/link.png', () {}),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  Widget _buildShareOption(String title, String icon, VoidCallback onTap) {
    return BouncingButton(
      onPressed: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: AppTheme.surfaceLight,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(
                Icons.share,
                color: AppTheme.textSecondary,
                size: 18,
              ),
            ),
            const SizedBox(width: 16),
            Text(
              title,
              style: AppTextStyles.bodyLarge.copyWith(
                color: AppTheme.textPrimary,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Certificate detail screen
class CertificateDetailScreen extends StatelessWidget {
  final Map<String, dynamic> certificate;

  const CertificateDetailScreen({
    super.key,
    required this.certificate,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundLight,
      appBar: AppBar(
        title: Text(
          certificate['title'] as String,
          style: AppTextStyles.headline5.copyWith(
            color: Colors.white,
          ),
        ),
        backgroundColor: (certificate['color'] as Color),
        foregroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.download, color: Colors.white),
            onPressed: _downloadCertificate,
          ),
          IconButton(
            icon: const Icon(Icons.share, color: Colors.white),
            onPressed: _shareCertificate,
          ),
        ],
      ),
      body: Container(
        decoration: BoxDecoration(
          gradient: (certificate['color'] as Color) == AppTheme.darkGreen
              ? AppTheme.midnightGradient
              : LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    (certificate['color'] as Color).withOpacity(0.1),
                    Colors.white,
                  ],
                ),
        ),
        child: Center(
          child: Container(
            width: MediaQuery.of(context).size.width * 0.9,
            height: MediaQuery.of(context).size.height * 0.7,
            margin: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.1),
                  blurRadius: 20,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.workspace_premium,
                        color: certificate['color'] as Color,
                        size: 80,
                      ),
                      const SizedBox(height: 20),
                      Text(
                        certificate['title'] as String,
                        style: AppTextStyles.headline3.copyWith(
                          color: certificate['color'] as Color,
                          fontWeight: FontWeight.bold,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        certificate['level'] as String,
                        style: AppTextStyles.headline5.copyWith(
                          color: AppTheme.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        '颁发日期：${certificate['earnedDate']}',
                        style: AppTextStyles.bodyLarge.copyWith(
                          color: AppTheme.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 32),
                      Text(
                        '证书编号：${DateTime.now().millisecondsSinceEpoch}',
                        style: AppTextStyles.bodyMedium.copyWith(
                          color: AppTheme.textHint,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: (certificate['color'] as Color).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: (certificate['color'] as Color).withOpacity(0.3),
                    ),
                  ),
                  child: Text(
                    '此证书由扇贝单词英语学习平台颁发\n\n兹证明学员已完成相关学习要求，\n达到相应学习标准，特发此证以资鼓励。',
                    style: AppTextStyles.bodyMedium.copyWith(
                      color: certificate['color'] as Color,
                      height: 1.6,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _downloadCertificate() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('证书下载功能开发中...'),
        backgroundColor: AppTheme.primaryGreen,
      ),
    );
  }

  void _shareCertificate() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('证书分享功能开发中...'),
        backgroundColor: AppTheme.primaryGreen,
      ),
    );
  }
}