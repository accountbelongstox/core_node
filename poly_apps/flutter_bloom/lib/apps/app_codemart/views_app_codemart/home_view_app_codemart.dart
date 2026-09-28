import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';

import '../localization_app_codemart/localization_keys_app_codemart.dart';
import '../models_app_codemart/codemart_types.dart';
import '../models_app_codemart/user_model_app_codemart.dart';
import '../resources_app_codemart/colors_app_codemart.dart';
import '../resources_app_codemart/components_app_codemart.dart';
import '../resources_app_codemart/text_styles_app_codemart.dart';
import '../router_app_codemart/router_app_codemart.dart';

class HomeViewAppCodemart extends StatelessWidget {
  const HomeViewAppCodemart({super.key});

  @override
  Widget build(BuildContext context) {
    final UserModelAppCodemart userModel = context.watch<UserModelAppCodemart>();
    final DeveloperProfile? developerProfile = userModel.developerProfile;
    final ClientProfile? clientProfile = userModel.clientProfile;
    final bool isDeveloper = userModel.isDeveloper;
    final bool isClient = userModel.isClient;

    final List<_StatusMetric> metrics = <_StatusMetric>[
      _StatusMetric(
        label: LocalizationKeysAppCodemart.codemartMetricActiveProjects.tr(context),
        value: (clientProfile?.postedProjects ?? developerProfile?.completedProjects ?? 0).toString(),
        icon: Icons.bolt_outlined,
      ),
      _StatusMetric(
        label: LocalizationKeysAppCodemart.codemartMetricCompleted.tr(context),
        value: (developerProfile?.completedProjects ?? 0).toString(),
        icon: Icons.task_alt_outlined,
      ),
      _StatusMetric(
        label: LocalizationKeysAppCodemart.codemartMetricBudget.tr(context),
        value: _formatBudget(clientProfile?.totalSpent ?? developerProfile?.points?.toDouble()),
        icon: Icons.account_balance_wallet_outlined,
      ),
      _StatusMetric(
        label: LocalizationKeysAppCodemart.codemartMetricPendingReviews.tr(context),
        value: (developerProfile?.certifications.length ?? clientProfile?.totalProjects ?? 0).toString(),
        icon: Icons.verified_outlined,
      ),
    ];

    final List<Widget> quickActions = <Widget>[
      if (isDeveloper)
        CodemartQuickActionButton(
          icon: Icons.workspaces_outlined,
          title: LocalizationKeysAppCodemart.codemartTaskHall.tr(context),
          subtitle: LocalizationKeysAppCodemart.codemartQuickActionTaskHallSubtitle.tr(context),
          onTap: () => RouterAppCodemart.goToTaskHall(context),
          accentColor: CodemartColors.badgePurple,
        ),
      if (isDeveloper)
        CodemartQuickActionButton(
          icon: Icons.assignment_turned_in_outlined,
          title: LocalizationKeysAppCodemart.codemartTasks.tr(context),
          subtitle: LocalizationKeysAppCodemart.codemartQuickActionTasksSubtitle.tr(context),
          onTap: () => RouterAppCodemart.goToMyTasks(context),
          accentColor: CodemartColors.badgeBlue,
        ),
      if (isClient)
        CodemartQuickActionButton(
          icon: Icons.add_circle_outline,
          title: LocalizationKeysAppCodemart.codemartCreateProject.tr(context),
          subtitle: LocalizationKeysAppCodemart.codemartQuickActionCreateProjectSubtitle.tr(context),
          onTap: () => RouterAppCodemart.goToCreateProject(context),
          accentColor: CodemartColors.badgeCyan,
        ),
      CodemartQuickActionButton(
        icon: Icons.folder_special_outlined,
        title: LocalizationKeysAppCodemart.codemartProjects.tr(context),
        subtitle: LocalizationKeysAppCodemart.codemartQuickActionProjectsSubtitle.tr(context),
        onTap: () => RouterAppCodemart.goToProjects(context),
        accentColor: CodemartColors.accent,
      ),
      CodemartQuickActionButton(
        icon: Icons.account_balance_wallet_outlined,
        title: LocalizationKeysAppCodemart.codemartWallet.tr(context),
        subtitle: LocalizationKeysAppCodemart.codemartQuickActionWalletSubtitle.tr(context),
        onTap: () => RouterAppCodemart.goToWallet(context),
        accentColor: CodemartColors.success,
      ),
    ];

    final int crossAxisCount = MediaQuery.of(context).size.width > 1100 ? 3 : 2;

    return CodemartBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          title: Text(LocalizationKeysAppCodemart.codemartAppName.tr(context)),
          backgroundColor: Colors.transparent,
          actions: <Widget>[
            IconButton(
              icon: const Icon(Icons.person_outline),
              onPressed: () => RouterAppCodemart.goToProfile(context),
            ),
          ],
        ),
        body: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              CodemartGlassCard(
                gradient: CodemartColors.buildGradient(
                  CodemartColors.heroGradient,
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                showBorder: false,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      LocalizationKeysAppCodemart.codemartWelcomeBackTitle.tr(context),
                      style: CodemartTextStyles.heroTitle,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      LocalizationKeysAppCodemart.codemartWelcomeBackSubtitle.tr(context),
                      style: CodemartTextStyles.heroSubtitle,
                    ),
                    const SizedBox(height: 18),
                    Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      children: _buildRoleBadges(context, userModel),
                    ),
                    const SizedBox(height: 24),
                    Wrap(
                      spacing: 16,
                      runSpacing: 16,
                      children: metrics
                          .map(
                            (metric) => _MetricTile(metric: metric),
                          )
                          .toList(),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),
              Text(
                LocalizationKeysAppCodemart.codemartQuickActions.tr(context),
                style: CodemartTextStyles.sectionTitle,
              ),
              const SizedBox(height: 16),
              GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: crossAxisCount,
                childAspectRatio: 1.05,
                crossAxisSpacing: 18,
                mainAxisSpacing: 18,
                children: quickActions,
              ),
            ],
          ),
        ),
      ),
    );
  }

  static String _formatBudget(double? amount) {
    if (amount == null) {
      return '--';
    }
    if (amount >= 1000000) {
      return '\$${(amount / 1000000).toStringAsFixed(1)}M';
    }
    if (amount >= 1000) {
      return '\$${(amount / 1000).toStringAsFixed(1)}k';
    }
    return '\$${amount.toStringAsFixed(0)}';
  }

  List<Widget> _buildRoleBadges(BuildContext context, UserModelAppCodemart userModel) {
    final List<Widget> badges = <Widget>[];
    if (userModel.isDeveloper) {
      badges.add(_RoleBadge(
        label: LocalizationKeysAppCodemart.codemartDeveloper.tr(context),
        color: CodemartColors.badgePurple,
        icon: Icons.auto_awesome,
      ));
    }
    if (userModel.isClient) {
      badges.add(_RoleBadge(
        label: LocalizationKeysAppCodemart.codemartClient.tr(context),
        color: CodemartColors.badgeCyan,
        icon: Icons.business_center_outlined,
      ));
    }
    if (userModel.isArchitect) {
      badges.add(_RoleBadge(
        label: LocalizationKeysAppCodemart.codemartArchitect.tr(context),
        color: CodemartColors.accent,
        icon: Icons.hub_outlined,
      ));
    }
    if (userModel.isReviewer) {
      badges.add(_RoleBadge(
        label: LocalizationKeysAppCodemart.codemartReviewer.tr(context),
        color: CodemartColors.success,
        icon: Icons.verified,
      ));
    }
    if (badges.isEmpty) {
      badges.add(_RoleBadge(
        label: LocalizationKeysAppCodemart.codemartUser.tr(context),
        color: CodemartColors.badgeBlue,
        icon: Icons.person_outline,
      ));
    }
    return badges;
  }
}

