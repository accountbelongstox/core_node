// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';
import '../../../widgets_app_bank/bank_loading_dialog.dart';
import '../models/service_data.dart';

class LifeServiceItem extends StatelessWidget {
  final ServiceData service;

  const LifeServiceItem({
    super.key,
    required this.service,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        BankLoadingDialog.show(context, title: service.label);
      },
      child: Column(
        children: [
          SizedBox(
            width: 50,
            height: 50,
            child: service.imagePath != null
                ? Image.asset(
                    service.imagePath!,
                    width: 50,
                    height: 50,
                    fit: BoxFit.fill,
                  )
                : Center(
                    child: Text(
                      service.icon,
                      style: const TextStyle(fontSize: 24),
                    ),
                  ),
          ),
          const SizedBox(height: 8),
          Text(
            service.label,
            style: const TextStyle(
              fontSize: 12,
              color: Colors.black87,
            ),
          ),
        ],
      ),
    );
  }
}
