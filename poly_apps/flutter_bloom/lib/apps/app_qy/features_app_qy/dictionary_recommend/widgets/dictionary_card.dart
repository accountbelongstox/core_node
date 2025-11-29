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

class _DictionaryCardState extends State<DictionaryCard> with SingleTickerProviderStateMixin {
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
    switch (widget.dictionary.difficulty.toLowerCase()) {
      case 'beginner':
        return Colors.green;
      case 'intermediate':
        return Colors.orange;
      case 'advanced':
        return Colors.red;
      default:
        return Colors.blue;
    }
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
          shadowColor: Colors.black.withOpacity(0.2),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // Image Section with Overlay
              _buildImageSection(),

              // Content Section
              Padding(
                padding: const EdgeInsets.all(12.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Title
                    Text(
                      widget.dictionary.title,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        height: 1.3,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 8),

                    // Stats Row
                    _buildStatsRow(),
                    const SizedBox(height: 12),

                    // Tags
                    if (widget.dictionary.tags.isNotEmpty) _buildTags(),

                    const SizedBox(height: 8),

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
          borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
          child: AspectRatio(
            aspectRatio: 1.5,
            child: Image.network(
              widget.dictionary.imageUrl,
              fit: BoxFit.cover,
              errorBuilder: (context, error, stackTrace) {
                return Container(
                  color: Colors.grey[300],
                  child: const Icon(Icons.image, size: 48, color: Colors.grey),
                );
              },
              loadingBuilder: (context, child, loadingProgress) {
                if (loadingProgress == null) return child;
                return Container(
                  color: Colors.grey[200],
                  child: Center(
                    child: CircularProgressIndicator(
                      value: loadingProgress.expectedTotalBytes != null
                          ? loadingProgress.cumulativeBytesLoaded / loadingProgress.expectedTotalBytes!
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
              borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.black.withOpacity(0.6),
                  Colors.transparent,
                ],
              ),
            ),
          ),
        ),

        // Difficulty Badge
        Positioned(
          top: 8,
          left: 8,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: _getDifficultyColor(),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              widget.dictionary.difficulty.toUpperCase(),
              style: const TextStyle(
                color: Colors.white,
                fontSize: 10,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.5,
              ),
            ),
          ),
        ),

        // Like Button
        Positioned(
          top: 8,
          right: 8,
          child: Material(
            color: Colors.white,
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: widget.onLike,
              child: Padding(
                padding: const EdgeInsets.all(8.0),
                child: Icon(
                  Icons.favorite_border,
                  size: 20,
                  color: Colors.red[400],
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
    return Row(
      children: [
        // Add/Remove Button
        Expanded(
          child: ElevatedButton.icon(
            onPressed: widget.onToggleAdd,
            style: ElevatedButton.styleFrom(
              backgroundColor: widget.dictionary.isAdded ? Colors.grey[300] : Colors.blue[600],
              foregroundColor: widget.dictionary.isAdded ? Colors.black87 : Colors.white,
              elevation: 0,
              padding: const EdgeInsets.symmetric(vertical: 8),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            icon: Icon(
              widget.dictionary.isAdded ? Icons.check_circle : Icons.add_circle_outline,
              size: 18,
            ),
            label: Text(
              widget.dictionary.isAdded ? 'Added' : 'Add',
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),

        // Details Button
        Expanded(
          child: OutlinedButton.icon(
            onPressed: widget.onTap,
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.blue[700],
              side: BorderSide(color: Colors.blue[300]!, width: 1.5),
              padding: const EdgeInsets.symmetric(vertical: 8),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            icon: const Icon(Icons.info_outline, size: 18),
            label: const Text(
              'Details',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
      ],
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
