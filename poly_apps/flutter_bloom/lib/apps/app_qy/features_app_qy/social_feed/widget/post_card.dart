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
import 'package:qyflutter/apps/app_qy/features_app_qy/social_feed/model/post_model.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class PostCard extends StatelessWidget {
  final Post post;
  final VoidCallback? onTap;

  const PostCard({
    super.key,
    required this.post,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {


    return Card(
      margin: const EdgeInsets.all(ThemeDimensions.paddingSizeSmall),
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ListTile(
              leading: CircleAvatar(
                backgroundImage: NetworkImage(post.userAvatar),
              ),
              title: Text(post.userName, style: ThemeTextStyles.title2),
              subtitle: Text(
                post.createdAt.toString(),
                style: ThemeTextStyles.caption1.copyWith(color: Colors.grey),
              ),
            ),
            if (post.imageUrl != null)
              Image.network(
                post.imageUrl!,
                fit: BoxFit.cover,
                width: double.infinity,
                height: 200,
              ),
            Padding(
              padding: const EdgeInsets.all(ThemeDimensions.paddingSizeSmall),
              child: Text(post.content, style: ThemeTextStyles.body),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: ThemeDimensions.paddingSizeSmall,
                vertical: ThemeDimensions.paddingSizeExtraSmall,
              ),
              child: Row(
                children: [
                  Icon(Icons.favorite_border,
                      color: Theme.of(context).primaryColor),
                  const SizedBox(width: ThemeDimensions.paddingSizeExtraSmall),
                  Text('${post.likes}', style: ThemeTextStyles.caption1),
                  const SizedBox(width: ThemeDimensions.paddingSizeDefault),
                  Icon(Icons.comment_outlined,
                      color: Theme.of(context).primaryColor),
                  const SizedBox(width: ThemeDimensions.paddingSizeExtraSmall),
                  Text('${post.comments}', style: ThemeTextStyles.caption1),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
