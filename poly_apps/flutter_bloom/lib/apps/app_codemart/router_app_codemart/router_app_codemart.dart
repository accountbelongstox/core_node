import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../models_app_codemart/user_model_app_codemart.dart';
import '../views_app_codemart/home_view_app_codemart.dart';
import '../views_app_codemart/login_view_app_codemart.dart';
import '../views_app_codemart/register_view_app_codemart.dart';
import '../views_app_codemart/registration_flow/registration_flow_view_app_codemart.dart';
import '../views_app_codemart/tasks/task_hall_view_app_codemart.dart';
import '../views_app_codemart/tasks/task_details_view_app_codemart.dart';
import '../views_app_codemart/tasks/my_tasks_view_app_codemart.dart';
import '../views_app_codemart/projects/projects_view_app_codemart.dart';
import '../views_app_codemart/projects/project_details_view_app_codemart.dart';
import '../views_app_codemart/projects/create_project_view_app_codemart.dart';
import '../views_app_codemart/profile/profile_view_app_codemart.dart';
import '../views_app_codemart/wallet/wallet_view_app_codemart.dart';
import '../views_app_codemart/projects/edit_project_view_app_codemart.dart';
import '../views_app_codemart/tasks/submit_task_view_app_codemart.dart';
import '../views_app_codemart/projects/proposal_view_app_codemart.dart';
import '../views_app_codemart/notifications/notifications_view_app_codemart.dart';
import '../views_app_codemart/settings/settings_view_app_codemart.dart';
import '../views_app_codemart/settings/notification_settings_view_app_codemart.dart';
import '../views_app_codemart/settings/language_settings_view_app_codemart.dart';
import '../views_app_codemart/settings/privacy_settings_view_app_codemart.dart';
import '../views_app_codemart/search/search_view_app_codemart.dart';
import '../views_app_codemart/reviews/review_view_app_codemart.dart';
import '../views_app_codemart/architect/architect_dashboard_view_app_codemart.dart';
import '../views_app_codemart/help/help_view_app_codemart.dart';
import '../views_app_codemart/help/about_view_app_codemart.dart';

class RouterAppCodemart {
  // Route names
  static const String routeCodemartHome = 'codemart_home';
  static const String routeCodemartLogin = 'codemart_login';
  static const String routeCodemartRegister = 'codemart_register';
  static const String routeCodemartRegistrationFlow = 'codemart_registration_flow';
  static const String routeCodemartTaskHall = 'codemart_task_hall';
  static const String routeCodemartTaskDetails = 'codemart_task_details';
  static const String routeCodemartMyTasks = 'codemart_my_tasks';
  static const String routeCodemartProjects = 'codemart_projects';
  static const String routeCodemartProjectDetails = 'codemart_project_details';
  static const String routeCodemartCreateProject = 'codemart_create_project';
  static const String routeCodemartEditProject = 'codemart_edit_project';
  static const String routeCodemartSubmitTask = 'codemart_submit_task';
  static const String routeCodemartProposal = 'codemart_proposal';
  static const String routeCodemartProfile = 'codemart_profile';
  static const String routeCodemartWallet = 'codemart_wallet';
  static const String routeCodemartNotifications = 'codemart_notifications';
  static const String routeCodemartSettings = 'codemart_settings';
  static const String routeCodemartNotificationSettings = 'codemart_notification_settings';
  static const String routeCodemartLanguageSettings = 'codemart_language_settings';
  static const String routeCodemartPrivacySettings = 'codemart_privacy_settings';
  static const String routeCodemartSearch = 'codemart_search';
  static const String routeCodemartReview = 'codemart_review';
  static const String routeCodemartArchitectDashboard = 'codemart_architect_dashboard';
  static const String routeCodemartHelp = 'codemart_help';
  static const String routeCodemartAbout = 'codemart_about';

  // Route paths
  static const String pathHome = '/';
  static const String pathLogin = '/login';
  static const String pathRegister = '/register';
  static const String pathRegistrationFlow = '/registration-flow';
  static const String pathTaskHall = '/tasks';
  static const String pathTaskDetails = '/tasks/:id';
  static const String pathMyTasks = '/my-tasks';
  static const String pathSubmitTask = '/tasks/:id/submit';
  static const String pathProjects = '/projects';
  static const String pathProjectDetails = '/projects/:id';
  static const String pathCreateProject = '/create-project';
  static const String pathEditProject = '/projects/:id/edit';
  static const String pathProposal = '/projects/:id/proposal';
  static const String pathProfile = '/profile';
  static const String pathWallet = '/wallet';
  static const String pathNotifications = '/notifications';
  static const String pathSettings = '/settings';
  static const String pathNotificationSettings = '/settings/notifications';
  static const String pathLanguageSettings = '/settings/language';
  static const String pathPrivacySettings = '/settings/privacy';
  static const String pathSearch = '/search';
  static const String pathReview = '/review/:targetId';
  static const String pathArchitectDashboard = '/architect/dashboard';
  static const String pathHelp = '/help';
  static const String pathAbout = '/about';

