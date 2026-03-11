library;

import '../domain/model/course_model.dart';

class CoursePlanData {
  static List<CoursePlanModel> getMockPlans(String category) {
    return [
      const CoursePlanModel(
        id: 'plan_1',
        title: 'IELTS 7-Day Intensive',
        subtitle: 'Listening & Reading',
        description: 'Intensive 7-day plan for IELTS preparation.',
        totalDays: 7,
        participants: 12000,
        category: 'ielts',
      ),
      const CoursePlanModel(
        id: 'plan_2',
        title: 'Career Upgrade Plan',
        subtitle: '12 weeks',
        description: 'From beginner to advanced in 12 weeks.',
        totalDays: 84,
        participants: 8500,
        category: 'general',
      ),
    ];
  }
}
