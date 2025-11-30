library;

import 'package:flutter/material.dart';
import '../../../../../../../common/theme/app_theme.dart';

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
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (onPrevious != null)
            IconButton(
              icon: const Icon(Icons.skip_previous),
              iconSize: 36,
              color: AppTheme.primaryGreen,
              onPressed: onPrevious,
            ),
          const SizedBox(width: 20),
          Container(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                colors: [
                  AppTheme.primaryGreen,
                  AppTheme.secondaryGreen,
                ],
              ),
            ),
            child: IconButton(
              icon: Icon(isPlaying ? Icons.pause : Icons.play_arrow),
              iconSize: 48,
              color: Colors.white,
              onPressed: onPlayPause,
            ),
          ),
          const SizedBox(width: 20),
          if (onNext != null)
            IconButton(
              icon: const Icon(Icons.skip_next),
              iconSize: 36,
              color: AppTheme.primaryGreen,
              onPressed: onNext,
            ),
        ],
      ),
    );
  }
}
