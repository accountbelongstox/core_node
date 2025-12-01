import 'package:flutter/material.dart';
import '../domain/model/dictionary_model.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../resources_app_qy/colors_app_qy.dart';

/// Beautiful Dictionary Card Widget
/// Displays dictionary information in an attractive card format
class DictionaryCard extends StatefulWidget {
  final DictionaryModel dictionary;
  final VoidCallback? onTap;
  final VoidCallback? onLike;
  final VoidCallback? onToggleAdd;

  const DictionaryCard({
    Key? key,
    required this.dictionary,
    this.onTap,
    this.onLike,
    this.onToggleAdd,
  }) : super(key: key);

  @override
  State<DictionaryCard> createState() => _DictionaryCardState();
}

class _DictionaryCardState extends State<DictionaryCard>
    with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _scaleAnimation;
  bool _isPressed = false;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      duration: const Duration(milliseconds: 150),
      vsync: this,
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.95).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  Color _getDifficultyColor() {
    // Use localized difficulty keys for comparison
    final difficulty = widget.dictionary.difficulty.toLowerCase();
    if (difficulty == QyAppLocalizationKeys.qyDictionaryDifficultyBeginner.toLowerCase() ||
        difficulty == 'beginner') {
      return ColorsAppQy.qySuccess;
    } else if (difficulty == QyAppLocalizationKeys.qyDictionaryDifficultyIntermediate.toLowerCase() ||
               difficulty == 'intermediate') {
      return ColorsAppQy.qyWarning;
    } else if (difficulty == QyAppLocalizationKeys.qyDictionaryDifficultyAdvanced.toLowerCase() ||
               difficulty == 'advanced') {
      return ColorsAppQy.qyError;
    }
    return ColorsAppQy.qyPrimary;
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) {
        setState(() => _isPressed = true);
        _animationController.forward();
      },
      onTapUp: (_) {
        setState(() => _isPressed = false);
        _animationController.reverse();
      },
      onTapCancel: () {
        setState(() => _isPressed = false);
        _animationController.reverse();
      },
      onTap: widget.onTap,
      child: ScaleTransition(
        scale: _scaleAnimation,
        child: Card(
          elevation: _isPressed ? 2 : 8,
          shadowColor: ColorsAppQy.qyShadowMedium,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
          ),
          color: ColorsAppQy.qyCardBackground,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // Image Section with Overlay
              _buildImageSection(),

              // Content Section
              Padding(
                padding: const EdgeInsets.all(ThemeDimensions.spacing12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Title
                    Text(
                      widget.dictionary.title,
                      style: ThemeTextStyles.body1.copyWith(
                        color: ColorsAppQy.qyTextPrimary,
                        fontWeight: FontWeight.bold,
                        height: 1.3,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: ThemeDimensions.spacing8),

                    // Stats Row
                    _buildStatsRow(),
                    const SizedBox(height: ThemeDimensions.spacing12),

                    // Tags
                    if (widget.dictionary.tags.isNotEmpty) _buildTags(),

                    const SizedBox(height: ThemeDimensions.spacing8),

                    // Action Buttons
                    _buildActionButtons(),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildImageSection() {
    return Stack(
      children: [
        // Main Image
        ClipRRect(
          borderRadius: const BorderRadius.vertical(
            top: Radius.circular(ThemeDimensions.radiusLarge),
          ),
          child: AspectRatio(
            aspectRatio: 1.5,
            child: Image.network(
              widget.dictionary.imageUrl,
              fit: BoxFit.cover,
              errorBuilder: (context, error, stackTrace) {
                return Container(
                  color: ColorsAppQy.qyCardBackground,
                  child: Icon(
                    Icons.image,
                    size: 48,
                    color: ColorsAppQy.qyTextSecondary,
                  ),
                );
              },
              loadingBuilder: (context, child, loadingProgress) {
                if (loadingProgress == null) return child;
                return Container(
                  color: ColorsAppQy.qyCardBackground,
                  child: Center(
                    child: CircularProgressIndicator(
                      value: loadingProgress.expectedTotalBytes != null
                          ? loadingProgress.cumulativeBytesLoaded /
                              loadingProgress.expectedTotalBytes!
                          : null,
                    ),
                  ),
                );
              },
            ),
          ),
        ),

        // Gradient Overlay
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: Container(
            height: 80,
            decoration: BoxDecoration(
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(ThemeDimensions.radiusLarge),
              ),
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  ColorsAppQy.qyShadowDark.withOpacity(0.6),
                  ColorsAppQy.qyPageBackground.withOpacity(0),
                ],
              ),
            ),
          ),
        ),

        // Difficulty Badge
        Positioned(
          top: ThemeDimensions.spacing8,
          left: ThemeDimensions.spacing8,
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: ThemeDimensions.spacing10,
              vertical: ThemeDimensions.spacing4,
            ),
            decoration: BoxDecoration(
              color: _getDifficultyColor(),
              borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
            ),
            child: Text(
              widget.dictionary.difficulty.tr(context).toUpperCase(),
              style: ThemeTextStyles.caption.copyWith(
                color: ColorsAppQy.qyTextOnPrimary,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.5,
              ),
            ),
          ),
        ),

        // Like Button
        Positioned(
          top: ThemeDimensions.spacing8,
          right: ThemeDimensions.spacing8,
          child: Material(
            color: ColorsAppQy.qyCardBackground,
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: widget.onLike,
              child: Padding(
                padding: const EdgeInsets.all(ThemeDimensions.spacing8),
                child: Icon(
                  Icons.favorite_border,
                  size: ThemeDimensions.iconSizeMedium,
                  color: ColorsAppQy.qyError,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildStatsRow() {
    return Row(
      children: [
        // Word Count
        Icon(
          Icons.book_outlined,
          size: 16,
          color: ColorsAppQy.qyPrimary,
        ),
        const SizedBox(width: ThemeDimensions.spacing4),
        Text(
          '${widget.dictionary.wordCount} ${QyAppLocalizationKeys.qyWords.tr(context)}',
          style: ThemeTextStyles.caption.copyWith(
            color: ColorsAppQy.qyTextSecondary,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(width: ThemeDimensions.spacing16),

        // Like Count
        Icon(
          Icons.favorite,
          size: 16,
          color: ColorsAppQy.qyError,
        ),
        const SizedBox(width: ThemeDimensions.spacing4),
        Text(
          _formatCount(widget.dictionary.likeCount),
          style: ThemeTextStyles.caption.copyWith(
            color: ColorsAppQy.qyTextSecondary,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  Widget _buildTags() {
    return Wrap(
      spacing: ThemeDimensions.spacing6,
      runSpacing: ThemeDimensions.spacing6,
      children: widget.dictionary.tags.take(2).map((tag) {
        return Container(
          padding: const EdgeInsets.symmetric(
            horizontal: ThemeDimensions.spacing8,
            vertical: ThemeDimensions.spacing4,
          ),
          decoration: BoxDecoration(
            color: ColorsAppQy.qyPrimaryLight.withOpacity(0.2),
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
            border: Border.all(
              color: ColorsAppQy.qyPrimary.withOpacity(0.3),
              width: 1,
            ),
          ),
          child: Text(
            '#${tag.tr(context)}',
            style: ThemeTextStyles.caption.copyWith(
              color: ColorsAppQy.qyPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildActionButtons() {
    return Builder(
      builder: (context) {
        return Row(
          children: [
            // Add/Remove Button
            Expanded(
              child: ElevatedButton.icon(
                onPressed: widget.onToggleAdd,
                style: ElevatedButton.styleFrom(
                  backgroundColor: widget.dictionary.isAdded
                      ? ColorsAppQy.qyTextSecondary.withOpacity(0.3)
                      : ColorsAppQy.qyPrimary,
                  foregroundColor: widget.dictionary.isAdded
                      ? ColorsAppQy.qyTextPrimary
                      : ColorsAppQy.qyTextOnPrimary,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(
                    vertical: ThemeDimensions.spacing8,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(
                      ThemeDimensions.radiusMedium,
                    ),
                  ),
                ),
                icon: Icon(
                  widget.dictionary.isAdded
                      ? Icons.check_circle
                      : Icons.add_circle_outline,
                  size: 18,
                ),
                label: Text(
                  widget.dictionary.isAdded
                      ? QyAppLocalizationKeys.qyDictionaryAdded.tr(context)
                      : QyAppLocalizationKeys.qyDictionaryAddToLibrary
                          .tr(context),
                  style: ThemeTextStyles.button.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
            const SizedBox(width: ThemeDimensions.spacing8),

            // Details Button
            Expanded(
              child: OutlinedButton.icon(
                onPressed: widget.onTap,
                style: OutlinedButton.styleFrom(
                  foregroundColor: ColorsAppQy.qyPrimary,
                  side: BorderSide(
                    color: ColorsAppQy.qyPrimary.withOpacity(0.5),
                    width: 1.5,
                  ),
                  padding: const EdgeInsets.symmetric(
                    vertical: ThemeDimensions.spacing8,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(
                      ThemeDimensions.radiusMedium,
                    ),
                  ),
                ),
                icon: const Icon(Icons.info_outline, size: 18),
                label: Text(
                  QyAppLocalizationKeys.qyDictionaryDetails.tr(context),
                  style: ThemeTextStyles.button.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  String _formatCount(int count) {
    if (count >= 1000000) {
      return '${(count / 1000000).toStringAsFixed(1)}M';
    } else if (count >= 1000) {
      return '${(count / 1000).toStringAsFixed(1)}K';
    }
    return count.toString();
  }
}
