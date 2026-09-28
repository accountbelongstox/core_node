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
