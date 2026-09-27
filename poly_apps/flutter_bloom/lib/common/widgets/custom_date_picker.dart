import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class CustomDatePicker extends StatefulWidget {
  final String title;
  final String text;
  final String image;
  final bool requiredField;
  final Function()? selectDate;
  const CustomDatePicker(
      {super.key,
      required this.title,
      required this.text,
      required this.image,
      this.requiredField = false,
      this.selectDate});

  @override
  State<CustomDatePicker> createState() => _CustomDatePickerState();
}

class _CustomDatePickerState extends State<CustomDatePicker> {
  @override
  Widget build(BuildContext context) {
    ThemeDimensions.refresh(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(
              horizontal: ThemeDimensions.paddingSizeSmall),
          child: RichText(
            text: TextSpan(
              text: widget.title,
              style: ThemeTextStyles.textMedium.copyWith(
                  color: Theme.of(context).textTheme.displayLarge!.color!),
              children: <TextSpan>[
                widget.requiredField
                    ? TextSpan(
                        text: '  *',
                        style: ThemeTextStyles.textBold.copyWith(color: Colors.red))
                    : const TextSpan(),
              ],
            ),
          ),
        ),
        const SizedBox(height: ThemeDimensions.paddingSizeExtraSmall),
        Container(
          height: 50,
          padding: const EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
          decoration: BoxDecoration(
            border: Border.all(color: Theme.of(context).hintColor, width: 0.2),
            borderRadius:
                BorderRadius.circular(ThemeDimensions.paddingSizeOverLarge),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                widget.text,
                style:
                    ThemeTextStyles.textRegular.copyWith(fontSize: ThemeDimensions.fontSizeDefault),
              ),
              InkWell(
                  onTap: widget.selectDate,
                  child: SizedBox(
                      width: 20, height: 20, child: Image.asset(widget.image))),
            ],
          ),
        ),
      ],
    );
  }
}
