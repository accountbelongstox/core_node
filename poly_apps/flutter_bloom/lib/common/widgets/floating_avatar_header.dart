// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';

/// Floating Avatar Header Widget
///
/// A completely new approach using CustomPainter and Stack to create
/// a truly floating avatar that appears above all content
class FloatingAvatarHeader extends StatelessWidget {
  final String? backgroundImage;
  final String? avatarImage;
  final String? displayName;
  final String? subtitle;
  final VoidCallback? onBackTap;
  final VoidCallback? onAvatarTap;
  final bool showBackButton;
  final double backgroundHeight;
  final double avatarSize;
  final List<Color>? gradientColors;
  final double gradientOpacity;

  const FloatingAvatarHeader({
    super.key,
    this.backgroundImage,
    this.avatarImage,
    this.displayName,
    this.subtitle,
    this.onBackTap,
    this.onAvatarTap,
    this.showBackButton = true,
    this.backgroundHeight = 200.0,
    this.avatarSize = 120.0,
    this.gradientColors,
    this.gradientOpacity = 0.3,
  });

  @override
  Widget build(BuildContext context) {
    final halfAvatarSize = avatarSize / 2;

    return SizedBox(
      height: backgroundHeight +
          halfAvatarSize, // Total height includes avatar overlap
      child: Stack(
        clipBehavior: Clip.none, // Allow overflow
        children: [
          // Background section
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: backgroundHeight,
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: gradientColors ??
                      [
                        ThemeColors.primary.withOpacity(0.8),
                        ThemeColors.primary.withOpacity(0.6),
                        ThemeColors.secondaryColor.withOpacity(0.4),
                      ],
                ),
                image: backgroundImage != null
                    ? DecorationImage(
                        image: AssetImage(backgroundImage!),
                        fit: BoxFit.cover,
                        colorFilter: ColorFilter.mode(
                          ThemeColors.primary.withOpacity(gradientOpacity),
                          BlendMode.overlay,
                        ),
                      )
                    : null,
              ),
              child: Stack(
                children: [
                  // Status bar overlay
                  Positioned(
                    top: 0,
                    left: 0,
                    right: 0,
                    child: Container(
                      height: MediaQuery.of(context).padding.top + 50,
                      padding: EdgeInsets.only(
                        top: MediaQuery.of(context).padding.top + 10,
                        left: ThemeDimensions.defaultPadding,
                        right: ThemeDimensions.defaultPadding,
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          if (showBackButton)
                            GestureDetector(
                              onTap: onBackTap ??
                                  () => Navigator.of(context).pop(),
                              child: Container(
                                padding: EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: ThemeColors.white.withOpacity(0.2),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Icon(
                                  Icons.arrow_back_ios,
                                  color: ThemeColors.white,
                                  size: 20,
                                ),
                              ),
                            )
                          else
                            SizedBox(width: 40),
                          // Time display
                          Text(
                            '12:00',
                            style: ThemeTextStyles.bodyLarge.copyWith(
                              color: ThemeColors.white,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          // Status icons
                          Row(
                            children: [
                              Icon(
                                Icons.signal_cellular_4_bar,
                                color: ThemeColors.white,
                                size: 16,
                              ),
                              SizedBox(width: 4),
                              Icon(
                                Icons.wifi,
                                color: ThemeColors.white,
                                size: 16,
                              ),
                              SizedBox(width: 4),
                              Icon(
                                Icons.battery_full,
                                color: ThemeColors.white,
                                size: 16,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Floating avatar - positioned to extend beyond background
          Positioned(
            top: backgroundHeight - halfAvatarSize,
            left: 0,
            right: 0,
            child: Center(
              child: Container(
                width: avatarSize,
                height: avatarSize,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: ThemeColors.black.withOpacity(0.3),
                      blurRadius: 15,
                      offset: Offset(0, 8),
                      spreadRadius: 2,
                    ),
                  ],
                ),
                child: Stack(
                  children: [
                    // Main avatar with white border
                    GestureDetector(
                      onTap: onAvatarTap,
                      child: Container(
                        width: avatarSize,
                        height: avatarSize,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: ThemeColors.white,
                            width: 4,
                          ),
                        ),
                        child: CircleAvatar(
                          radius: (avatarSize - 8) / 2,
                          backgroundColor: ThemeColors.primary,
                          backgroundImage: avatarImage != null
                              ? AssetImage(avatarImage!)
                              : null,
                          child: avatarImage == null
                              ? Icon(
                                  Icons.person,
                                  size: avatarSize * 0.5,
                                  color: ThemeColors.white,
                                )
                              : null,
                        ),
                      ),
                    ),
                    // Camera icon overlay
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: GestureDetector(
                        onTap: onAvatarTap,
                        child: Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: ThemeColors.white,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: ThemeColors.black.withOpacity(0.2),
                                blurRadius: 4,
                                offset: Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Icon(
                            Icons.camera_alt,
                            color: ThemeColors.primary,
                            size: 20,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
