import 'package:flutter/material.dart';

import 'colors_app_codemart.dart';
import 'text_styles_app_codemart.dart';

class CodemartBackground extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;

  const CodemartBackground({
    super.key,
    required this.child,
    this.padding = EdgeInsets.zero,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: CodemartColors.buildGradient(
          CodemartColors.backgroundGradient,
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
      ),
      child: Container(
        padding: padding,
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            radius: 1.4,
            colors: <Color>[
              Color(0x3300F5FF),
              Colors.transparent,
            ],
            stops: <double>[0.2, 1],
          ),
        ),
        child: child,
      ),
    );
  }
}

class CodemartGlassCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final Gradient? gradient;
  final double borderRadius;
  final bool showBorder;

  const CodemartGlassCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.gradient,
    this.borderRadius = 20,
    this.showBorder = true,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: gradient ??
            CodemartColors.buildGradient(
              <Color>[
                CodemartColors.surface.withOpacity(0.9),
                CodemartColors.surfaceElevated.withOpacity(0.85),
              ],
            ),
        borderRadius: BorderRadius.circular(borderRadius),
        border: showBorder
            ? Border.all(
                color: CodemartColors.outline.withOpacity(0.6),
                width: 1.2,
              )
            : null,
        boxShadow: <BoxShadow>[
          BoxShadow(
            color: CodemartColors.primary.withOpacity(0.12),
            blurRadius: 30,
            spreadRadius: 2,
            offset: const Offset(0, 18),
          ),
        ],
      ),
      child: Padding(
        padding: padding,
        child: child,
      ),
    );
  }
}

class CodemartGlowButton extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  final IconData? icon;
  final bool expanded;
  final bool loading;
  final bool enabled;

  const CodemartGlowButton({
    super.key,
    required this.label,
    required this.onTap,
    this.icon,
    this.expanded = true,
    this.loading = false,
    this.enabled = true,
  });

  @override
  Widget build(BuildContext context) {
    final bool canTap = enabled && !loading;
    final Widget content = Row(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: <Widget>[
        if (loading) ...<Widget>[
          SizedBox(
            height: 20,
            width: 20,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              valueColor: AlwaysStoppedAnimation<Color>(CodemartColors.textPrimary),
            ),
          ),
          const SizedBox(width: 8),
        ] else if (icon != null) ...<Widget>[
          Icon(icon, color: CodemartColors.textPrimary),
          const SizedBox(width: 8),
        ],
        Text(label, style: CodemartTextStyles.buttonLarge),
      ],
    );

    return AnimatedContainer(
      duration: const Duration(milliseconds: 250),
      decoration: BoxDecoration(
        gradient: CodemartColors.buildGradient(CodemartColors.buttonGradient),
        boxShadow: <BoxShadow>[
          BoxShadow(
            color: CodemartColors.secondary.withOpacity(0.45),
            blurRadius: 30,
            spreadRadius: 1,
            offset: const Offset(0, 18),
          ),
        ],
        borderRadius: BorderRadius.circular(16),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: canTap ? onTap : null,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            child: expanded ? SizedBox(width: double.infinity, child: content) : content,
          ),
        ),
      ),
    );
  }
}

class CodemartQuickActionButton extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback onTap;
  final Color accentColor;

  const CodemartQuickActionButton({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    required this.onTap,
    this.accentColor = CodemartColors.badgePurple,
  });

  @override
  Widget build(BuildContext context) {
    return CodemartGlassCard(
      padding: const EdgeInsets.all(16),
      gradient: CodemartColors.buildGradient(
        <Color>[
          CodemartColors.surface.withOpacity(0.9),
          CodemartColors.surfaceHover.withOpacity(0.8),
        ],
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Container(
              height: 42,
              width: 42,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: accentColor.withOpacity(0.2),
                border: Border.all(color: accentColor.withOpacity(0.5)),
              ),
              child: Icon(icon, color: accentColor),
            ),
            const SizedBox(height: 16),
            Text(title, style: CodemartTextStyles.sectionTitle.copyWith(fontSize: 18)),
            if (subtitle != null) ...<Widget>[
              const SizedBox(height: 8),
              Text(subtitle!, style: CodemartTextStyles.bodyMuted),
            ],
          ],
        ),
      ),
    );
  }
}

class CodemartSelectableTile extends StatelessWidget {
  final bool selected;
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const CodemartSelectableTile({
    super.key,
    required this.selected,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return CodemartGlassCard(
      padding: const EdgeInsets.all(16),
      gradient: CodemartColors.buildGradient(
        selected
            ? CodemartColors.buttonGradient
            : <Color>[
                CodemartColors.surface.withOpacity(0.85),
                CodemartColors.surfaceElevated.withOpacity(0.8),
              ],
      ),
      showBorder: !selected,
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Row(
          children: <Widget>[
            Icon(
              icon,
              size: 30,
              color: selected ? CodemartColors.textPrimary : CodemartColors.badgeBlue,
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    title,
                    style: CodemartTextStyles.sectionTitle.copyWith(
                      fontSize: 16,
                      color: selected ? CodemartColors.textPrimary : CodemartColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: CodemartTextStyles.bodyMuted,
                  ),
                ],
              ),
            ),
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              height: 18,
              width: 18,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: selected ? CodemartColors.textPrimary : CodemartColors.outline,
                  width: 2,
                ),
                color: selected ? CodemartColors.textPrimary : Colors.transparent,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
