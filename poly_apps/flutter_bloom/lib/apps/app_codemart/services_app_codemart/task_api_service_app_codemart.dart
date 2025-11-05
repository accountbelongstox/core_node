import 'codemart_api_base.dart';
import '../config_app_codemart/api_config_app_codemart.dart';
import '../models_app_codemart/codemart_types.dart';

class TaskApiServiceAppCodemart extends CodeMartApiBase {
  TaskApiServiceAppCodemart({super.baseUrl, super.namespace});

  Future<ApiResponse<PaginatedResponse<Task>>> getTasks({
    int? page,
    int? pageSize,
    String? status,
    String? priority,
    String? search,
  }) async {
    final queryParams = buildQuery(
      filters: {
        if (status != null) 'status': status,
        if (priority != null) 'priority': priority,
        if (search != null) 'search': search,
      },
      page: page,
      pageSize: pageSize,
    );

    return await get<PaginatedResponse<Task>>(
      endpoint: '${ApiConfigAppCodemart.taskEndpoint}${ApiEndpointsAppCodemart.tasks}',
      queryParams: queryParams,
      fromJson: (data) => PaginatedResponse<Task>.fromJson(
        data as Map<String, dynamic>,
        (json) => Task.fromJson(json),
      ),
    );
  }

  Future<ApiResponse<PaginatedResponse<Task>>> getTaskHall({
    int? page,
    int? pageSize,
    List<String>? skills,
    String? priority,
  }) async {
    final queryParams = buildQuery(
      filters: {
        if (skills != null && skills.isNotEmpty) 'skills': skills.join(','),
        if (priority != null) 'priority': priority,
      },
      page: page,
      pageSize: pageSize,
    );

    return await get<PaginatedResponse<Task>>(
      endpoint: '${ApiConfigAppCodemart.taskEndpoint}${ApiEndpointsAppCodemart.taskHall}',
      queryParams: queryParams,
      fromJson: (data) => PaginatedResponse<Task>.fromJson(
        data as Map<String, dynamic>,
        (json) => Task.fromJson(json),
      ),
    );
  }

  Future<ApiResponse<Task>> getTaskDetails(int taskId) async {
    final endpoint = ApiEndpointsAppCodemart.replacePathParams(
      ApiEndpointsAppCodemart.taskDetails,
      {'id': taskId},
    );

    return await get<Task>(
      endpoint: '${ApiConfigAppCodemart.taskEndpoint}$endpoint',
      fromJson: (data) => Task.fromJson(data as Map<String, dynamic>),
    );
  }

  Future<ApiResponse<Task>> acceptTask(int taskId) async {
    final endpoint = ApiEndpointsAppCodemart.replacePathParams(
      ApiEndpointsAppCodemart.acceptTask,
      {'id': taskId},
    );

    return await post<Task>(
      endpoint: '${ApiConfigAppCodemart.taskEndpoint}$endpoint',
      fromJson: (data) => Task.fromJson(data as Map<String, dynamic>),
    );
  }

  Future<ApiResponse<Task>> createTask(Map<String, dynamic> taskData) async {
    return await post<Task>(
      endpoint: '${ApiConfigAppCodemart.taskEndpoint}${ApiEndpointsAppCodemart.tasks}',
      body: taskData,
      fromJson: (data) => Task.fromJson(data as Map<String, dynamic>),
    );
  }

  Future<ApiResponse<Task>> submitTask({
    required int taskId,
    required String repositoryUrl,
    required String description,
  }) async {
    final endpoint = ApiEndpointsAppCodemart.replacePathParams(
      ApiEndpointsAppCodemart.submitTask,
      {'id': taskId},
    );

    return await post<Task>(
      endpoint: '${ApiConfigAppCodemart.taskEndpoint}$endpoint',
      body: {
        'repositoryUrl': repositoryUrl,
        'description': description,
      },
      fromJson: (data) => Task.fromJson(data as Map<String, dynamic>),
    );
  }
}
