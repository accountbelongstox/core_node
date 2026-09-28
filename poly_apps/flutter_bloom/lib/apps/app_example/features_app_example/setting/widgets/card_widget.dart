import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class CardWidget extends StatelessWidget {
  final String title;
  final Widget? widget;
  final Icon? icon;
  const CardWidget({super.key, required this.title, this.widget, this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 50,
      width: double.infinity,
      decoration: BoxDecoration(
          border: Border.all(
            width: 1.9,
            color: Theme.of(context).canvasColor,
          ),
          borderRadius: BorderRadius.circular(10)),
      child: Padding(
        padding: const EdgeInsets.all(8.0),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(title, style: ThemeTextStyles.textSemiBold.copyWith(fontSize: 18)),
            InkWell(
                //  onTap: onTab,
                child: widget)
          ],
        ),
      ),
    );
  }
}
