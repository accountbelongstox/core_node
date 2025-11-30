/// Playback controls widget for word listening
/// Follows Flutter Bloom architecture: theme centralization, glassmorphism
library;

import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/widgets/cards/premium_cards.dart';
import 'package:qyflutter/common/widgets/animations/animation_utils.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';

class PlaybackControls extends StatelessWidget {
  final bool isPlaying;
  final VoidCallback onPlayPause;
  final VoidCallback? onPrevious;
  final VoidCallback? onNext;

  const PlaybackControls({
    super.key,
    required this.isPlaying,
    required this.onPlayPause,
    this.onPrevious,
    this.onNext,
  });

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: ThemeDimensions.spacing16),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (onPrevious != null)
              BouncingButton(
                onPressed: onPrevious,
                child: Icon(
                  Icons.skip_previous,
                  size: ThemeDimensions.iconSizeXL,
                  color: ColorsAppQy.qyPrimary,
                ),
              ),
            SizedBox(width: ThemeDimensions.spacing20),
            Container(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: ColorsAppQy.qyPrimaryGradient,
              ),
              child: BouncingButton(
                onPressed: onPlayPause,
                child: Icon(
                  isPlaying ? Icons.pause : Icons.play_arrow,
                  size: ThemeDimensions.iconSizeXXL,
                  color: ColorsAppQy.qyTextOnPrimary,
                ),
              ),
            ),
            SizedBox(width: ThemeDimensions.spacing20),
            if (onNext != null)
              BouncingButton(
                onPressed: onNext,
                child: Icon(
                  Icons.skip_next,
                  size: ThemeDimensions.iconSizeXL,
                  color: ColorsAppQy.qyPrimary,
                ),
              ),
          ],
        ),
      ),
      borderRadius: ThemeDimensions.borderRadiusL,
    );
  }
}
