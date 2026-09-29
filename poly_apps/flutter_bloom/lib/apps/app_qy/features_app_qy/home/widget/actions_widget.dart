import 'package:flutter/material.dart';

class ActionWidget extends StatelessWidget {
  final Widget actionIcon;
  final Function()? onTap;
   const ActionWidget({super.key,required this.actionIcon,this.onTap});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(8.0),
      child: InkWell(onTap: onTap,
        child: Container(decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surfaceTint,
            borderRadius: const BorderRadius.all(Radius.circular(10))),

          child: Padding(padding: const EdgeInsets.all(8.0),
            child: actionIcon),
        ),
      ),
    );
  }
}
