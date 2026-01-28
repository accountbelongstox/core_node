// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';
import 'custom_image_icon_label.dart';

/// Data model for icon label item
class IconLabelData {
  final String imagePath;
  final String label;
  final VoidCallback? onTap;

  const IconLabelData({
    required this.imagePath,
    required this.label,
    this.onTap,
  });
}

/// Data model for group configuration
class IconGroupConfig {
  final List<IconLabelData> items;
  final int itemsPerRow;
  final MainAxisAlignment mainAxisAlignment;
  final CrossAxisAlignment crossAxisAlignment;
  final EdgeInsets? padding;
  final EdgeInsets? margin;
  final Color? backgroundColor;
  final DecorationImage? backgroundImage;
  final Gradient? backgroundGradient;
  final BorderRadius? borderRadius;
  final Border? border;
  final List<BoxShadow>? boxShadow;
  final double? iconSize;
  final double? labelSize;
  final Color? iconColor;
  final Color? labelColor;
  final double? spacing;
  final double? runSpacing;
  final FontWeight? labelFontWeight;
  final bool enablePagination;
  final int maxRowsPerPage;
  final bool distributeEvenly;
  final int? maxLines;
  final TextOverflow? overflow;

  const IconGroupConfig({
    required this.items,
    this.itemsPerRow = 4,
    this.mainAxisAlignment = MainAxisAlignment.center,
    this.crossAxisAlignment = CrossAxisAlignment.center,
    this.padding,
    this.margin,
    this.backgroundColor,
    this.backgroundImage,
    this.backgroundGradient,
    this.borderRadius,
    this.border,
    this.boxShadow,
    this.iconSize = 32.0,
    this.labelSize = 12.0,
    this.iconColor,
    this.labelColor,
    this.spacing = 16.0,
    this.runSpacing = 16.0,
    this.labelFontWeight,
    this.enablePagination = false,
    this.maxRowsPerPage = 2,
    this.distributeEvenly = false,
    this.maxLines = 2,
    this.overflow = TextOverflow.visible,
  });
}

class CustomImageIconLabelGroup extends StatefulWidget {
  final IconGroupConfig config;

  const CustomImageIconLabelGroup({
    super.key,
    required this.config,
  });

  @override
  State<CustomImageIconLabelGroup> createState() =>
      _CustomImageIconLabelGroupState();
}

class _CustomImageIconLabelGroupState extends State<CustomImageIconLabelGroup> {
  late PageController _pageController;
  int _currentPage = 0;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final config = widget.config;

    // Create decoration based on configuration
    BoxDecoration? decoration;
    if (config.backgroundColor != null ||
        config.backgroundImage != null ||
        config.backgroundGradient != null ||
        config.borderRadius != null ||
        config.border != null ||
        config.boxShadow != null) {
      decoration = BoxDecoration(
        color: config.backgroundColor,
        image: config.backgroundImage,
        gradient: config.backgroundGradient,
        borderRadius: config.borderRadius,
        border: config.border,
        boxShadow: config.boxShadow,
      );
    }

    // Build icon widgets
    final iconWidgets = config.items.map((item) {
      return CustomImageIconLabel(
        imagePath: item.imagePath,
        label: item.label,
        onTap: item.onTap,
        imageSize: config.iconSize,
        labelSize: config.labelSize,
        imageColor: config.iconColor,
        labelColor: config.labelColor,
        labelFontWeight: config.labelFontWeight,
        showBackground: false,
        showBorder: false,
        maxLines: config.maxLines,
        overflow: config.overflow,
      );
    }).toList();

    // Calculate pagination
    final itemsPerPage = config.itemsPerRow * config.maxRowsPerPage;
    final totalPages = (iconWidgets.length / itemsPerPage).ceil();

    Widget content;

    if (config.enablePagination && totalPages > 1) {
      // Create pages for pagination
      final pages = <Widget>[];
      for (int page = 0; page < totalPages; page++) {
        final startIndex = page * itemsPerPage;
        final endIndex =
            (startIndex + itemsPerPage).clamp(0, iconWidgets.length);
        final pageItems = iconWidgets.sublist(startIndex, endIndex);

        Widget pageContent = _buildPageContent(pageItems, config);

        // Apply padding only to page content, not to indicators
        if (config.padding != null) {
          pageContent = Padding(
            padding: config.padding!,
            child: pageContent,
          );
        }

        pages.add(pageContent);
      }

      content = Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            height: 192, // Height adjusted to prevent overflow with padding
            child: PageView.builder(
              controller: _pageController,
              onPageChanged: (index) {
                setState(() {
                  _currentPage = index;
                });
              },
              itemCount: totalPages,
              itemBuilder: (context, index) {
                return Align(
                  alignment: Alignment.topCenter,
                  child: pages[index],
                );
              },
            ),
          ),
          const SizedBox(height: 0),
          _buildPageIndicators(totalPages),
        ],
      );
    } else {
      // Single page without pagination
      content = _buildPageContent(iconWidgets, config);

      // Add padding if specified
      if (config.padding != null) {
        content = Padding(
          padding: config.padding!,
          child: content,
        );
      }
    }

    // Add decoration if specified
    if (decoration != null) {
      content = Container(
        decoration: decoration,
        child: content,
      );
    }

    // Add margin if specified
    if (config.margin != null) {
      content = Container(
        margin: config.margin,
        child: content,
      );
    }

    return content;
  }

  Widget _buildPageContent(
      List<CustomImageIconLabel> items, IconGroupConfig config) {
    final rows = <Widget>[];

    for (int i = 0; i < items.length; i += config.itemsPerRow) {
      final rowItems = items.skip(i).take(config.itemsPerRow).toList();

      // Fill remaining slots with empty space if needed
      while (rowItems.length < config.itemsPerRow) {
        rowItems.add(
          CustomImageIconLabel(
            imagePath: '',
            label: '',
            imageSize: config.iconSize,
            labelSize: config.labelSize,
            labelFontWeight: config.labelFontWeight,
            showBackground: false,
            showBorder: false,
          ),
        );
      }

      rows.add(
        Row(
          mainAxisAlignment: config.distributeEvenly
              ? MainAxisAlignment.spaceEvenly
              : config.mainAxisAlignment,
          crossAxisAlignment: config.crossAxisAlignment,
          children: rowItems.map((item) {
            if (config.distributeEvenly) {
              return Expanded(
                child: Center(child: item),
              );
            }
            return item;
          }).toList(),
        ),
      );

      // Add spacing between rows
      if (i + config.itemsPerRow < items.length) {
        rows.add(SizedBox(height: config.runSpacing));
      }
    }

    return ClipRect(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: config.mainAxisAlignment,
        crossAxisAlignment: config.crossAxisAlignment,
        children: rows,
      ),
    );
  }

  Widget _buildPageIndicators(int totalPages) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(totalPages, (index) {
        final isActive = index == _currentPage;
        return Container(
          margin: const EdgeInsets.symmetric(horizontal: 4),
          width: isActive ? 16 : 8,
          height: 8,
          decoration: BoxDecoration(
            color: isActive ? Colors.blue : Colors.grey,
            borderRadius: BorderRadius.circular(4),
          ),
        );
      }),
    );
  }
}