  static GoRouter createRouter() {
    return GoRouter(
      initialLocation: pathHome,
      redirect: (BuildContext context, GoRouterState state) {
        final userModel = Provider.of<UserModelAppCodemart>(
          context,
          listen: false,
        );

        final isLoggedIn = userModel.isLoggedIn;
        final isLoginRoute = state.matchedLocation == pathLogin;
        final isRegisterRoute = state.matchedLocation == pathRegister;
        final isPublicRoute = isLoginRoute || isRegisterRoute;

        // Redirect to login if not logged in and trying to access protected route
        if (!isLoggedIn && !isPublicRoute) {
          return pathLogin;
        }

        // Redirect to home if logged in and trying to access login/register
        if (isLoggedIn && isPublicRoute) {
          return pathHome;
        }

        return null; // No redirect needed
      },
      routes: [
        GoRoute(
          path: pathHome,
          name: routeCodemartHome,
          builder: (context, state) => const HomeViewAppCodemart(),
        ),
        GoRoute(
          path: pathLogin,
          name: routeCodemartLogin,
          builder: (context, state) => const LoginViewAppCodemart(),
        ),
        GoRoute(
          path: pathRegister,
          name: routeCodemartRegister,
          builder: (context, state) => const RegisterViewAppCodemart(),
        ),
        GoRoute(
          path: pathRegistrationFlow,
          name: routeCodemartRegistrationFlow,
          builder: (context, state) {
            final roleType = state.uri.queryParameters['role'] ?? 'developer';
            return RegistrationFlowViewAppCodemart(roleType: roleType);
          },
        ),
        GoRoute(
          path: pathTaskHall,
          name: routeCodemartTaskHall,
          builder: (context, state) => const TaskHallViewAppCodemart(),
        ),
        GoRoute(
          path: pathTaskDetails,
          name: routeCodemartTaskDetails,
          builder: (context, state) {
            final taskId = int.parse(state.pathParameters['id']!);
            return TaskDetailsViewAppCodemart(taskId: taskId);
          },
        ),
        GoRoute(
          path: pathMyTasks,
          name: routeCodemartMyTasks,
          builder: (context, state) => const MyTasksViewAppCodemart(),
        ),
        GoRoute(
          path: pathProjects,
          name: routeCodemartProjects,
          builder: (context, state) => const ProjectsViewAppCodemart(),
        ),
        GoRoute(
          path: pathProjectDetails,
          name: routeCodemartProjectDetails,
          builder: (context, state) {
            final projectId = int.parse(state.pathParameters['id']!);
            return ProjectDetailsViewAppCodemart(projectId: projectId);
          },
        ),
        GoRoute(
          path: pathCreateProject,
          name: routeCodemartCreateProject,
          builder: (context, state) => const CreateProjectViewAppCodemart(),
        ),
        GoRoute(
          path: pathProfile,
          name: routeCodemartProfile,
          builder: (context, state) => const ProfileViewAppCodemart(),
        ),
        GoRoute(
          path: pathWallet,
          name: routeCodemartWallet,
          builder: (context, state) => const WalletViewAppCodemart(),
        ),
        GoRoute(
          path: pathEditProject,
          name: routeCodemartEditProject,
          builder: (context, state) {
            final projectId = int.parse(state.pathParameters['id']!);
            return EditProjectViewAppCodemart(projectId: projectId);
          },
        ),
        GoRoute(
          path: pathSubmitTask,
          name: routeCodemartSubmitTask,
          builder: (context, state) {
            final taskId = int.parse(state.pathParameters['id']!);
            return SubmitTaskViewAppCodemart(taskId: taskId);
          },
        ),
        GoRoute(
          path: pathProposal,
          name: routeCodemartProposal,
          builder: (context, state) {
            final projectId = int.parse(state.pathParameters['id']!);
            return ProposalViewAppCodemart(projectId: projectId);
          },
        ),
        GoRoute(
          path: pathNotifications,
          name: routeCodemartNotifications,
          builder: (context, state) => const NotificationsViewAppCodemart(),
        ),
        GoRoute(
          path: pathSettings,
          name: routeCodemartSettings,
          builder: (context, state) => const SettingsViewAppCodemart(),
        ),
        GoRoute(
          path: pathNotificationSettings,
          name: routeCodemartNotificationSettings,
          builder: (context, state) => const NotificationSettingsViewAppCodemart(),
        ),
        GoRoute(
          path: pathLanguageSettings,
          name: routeCodemartLanguageSettings,
          builder: (context, state) => const LanguageSettingsViewAppCodemart(),
        ),
        GoRoute(
          path: pathPrivacySettings,
          name: routeCodemartPrivacySettings,
          builder: (context, state) => const PrivacySettingsViewAppCodemart(),
        ),
        GoRoute(
          path: pathSearch,
          name: routeCodemartSearch,
          builder: (context, state) {
            final query = state.uri.queryParameters['q'];
            return SearchViewAppCodemart(initialQuery: query);
          },
        ),
        GoRoute(
          path: pathReview,
          name: routeCodemartReview,
          builder: (context, state) {
            final targetId = int.parse(state.pathParameters['targetId']!);
            final targetType = state.uri.queryParameters['type'] ?? 'project';
            return ReviewViewAppCodemart(
              targetId: targetId,
              targetType: targetType,
            );
          },
        ),
        GoRoute(
          path: pathArchitectDashboard,
          name: routeCodemartArchitectDashboard,
          builder: (context, state) => const ArchitectDashboardViewAppCodemart(),
        ),
        GoRoute(
          path: pathHelp,
          name: routeCodemartHelp,
          builder: (context, state) => const HelpViewAppCodemart(),
        ),
        GoRoute(
          path: pathAbout,
          name: routeCodemartAbout,
          builder: (context, state) => const AboutViewAppCodemart(),
        ),
      ],
      errorBuilder: (context, state) => Scaffold(
        appBar: AppBar(
          title: const Text('Page Not Found'),
        ),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.error_outline,
                size: 64,
                color: Colors.red,
              ),
              const SizedBox(height: 16),
              Text(
                'Page not found: ${state.matchedLocation}',
                style: const TextStyle(fontSize: 18),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () => context.go(pathHome),
                child: const Text('Go to Home'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // Navigation helpers
  static void goToHome(BuildContext context) {
    context.go(pathHome);
  }

  static void goToLogin(BuildContext context) {
    context.go(pathLogin);
  }

  static void goToRegister(BuildContext context) {
    context.go(pathRegister);
  }

  static void goToRegistrationFlow(BuildContext context, {required String role}) {
    context.go('$pathRegistrationFlow?role=$role');
  }

  static void goToTaskHall(BuildContext context) {
    context.go(pathTaskHall);
  }

  static void goToTaskDetails(BuildContext context, int taskId) {
    context.go(pathTaskDetails.replaceAll(':id', taskId.toString()));
  }

  static void goToMyTasks(BuildContext context) {
    context.go(pathMyTasks);
  }

  static void goToProjects(BuildContext context) {
    context.go(pathProjects);
  }

  static void goToProjectDetails(BuildContext context, int projectId) {
    context.go(pathProjectDetails.replaceAll(':id', projectId.toString()));
  }

  static void goToCreateProject(BuildContext context) {
    context.go(pathCreateProject);
  }

  static void goToProfile(BuildContext context) {
    context.go(pathProfile);
  }

  static void goToWallet(BuildContext context) {
    context.go(pathWallet);
  }

  static void goToEditProject(BuildContext context, int projectId) {
    context.go(pathEditProject.replaceAll(':id', projectId.toString()));
  }

  static void goToSubmitTask(BuildContext context, int taskId) {
    context.go(pathSubmitTask.replaceAll(':id', taskId.toString()));
  }

  static void goToProposal(BuildContext context, int projectId) {
    context.go(pathProposal.replaceAll(':id', projectId.toString()));
  }

  static void goToNotifications(BuildContext context) {
    context.go(pathNotifications);
  }

  static void goToSettings(BuildContext context) {
    context.go(pathSettings);
  }

  static void goToNotificationSettings(BuildContext context) {
    context.go(pathNotificationSettings);
  }

  static void goToLanguageSettings(BuildContext context) {
    context.go(pathLanguageSettings);
  }

  static void goToPrivacySettings(BuildContext context) {
    context.go(pathPrivacySettings);
  }

  static void goToSearch(BuildContext context, {String? query}) {
    final path = query != null ? '$pathSearch?q=$query' : pathSearch;
    context.go(path);
  }

  static void goToReview(BuildContext context, int targetId, String targetType) {
    context.go('${pathReview.replaceAll(':targetId', targetId.toString())}?type=$targetType');
  }

  static void goToArchitectDashboard(BuildContext context) {
    context.go(pathArchitectDashboard);
  }

  static void goToHelp(BuildContext context) {
    context.go(pathHelp);
  }

  static void goToAbout(BuildContext context) {
    context.go(pathAbout);
  }
}
