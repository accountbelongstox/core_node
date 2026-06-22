import 'codemart_api_base.dart';
import '../config_app_codemart/api_config_app_codemart.dart';
import '../models_app_codemart/codemart_types.dart';

class UserApiServiceAppCodemart extends CodeMartApiBase {
  UserApiServiceAppCodemart({super.baseUrl, super.namespace});

  Future<ApiResponse<UserProfile>> getUserProfile() async {
    return await get<UserProfile>(
      endpoint: '${ApiConfigAppCodemart.userEndpoint}${ApiEndpointsAppCodemart.userProfile}',
      fromJson: (data) => UserProfile.fromJson(data as Map<String, dynamic>),
    );
  }

  Future<ApiResponse<UserProfile>> updateUserProfile({
    String? name,
    String? nickname,
    String? avatar,
    String? about,
    String? website,
    String? github,
    String? wechat,
  }) async {
    return await put<UserProfile>(
      endpoint: '${ApiConfigAppCodemart.userEndpoint}${ApiEndpointsAppCodemart.updateProfile}',
      body: {
        if (name != null) 'name': name,
        if (nickname != null) 'nickname': nickname,
        if (avatar != null) 'avatar': avatar,
        if (about != null) 'about': about,
        if (website != null) 'website': website,
        if (github != null) 'github': github,
        if (wechat != null) 'wechat': wechat,
      },
      fromJson: (data) => UserProfile.fromJson(data as Map<String, dynamic>),
    );
  }

  Future<ApiResponse<DeveloperProfile>> getDeveloperProfile() async {
    return await get<DeveloperProfile>(
      endpoint: '${ApiConfigAppCodemart.userEndpoint}${ApiEndpointsAppCodemart.developerProfile}',
      fromJson: (data) => DeveloperProfile.fromJson(data as Map<String, dynamic>),
    );
  }

  Future<ApiResponse<DeveloperProfile>> updateDeveloperProfile({
    String? companyName,
    String? bio,
    List<String>? skills,
  }) async {
    return await put<DeveloperProfile>(
      endpoint: '${ApiConfigAppCodemart.userEndpoint}${ApiEndpointsAppCodemart.developerProfile}',
      body: {
        if (companyName != null) 'companyName': companyName,
        if (bio != null) 'bio': bio,
        if (skills != null) 'skills': skills,
      },
      fromJson: (data) => DeveloperProfile.fromJson(data as Map<String, dynamic>),
    );
  }

  Future<ApiResponse<ClientProfile>> getClientProfile() async {
    return await get<ClientProfile>(
      endpoint: '${ApiConfigAppCodemart.userEndpoint}${ApiEndpointsAppCodemart.clientProfile}',
      fromJson: (data) => ClientProfile.fromJson(data as Map<String, dynamic>),
    );
  }

  Future<ApiResponse<ClientProfile>> updateClientProfile({
    String? companyName,
    String? companyRegistrationNumber,
    String? industry,
    String? companyDescription,
    String? contactPerson,
    String? contactPhone,
    String? companyWebsite,
  }) async {
    return await put<ClientProfile>(
      endpoint: '${ApiConfigAppCodemart.userEndpoint}${ApiEndpointsAppCodemart.clientProfile}',
      body: {
        if (companyName != null) 'companyName': companyName,
        if (companyRegistrationNumber != null) 'companyRegistrationNumber': companyRegistrationNumber,
        if (industry != null) 'industry': industry,
        if (companyDescription != null) 'companyDescription': companyDescription,
        if (contactPerson != null) 'contactPerson': contactPerson,
        if (contactPhone != null) 'contactPhone': contactPhone,
        if (companyWebsite != null) 'companyWebsite': companyWebsite,
      },
      fromJson: (data) => ClientProfile.fromJson(data as Map<String, dynamic>),
    );
  }
}
