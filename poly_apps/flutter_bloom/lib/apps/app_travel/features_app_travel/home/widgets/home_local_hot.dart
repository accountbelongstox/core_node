import 'package:flutter/material.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../../../models_app_travel/local_hot_model.dart';
import '../../../localization_app_travel/localization_keys_app_travel.dart';

class HomeLocalHot extends StatelessWidget {
  final List<LocalHotModel> localHot;
  final bool hideTitle;

  const HomeLocalHot({
    super.key,
    required this.localHot,
    this.hideTitle = false,
  });

  @override
  Widget build(BuildContext context) {
    if (localHot.isEmpty) {
      return const SizedBox.shrink();
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 20.0),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 12.0,
            offset: const Offset(0, 0),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!hideTitle)
            Container(
              padding: const EdgeInsets.symmetric(
                vertical: 24.0,
                horizontal: 48.0,
              ),
              child: Text(
                TravelLocalizationKeys.travelLocalHot.tr(context),
                style: const TextStyle(
                  fontSize: 36.0,
                  height: 40.0 / 36.0,
                  color: Colors.black87,
                ),
              ),
            ),
          SizedBox(
            height: 120.0,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Positioned(
                  left: 0,
                  right: 0,
                  top: -12.0,
                  child: Container(
                    height: 12.0,
                    color: Colors.white,
                  ),
                ),
                Positioned.fill(
                  child: Container(
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      border: Border(
                        bottom: BorderSide(
                          color: Color(0xFFEEEEEE),
                          width: 2.0,
                        ),
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: localHot.map((item) {
                        return Expanded(
                          child: GestureDetector(
                            onTap: () {
                              debugPrint('Local hot tapped: ${item.title}');
                            },
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.spaceAround,
                              children: [
                                Container(
                                  width: 60.0,
                                  height: 60.0,
                                  color: Colors.white,
                                  child: item.getFullImageUrl().startsWith('assets/')
                                      ? Image.asset(
                                          item.getFullImageUrl(),
                                          width: 60.0,
                                          fit: BoxFit.contain,
                                          errorBuilder: (context, error, stackTrace) {
                                            return Container(
                                              width: 60.0,
                                              height: 60.0,
                                              color: Colors.white,
                                              child: const Icon(
                                                Icons.image_not_supported,
                                                size: 30,
                                                color: Colors.grey,
                                              ),
                                            );
                                          },
                                        )
                                      : Image.network(
                                          item.getFullImageUrl(),
                                          width: 60.0,
                                          fit: BoxFit.contain,
                                          errorBuilder: (context, error, stackTrace) {
                                            return Container(
                                              width: 60.0,
                                              height: 60.0,
                                              color: Colors.white,
                                              child: const Icon(
                                                Icons.image_not_supported,
                                                size: 30,
                                                color: Colors.grey,
                                              ),
                                            );
                                          },
                                        ),
                                ),
                                Text(
                                  item.title,
                                  style: const TextStyle(
                                    fontSize: 14.0,
                                    color: Colors.black87,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ],
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
