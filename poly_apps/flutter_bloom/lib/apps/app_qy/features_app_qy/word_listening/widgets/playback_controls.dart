/// Playback controls widget for word listening
/// Follows Flutter Bloom architecture: theme centralization, glassmorphism
library;

import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/widgets/cards/premium_cards.dart';
import 'package:qyflutter/common/widgets/animations/animation_utils.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';
import 'package:qyflutter/apps/app_qy/localization_app_qy/localization_keys_app_qy.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';

class PlaybackControls extends StatelessWidget {
  final bool isPlaying;
  final int currentIndex;
  final int totalWords;
  final double playbackSpeed;
  final bool isLooping;
  final bool isShuffling;
  final VoidCallback? onPlayPause;
  final VoidCallback? onPrevious;
  final VoidCallback? onNext;
  final Function(double)? onSpeedChanged;
  final Function()? onLoopChanged;
  final Function()? onShuffleChanged;

  const PlaybackControls({
    super.key,
    required this.isPlaying,
    required this.currentIndex,
    required this.totalWords,
    required this.playbackSpeed,
    required this.isLooping,
    required this.isShuffling,
    this.onPlayPause,
    this.onPrevious,
    this.onNext,
    this.onSpeedChanged,
    this.onLoopChanged,
    this.onShuffleChanged,
  });

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Padding(
        padding: EdgeInsets.all(ThemeDimensions.spacing20),
        child: Column(
          children: [
            // Progress bar
            Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '${currentIndex + 1}',
                      style: ThemeTextStyles.bodySmall.copyWith(
                        color: ColorsAppQy.qyTextSecondary,
                      ),
                    ),
                    Text(
                      '${(currentIndex / totalWords * 100).toInt()}%',
                      style: ThemeTextStyles.bodySmall.copyWith(
                        color: ColorsAppQy.qyTextSecondary,
                      ),
                    ),
                    Text(
                      '$totalWords',
                      style: ThemeTextStyles.bodySmall.copyWith(
                        color: ColorsAppQy.qyTextSecondary,
                      ),
                    ),
                  ],
                ),
                SizedBox(height: ThemeDimensions.spacing8),
                LinearProgressIndicator(
                  value: (currentIndex + 1) / totalWords,
                  backgroundColor: ColorsAppQy.qyHolographicMedium,
                  valueColor: AlwaysStoppedAnimation<Color>(ColorsAppQy.qyPrimary),
                  minHeight: 4,
                  borderRadius: ThemeDimensions.borderRadiusS,
                ),
              ],
            ),
            SizedBox(height: ThemeDimensions.spacing20),

            // Main playback controls
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                // Shuffle button
                BouncingButton(
                  onPressed: onShuffleChanged,
                  child: Icon(
                    Icons.shuffle,
                    color: isShuffling ? ColorsAppQy.qyPrimary : ColorsAppQy.qyTextTertiary,
                    size: ThemeDimensions.iconSizeM,
                  ),
                ),

                // Previous button
                BouncingButton(
                  onPressed: currentIndex > 0 ? onPrevious : null,
                  child: Icon(
                    Icons.skip_previous,
                    color: currentIndex > 0 ? ColorsAppQy.qyTextPrimary : ColorsAppQy.qyTextTertiary,
                    size: ThemeDimensions.iconSizeL,
                  ),
                ),

                // Play/Pause button
                Container(
                  decoration: BoxDecoration(
                    gradient: ColorsAppQy.qyPrimaryGradient,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: ColorsAppQy.qyPrimary.withOpacity(0.3),
                        blurRadius: 15,
                        offset: const Offset(0, 5),
                      ),
                    ],
                  ),
                  child: BouncingButton(
                    onPressed: onPlayPause,
                    child: Icon(
                      isPlaying ? Icons.pause : Icons.play_arrow,
                      color: ColorsAppQy.qyTextOnPrimary,
                      size: ThemeDimensions.iconSizeXL,
                    ),
                  ),
                ),

                // Next button
                BouncingButton(
                  onPressed: currentIndex < totalWords - 1 ? onNext : null,
                  child: Icon(
                    Icons.skip_next,
                    color: currentIndex < totalWords - 1 ? ColorsAppQy.qyTextPrimary : ColorsAppQy.qyTextTertiary,
                    size: ThemeDimensions.iconSizeL,
                  ),
                ),

                // Loop button
                BouncingButton(
                  onPressed: onLoopChanged,
                  child: Icon(
                    Icons.loop,
                    color: isLooping ? ColorsAppQy.qyAccent : ColorsAppQy.qyTextTertiary,
                    size: ThemeDimensions.iconSizeM,
                  ),
                ),
              ],
            ),

            SizedBox(height: ThemeDimensions.spacing16),

            // Speed control
            Row(
              children: [
                Icon(
                  Icons.speed,
                  color: ColorsAppQy.qyTextSecondary,
                  size: ThemeDimensions.iconSizeS,
                ),
                SizedBox(width: ThemeDimensions.spacing8),
                Text(
                  '${QyAppLocalizationKeys.qyListeningSpeed.tr(context)}: ${playbackSpeed}x',
                  style: ThemeTextStyles.bodyMedium.copyWith(
                    color: ColorsAppQy.qyTextSecondary,
                  ),
                ),
                const Spacer(),
                Container(
                  decoration: BoxDecoration(
                    color: ColorsAppQy.qyPrimary.withOpacity(0.1),
                    borderRadius: ThemeDimensions.borderRadiusM,
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((speed) {
                      final isSelected = speed == playbackSpeed;
                      return GestureDetector(
                        onTap: () => onSpeedChanged?.call(speed),
                        child: AnimatedContainer(
                          duration: Duration(milliseconds: ThemeDimensions.animationDurationNormal),
                          margin: EdgeInsets.all(ThemeDimensions.spacing2),
                          padding: EdgeInsets.symmetric(
                            horizontal: ThemeDimensions.spacing8,
                            vertical: ThemeDimensions.spacing4,
                          ),
                          decoration: BoxDecoration(
                            color: isSelected ? ColorsAppQy.qyPrimary : Colors.transparent,
                            borderRadius: ThemeDimensions.borderRadiusS,
                          ),
                          child: Text(
                            '${speed}x',
                            style: ThemeTextStyles.bodySmall.copyWith(
                              color: isSelected ? ColorsAppQy.qyTextOnPrimary : ColorsAppQy.qyTextSecondary,
                              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
      borderRadius: ThemeDimensions.borderRadiusL,
    );
  }
}