class _RoleBadge extends StatelessWidget {
  final String label;
  final Color color;
  final IconData icon;

  const _RoleBadge({
    required this.label,
    required this.color,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: color.withOpacity(0.5)),
        color: color.withOpacity(0.15),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 8),
          Text(
            label,
            style: CodemartTextStyles.body.copyWith(color: color),
          ),
        ],
      ),
    );
  }
}

class _StatusMetric {
  final String label;
  final String value;
  final IconData icon;

  const _StatusMetric({
    required this.label,
    required this.value,
    required this.icon,
  });
}

class _MetricTile extends StatelessWidget {
  final _StatusMetric metric;

  const _MetricTile({required this.metric});

  @override
  Widget build(BuildContext context) {
    return CodemartGlassCard(
      padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 20),
      gradient: CodemartColors.buildGradient(
        <Color>[
          CodemartColors.surface.withOpacity(0.95),
          CodemartColors.surfaceHover.withOpacity(0.85),
        ],
      ),
      child: Row(
        children: <Widget>[
          Container(
            height: 44,
            width: 44,
            decoration: BoxDecoration(
              color: CodemartColors.surfaceElevated,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: CodemartColors.outline.withOpacity(0.5)),
            ),
            child: Icon(metric.icon, color: CodemartColors.secondary),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  metric.value,
                  style: CodemartTextStyles.sectionTitle.copyWith(fontSize: 24),
                ),
                const SizedBox(height: 4),
                Text(
                  metric.label,
                  style: CodemartTextStyles.bodyMuted,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
