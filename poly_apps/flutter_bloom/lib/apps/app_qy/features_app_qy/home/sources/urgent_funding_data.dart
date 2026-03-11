library;

import '../domain/model/urgetnt_fundrasing_model.dart';

class UrgentFundingData {
  static List<UrgentFundingModel> getMockUrgentFundings() {
    return [
      UrgentFundingModel(
        title: 'Urgent Medical',
        image: null,
        found: '¥80,000',
        donators: '2.1k',
        days: '7',
      ),
      UrgentFundingModel(
        title: 'Disaster Relief',
        image: null,
        found: '¥120,000',
        donators: '3.5k',
        days: '14',
      ),
    ];
  }
}
