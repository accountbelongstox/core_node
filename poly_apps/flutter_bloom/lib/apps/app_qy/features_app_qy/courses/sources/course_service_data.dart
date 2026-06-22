library;

import '../domain/models/course_model.dart';

class CourseServiceData {
  static List<CourseModel> getCourses() {
    return [
      CourseModel(
        id: 'ielts_master',
        title: 'IELTS Master',
        subtitle: 'Full IELTS preparation',
        category: 'ielts',
        level: 'intermediate',
        duration: '12 weeks',
        lessons: 48,
        price: 0,
        rating: 4.8,
        students: 12500,
        instructor: 'QY Team',
        description: 'Comprehensive IELTS preparation course.',
        features: const ['Listening', 'Reading', 'Writing', 'Speaking'],
        topics: const ['Practice tests', 'Strategies', 'Feedback'],
        imageUrl: null,
        createdAt: null,
        updatedAt: null,
      ),
      CourseModel(
        id: 'python_master',
        title: 'Python Master',
        subtitle: 'From zero to projects',
        category: 'python',
        level: 'beginner',
        duration: '16 weeks',
        lessons: 64,
        price: 0,
        rating: 4.7,
        students: 8900,
        instructor: 'QY Team',
        description: 'Learn Python programming from scratch.',
        features: const ['Basics', 'OOP', 'Web', 'Data'],
        topics: const ['Syntax', 'Libraries', 'Projects'],
        imageUrl: null,
        createdAt: null,
        updatedAt: null,
      ),
    ];
  }

  static List<CourseModule> getIeltsModules() {
    return [
      CourseModule(
        id: 'ielts_listening',
        courseId: 'ielts_master',
        title: 'Listening',
        subtitle: 'Module 1',
        description: 'IELTS Listening practice.',
        orderIndex: 0,
        totalLessons: 12,
        completedLessons: 0,
        duration: '4 weeks',
        isLocked: false,
        createdAt: null,
        updatedAt: null,
      ),
      CourseModule(
        id: 'ielts_reading',
        courseId: 'ielts_master',
        title: 'Reading',
        subtitle: 'Module 2',
        description: 'IELTS Reading practice.',
        orderIndex: 1,
        totalLessons: 12,
        completedLessons: 0,
        duration: '4 weeks',
        isLocked: false,
        createdAt: null,
        updatedAt: null,
      ),
    ];
  }

  static List<CourseModule> getPythonModules() {
    return [
      CourseModule(
        id: 'python_basics',
        courseId: 'python_master',
        title: 'Python Basics',
        subtitle: 'Module 1',
        description: 'Variables, types, control flow.',
        orderIndex: 0,
        totalLessons: 16,
        completedLessons: 0,
        duration: '4 weeks',
        isLocked: false,
        createdAt: null,
        updatedAt: null,
      ),
    ];
  }

  static List<CourseProject> getIeltsProjects() {
    return [
      CourseProject(
        id: 'ielts_speaking_practice',
        courseId: 'ielts_master',
        title: 'Speaking Practice',
        subtitle: 'Project 1',
        description: 'Simulated speaking test.',
        difficulty: 'intermediate',
        status: 'completed',
        technologies: const [],
        githubUrl: null,
        demoUrl: null,
        orderIndex: 0,
        createdAt: null,
        updatedAt: null,
      ),
    ];
  }

  static List<CourseProject> getPythonProjects() {
    return [
      CourseProject(
        id: 'python_todo_app',
        courseId: 'python_master',
        title: 'Todo App',
        subtitle: 'CLI project',
        description: 'Build a command-line todo app.',
        difficulty: 'beginner',
        status: 'completed',
        technologies: const ['Python'],
        githubUrl: null,
        demoUrl: null,
        orderIndex: 0,
        createdAt: null,
        updatedAt: null,
      ),
      CourseProject(
        id: 'python_data_dashboard',
        courseId: 'python_master',
        title: 'Data Dashboard',
        subtitle: 'Data project',
        description: 'Visualize data with Python.',
        difficulty: 'intermediate',
        status: 'in_progress',
        technologies: const ['Python', 'Pandas'],
        githubUrl: null,
        demoUrl: null,
        orderIndex: 1,
        createdAt: null,
        updatedAt: null,
      ),
    ];
  }
}
