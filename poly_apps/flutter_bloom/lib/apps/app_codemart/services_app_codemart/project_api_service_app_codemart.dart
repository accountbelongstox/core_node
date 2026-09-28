import 'codemart_api_base.dart';
import '../config_app_codemart/api_config_app_codemart.dart';
import '../models_app_codemart/codemart_types.dart';

class ProjectApiServiceAppCodemart extends CodeMartApiBase {
  ProjectApiServiceAppCodemart({super.baseUrl, super.namespace});

  Future<ApiResponse<PaginatedResponse<Project>>> getProjects({
    int? page,
    int? pageSize,
    String? status,
    String? search,
  }) async {
    final queryParams = buildQuery(
      filters: {
        if (status != null) 'status': status,
        if (search != null) 'search': search,
      },
      page: page,
      pageSize: pageSize,
    );

    return await get<PaginatedResponse<Project>>(
      endpoint: '${ApiConfigAppCodemart.projectEndpoint}${ApiEndpointsAppCodemart.projects}',
      queryParams: queryParams,
      fromJson: (data) => PaginatedResponse<Project>.fromJson(
        data as Map<String, dynamic>,
        (json) => Project.fromJson(json),
      ),
    );
  }

  Future<ApiResponse<Project>> getProjectDetails(int projectId) async {
    final endpoint = ApiEndpointsAppCodemart.replacePathParams(
      ApiEndpointsAppCodemart.projectDetails,
      {'id': projectId},
    );

    return await get<Project>(
      endpoint: '${ApiConfigAppCodemart.projectEndpoint}$endpoint',
      fromJson: (data) => Project.fromJson(data as Map<String, dynamic>),
    );
  }

  Future<ApiResponse<Project>> createProject({
    required String title,
    required String description,
    required String complexity,
    required double budget,
    required String budgetType,
    required String startDate,
    required String endDate,
    required List<String> skills,
    List<String>? languages,
    List<String>? frameworks,
    List<String>? databases,
    List<String>? referenceUrls,
  }) async {
    return await post<Project>(
      endpoint: '${ApiConfigAppCodemart.projectEndpoint}${ApiEndpointsAppCodemart.createProject}',
      body: {
        'title': title,
        'description': description,
        'complexity': complexity,
        'budget': budget,
        'budgetType': budgetType,
        'startDate': startDate,
        'endDate': endDate,
        'skills': skills,
        if (languages != null) 'languages': languages,
        if (frameworks != null) 'frameworks': frameworks,
        if (databases != null) 'databases': databases,
        if (referenceUrls != null) 'referenceUrls': referenceUrls,
      },
      fromJson: (data) => Project.fromJson(data as Map<String, dynamic>),
    );
  }

  Future<ApiResponse<Project>> updateProject({
    required int projectId,
    String? title,
    String? description,
    String? status,
    double? budget,
  }) async {
    final endpoint = ApiEndpointsAppCodemart.replacePathParams(
      ApiEndpointsAppCodemart.updateProject,
      {'id': projectId},
    );

    return await put<Project>(
      endpoint: '${ApiConfigAppCodemart.projectEndpoint}$endpoint',
      body: {
        if (title != null) 'title': title,
        if (description != null) 'description': description,
        if (status != null) 'status': status,
        if (budget != null) 'budget': budget,
      },
      fromJson: (data) => Project.fromJson(data as Map<String, dynamic>),
    );
  }

  Future<ApiResponse<void>> deleteProject(int projectId) async {
    final endpoint = ApiEndpointsAppCodemart.replacePathParams(
      ApiEndpointsAppCodemart.deleteProject,
      {'id': projectId},
    );

    return await delete<void>(
      endpoint: '${ApiConfigAppCodemart.projectEndpoint}$endpoint',
    );
  }

  Future<ApiResponse<ProjectProposal>> getProjectProposal(int projectId) async {
    final endpoint = ApiEndpointsAppCodemart.replacePathParams(
      ApiEndpointsAppCodemart.projectProposal,
      {'id': projectId},
    );

    return await get<ProjectProposal>(
      endpoint: '${ApiConfigAppCodemart.projectEndpoint}$endpoint',
      fromJson: (data) => ProjectProposal.fromJson(data as Map<String, dynamic>),
    );
  }

  Future<ApiResponse<Project>> acceptProposal(int projectId) async {
    final endpoint = ApiEndpointsAppCodemart.replacePathParams(
      ApiEndpointsAppCodemart.acceptProposal,
      {'id': projectId},
    );

    return await post<Project>(
      endpoint: '${ApiConfigAppCodemart.projectEndpoint}$endpoint',
      fromJson: (data) => Project.fromJson(data as Map<String, dynamic>),
    );
  }
}
