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
