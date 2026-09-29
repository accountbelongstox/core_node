import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class CustomSettingCard extends StatelessWidget {
  final String title;
  final Function()? ontap;
  final Widget icon;
  const CustomSettingCard(
      {super.key, required this.title, required this.icon, this.ontap});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
          border: Border.all(
            width: 1.9,
            color: Theme.of(context).canvasColor,
          ),
          borderRadius: BorderRadius.circular(10)),
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(title, style: ThemeTextStyles.textMedium),
            InkWell(
              onTap: ontap,
              child: icon,
            )
            // const Icon(icon,size: 50,color: Colors.green,)
          ],
        ),
      ),
    );
  }
}
