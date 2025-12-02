/// About screen
library;

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../../../common/i18n/i18n_service.dart';
import '../../../../../../common/theme/app_theme.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';

class AboutScreen extends StatefulWidget {
  const AboutScreen({super.key});

  @override
  State<AboutScreen> createState() => _AboutScreenState();
}

class _AboutScreenState extends State<AboutScreen> {
  final String _version = '5.9.602';

  List<Map<String, dynamic>> _getPartners(BuildContext context) {
    return [
      {
        'nameKey': QyAppLocalizationKeys.qyAboutPartnerOxford,
        'descriptionKey': QyAppLocalizationKeys.qyAboutPartnerOxfordDesc,
        'logo': Icons.school,
        'color': AppTheme.primaryGreen,
      },
      {
        'nameKey': QyAppLocalizationKeys.qyAboutPartnerCollins,
        'descriptionKey': QyAppLocalizationKeys.qyAboutPartnerCollinsDesc,
        'logo': Icons.menu_book,
        'color': AppTheme.secondaryGreen,
      },
    ];
  }

  List<Map<String, dynamic>> _getOpenSourceProjects(BuildContext context) {
    return [
      {
        'nameKey': QyAppLocalizationKeys.qyAboutOpenSourceRxJava,
        'url': 'https://github.com/Reactivex/RxJava',
        'descriptionKey': QyAppLocalizationKeys.qyAboutOpenSourceRxJavaDesc,
      },
      {
        'nameKey': QyAppLocalizationKeys.qyAboutOpenSourceRetrofit,
        'url': 'https://github.com/square/retrofit',
        'descriptionKey': QyAppLocalizationKeys.qyAboutOpenSourceRetrofitDesc,
      },
      {
        'nameKey': QyAppLocalizationKeys.qyAboutOpenSourceRxLifecycle,
        'url': 'https://github.com/trello/RxLifecycle',
        'descriptionKey': QyAppLocalizationKeys.qyAboutOpenSourceRxLifecycleDesc,
      },
    ];
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
                    _buildAppInfo(context),
                    const SizedBox(height: 32),
                    _buildPartners(context),
                    const SizedBox(height: 32),
                    _buildOpenSource(context),
                    const SizedBox(height: 32),
                    _buildLegalInfo(context),
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
              QyAppLocalizationKeys.qyAbout.tr(context),
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

  Widget _buildAppInfo(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: ColorsAppQy.qyTextOnPrimary,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: ColorsAppQy.qyShadowLight,
            blurRadius: 15,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              gradient: AppTheme.primaryGradient,
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: AppTheme.primaryGreen.withOpacity(0.3),
                  blurRadius: 10,
                  offset: const Offset(0, 5),
                ),
              ],
            ),
            child: const Icon(
              Icons.translate,
              color: ColorsAppQy.qyTextOnPrimary,
              size: 40,
            ),
          ),
          const SizedBox(height: 20),
          Text(
            QyAppLocalizationKeys.qyAboutAppName.tr(context),
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: AppTheme.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            QyAppLocalizationKeys.qyAboutAppSlogan.tr(context),
            style: TextStyle(
              fontSize: 16,
              color: ColorsAppQy.qyTextTertiary,
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: AppTheme.primaryGreen.withOpacity(0.1),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              '${QyAppLocalizationKeys.qyAboutVersion.tr(context)} $_version',
              style: const TextStyle(
                fontSize: 14,
                color: AppTheme.primaryGreen,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPartners(BuildContext context) {
    final partners = _getPartners(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          QyAppLocalizationKeys.qyAboutPartners.tr(context),
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: AppTheme.textPrimary,
          ),
        ),
        const SizedBox(height: 16),
        Container(
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
            children: partners.asMap().entries.map((entry) {
              final index = entry.key;
              final partner = entry.value;
              final isLast = index == partners.length - 1;

              return Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.all(20),
                    child: Row(
                      children: [
                        Container(
                          width: 60,
                          height: 60,
                          decoration: BoxDecoration(
                            color: (partner['color'] as Color).withOpacity(0.1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(
                            partner['logo'] as IconData,
                            color: partner['color'] as Color,
                            size: 30,
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                (partner['nameKey'] as String).tr(context),
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: AppTheme.textPrimary,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                (partner['descriptionKey'] as String).tr(context),
                                style: TextStyle(
                                  fontSize: 14,
                                  color: ColorsAppQy.qyTextTertiary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (!isLast)
                    const Divider(height: 1, indent: 96),
                ],
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _buildOpenSource(BuildContext context) {
    final projects = _getOpenSourceProjects(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '开源���可',
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: AppTheme.textPrimary,
          ),
        ),
        const SizedBox(height: 16),
        Container(
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
            children: _getOpenSourceProjects(context).asMap().entries.map((entry) {
              final index = entry.key;
              final project = entry.value;
              final isLast = index == _getOpenSourceProjects(context).length - 1;

              return InkWell(
                onTap: () => _launchURL(context, project['url'] as String),
                borderRadius: BorderRadius.circular(16),
                child: Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(20),
                      child: Row(
                        children: [
                          Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: AppTheme.accentGreen.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Icon(
                              Icons.code,
                              color: AppTheme.accentGreen,
                              size: 24,
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  (project['nameKey'] as String).tr(context),
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                    color: AppTheme.textPrimary,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  (project['descriptionKey'] as String).tr(context),
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: ColorsAppQy.qyTextTertiary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Icon(
                            Icons.launch,
                            color: ColorsAppQy.qyTextSecondary,
                            size: 20,
                          ),
                        ],
                      ),
                    ),
                    if (!isLast)
                      const Divider(height: 1, indent: 76),
                  ],
                ),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _buildLegalInfo(BuildContext context) {
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
          Row(
            children: [
              Icon(
                Icons.gavel,
                color: ColorsAppQy.qyTextTertiary,
                size: 20,
              ),
              const SizedBox(width: 12),
              Text(
                QyAppLocalizationKeys.qyAboutLegalInfo.tr(context),
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            QyAppLocalizationKeys.qyAboutIcpNumber.tr(context),
            style: TextStyle(
              fontSize: 14,
              color: ColorsAppQy.qyTextTertiary,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              TextButton(
                onPressed: () => _showUserAgreement(context),
                child: Text(
                  QyAppLocalizationKeys.qyAboutUserAgreement.tr(context),
                  style: TextStyle(color: AppTheme.primaryGreen),
                ),
              ),
              TextButton(
                onPressed: () => _showPrivacyPolicy(context),
                child: Text(
                  QyAppLocalizationKeys.qyAboutPrivacyPolicy.tr(context),
                  style: TextStyle(color: AppTheme.primaryGreen),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _launchURL(BuildContext context, String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(QyAppLocalizationKeys.qyAboutCannotOpenUrl.tr(context).replaceAll('{url}', url)),
          backgroundColor: ColorsAppQy.qyError,
        ),
      );
    }
  }

  void _showUserAgreement(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(QyAppLocalizationKeys.qyAboutUserAgreement.tr(context)),
        content: SingleChildScrollView(
          child: Text(
            QyAppLocalizationKeys.qyAboutUserAgreementContent.tr(context),
          ),
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

  void _showPrivacyPolicy(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(QyAppLocalizationKeys.qyAboutPrivacyPolicy.tr(context)),
        content: SingleChildScrollView(
          child: Text(
            QyAppLocalizationKeys.qyAboutPrivacyPolicyContent.tr(context),
          ),
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