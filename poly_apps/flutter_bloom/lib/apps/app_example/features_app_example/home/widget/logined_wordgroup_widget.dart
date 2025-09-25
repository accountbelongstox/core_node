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

import 'dart:developer';
import 'package:flutter/material.dart';
import 'package:qyflutter/common/network/api_group.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';

class LoginedWordGroupWidget extends StatefulWidget {
  const LoginedWordGroupWidget({super.key});

  @override
  State<LoginedWordGroupWidget> createState() => _LoginedWordGroupWidgetState();
}

class _LoginedWordGroupWidgetState extends State<LoginedWordGroupWidget> {
  bool _isLoading = false;
  String? _error;
  List<WordGroup> _wordGroups = [];
  late final GroupApi _groupApi;

  @override
  void initState() {
    super.initState();
    _groupApi = GroupApi(context);
    _fetchWordGroups();
  }

  Future<void> _fetchWordGroups() async {
    if (!mounted) return;

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final groups = await _groupApi.fetchWordGroups();
      if (mounted) {
        setState(() {
          _wordGroups = groups;
          _isLoading = false;
        });
      }
    } catch (e) {
      log('Error fetching word groups: $e');
      if (mounted) {
        setState(() {
          _error = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  Widget _buildGroupCard(WordGroup group) {
    final theme = Theme.of(context);
            final cardColor = ThemeColors.getStringColor(group.gname);
    final onCardColor = theme.colorScheme.onPrimary;

    return Card(
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16.0),
      ),
      child: Container(
        decoration: BoxDecoration(
          color: cardColor,
          borderRadius: BorderRadius.circular(16.0),
        ),
        child: InkWell(
          onTap: () {
            // TODO: Navigate to group details
          },
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  group.gname,
                  style: ThemeTextStyles.contentSubtitle.copyWith(
                    color: onCardColor,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 8),
                Text(
                  'Total Words: ${group.totalWords}',
                  style: ThemeTextStyles.contentDetail.copyWith(
                    color: onCardColor.withAlpha(230),
                  ),
                ),
                if (group.gwords.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Text(
                    'Recent Words:',
                    style: ThemeTextStyles.contentDetail.copyWith(
                      color: onCardColor.withAlpha(230),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Flexible(
                    child: Container(
                      constraints: const BoxConstraints(maxHeight: 60),
                      child: ListView.builder(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: group.gwords.length.clamp(0, 3),
                        itemBuilder: (context, i) => Padding(
                          padding: const EdgeInsets.only(bottom: 2),
                          child: Text(
                            group.gwords[i],
                            style: ThemeTextStyles.contentDetail.copyWith(
                              color: onCardColor.withAlpha(204),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (_isLoading) {
      return Center(
        child: CircularProgressIndicator(
          color: theme.colorScheme.primary,
        ),
      );
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              _error!,
              style: ThemeTextStyles.contentBody.copyWith(
                color: theme.colorScheme.error,
              ),
            ),
            TextButton(
              onPressed: _fetchWordGroups,
              child: Text(
                'Retry',
                style: ThemeTextStyles.primaryButton.copyWith(
                  color: theme.colorScheme.primary,
                ),
              ),
            ),
          ],
        ),
      );
    }

    if (_wordGroups.isEmpty) {
      return Center(
        child: Text(
          'No word groups found',
          style: ThemeTextStyles.contentBody.copyWith(
            color: theme.colorScheme.onSurface,
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.all(16.0),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Word Groups',
                style: ThemeTextStyles.contentTitle.copyWith(
                  color: theme.colorScheme.onSurface,
                ),
              ),
              IconButton(
                icon: Icon(
                  Icons.refresh,
                  color: theme.colorScheme.primary,
                ),
                onPressed: _fetchWordGroups,
              ),
            ],
          ),
        ),
        Expanded(
          child: GridView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 16.0),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              childAspectRatio: 1.0,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
            ),
            itemCount: _wordGroups.length,
            itemBuilder: (context, index) =>
                _buildGroupCard(_wordGroups[index]),
          ),
        ),
      ],
    );
  }
}
