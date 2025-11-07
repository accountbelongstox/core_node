/// Playback controls widget for word listening
library;

import 'package:flutter/material.dart';
import '../../../../../../../common/theme/app_theme.dart';

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
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 15,
            offset: const Offset(0, 5),
          ),
        ],
      ),
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
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                  Text(
                    '${(currentIndex / totalWords * 100).toInt()}%',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                  Text(
                    '$totalWords',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              LinearProgressIndicator(
                value: (currentIndex + 1) / totalWords,
                backgroundColor: Colors.grey.shade300,
                valueColor: AlwaysStoppedAnimation<Color>(AppTheme.primaryGreen),
                minHeight: 4,
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Main playback controls
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              // Shuffle button
              IconButton(
                onPressed: onShuffleChanged,
                icon: Icon(
                  Icons.shuffle,
                  color: isShuffling ? AppTheme.primaryGreen : Colors.grey.shade400,
                  size: 24,
                ),
              ),

              // Previous button
              IconButton(
                onPressed: currentIndex > 0 ? onPrevious : null,
                icon: Icon(
                  Icons.skip_previous,
                  color: currentIndex > 0 ? AppTheme.textPrimary : Colors.grey.shade300,
                  size: 32,
                ),
              ),

              // Play/Pause button
              Container(
                decoration: BoxDecoration(
                  gradient: AppTheme.primaryGradient,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: AppTheme.primaryGreen.withOpacity(0.3),
                      blurRadius: 15,
                      offset: const Offset(0, 5),
                    ),
                  ],
                ),
                child: IconButton(
                  onPressed: onPlayPause,
                  icon: Icon(
                    isPlaying ? Icons.pause : Icons.play_arrow,
                    color: Colors.white,
                    size: 40,
                  ),
                  padding: const EdgeInsets.all(16),
                ),
              ),

              // Next button
              IconButton(
                onPressed: currentIndex < totalWords - 1 ? onNext : null,
                icon: Icon(
                  Icons.skip_next,
                  color: currentIndex < totalWords - 1 ? AppTheme.textPrimary : Colors.grey.shade300,
                  size: 32,
                ),
              ),

              // Loop button
              IconButton(
                onPressed: onLoopChanged,
                icon: Icon(
                  Icons.loop,
                  color: isLooping ? AppTheme.accentGreen : Colors.grey.shade400,
                  size: 24,
                ),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // Speed control
          Row(
            children: [
              Icon(
                Icons.speed,
                color: AppTheme.textSecondary,
                size: 20,
              ),
              const SizedBox(width: 8),
              Text(
                '播放速度: ${playbackSpeed}x',
                style: const TextStyle(
                  fontSize: 14,
                  color: AppTheme.textSecondary,
                ),
              ),
              const Spacer(),
              Container(
                decoration: BoxDecoration(
                  color: AppTheme.primaryGreen.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((speed) {
                    final isSelected = speed == playbackSpeed;
                    return GestureDetector(
                      onTap: () => onSpeedChanged?.call(speed),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        margin: const EdgeInsets.all(2),
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: isSelected ? AppTheme.primaryGreen : Colors.transparent,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Text(
                          '${speed}x',
                          style: TextStyle(
                            fontSize: 12,
                            color: isSelected ? Colors.white : AppTheme.textSecondary,
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
    );
  }
}