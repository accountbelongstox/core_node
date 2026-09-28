class ApiConfigAppCodemart {
  static const String baseUrl = 'https://api.codemart.com';
  static const String apiVersion = 'v1';
  static const String namespace = 'codemart';

  static const String authEndpoint = '/api/codemart/auth';
  static const String userEndpoint = '/api/codemart/user';
  static const String projectEndpoint = '/api/codemart/project';
  static const String taskEndpoint = '/api/codemart/task';
  static const String paymentEndpoint = '/api/codemart/payment';

  static const int connectTimeout = 30000;
  static const int receiveTimeout = 30000;

  static Map<String, String> getHeaders({String? token}) {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-App-Namespace': namespace,
    };

    if (token != null) {
      headers['Authorization'] = 'Bearer $token';
    }

    return headers;
  }
}

class ApiEndpointsAppCodemart {
  static const String login = '/login';
  static const String register = '/register';
  static const String logout = '/logout';
  static const String refreshToken = '/refresh-token';

  static const String userProfile = '/profile';
  static const String updateProfile = '/profile/update';
  static const String developerProfile = '/developer/profile';
  static const String clientProfile = '/client/profile';

  static const String sendEmailVerification = '/verification/email/send';
  static const String verifyEmail = '/verification/email/verify';
  static const String sendPhoneVerification = '/verification/phone/send';
  static const String verifyPhone = '/verification/phone/verify';
  static const String submitKyc = '/verification/kyc/submit';
  static const String checkKycStatus = '/verification/kyc/status';

  static const String projects = '/projects';
  static const String createProject = '/projects/create';
  static const String projectDetails = '/projects/:id';
  static const String updateProject = '/projects/:id/update';
  static const String deleteProject = '/projects/:id/delete';
  static const String projectSubmit = '/projects/submit';
  static const String projectProposal = '/projects/:id/proposal';
  static const String acceptProposal = '/projects/:id/proposal/accept';

  static const String tasks = '/tasks';
  static const String taskDetails = '/tasks/:id';
  static const String acceptTask = '/tasks/:id/accept';
  static const String submitTask = '/tasks/:id/submit';
  static const String taskHall = '/tasks/hall';

  static const String payments = '/payments';
  static const String createPayment = '/payments/create';
  static const String paymentStatus = '/payments/:id/status';
  static const String wallet = '/wallet';
  static const String walletTransactions = '/wallet/transactions';

  static String replacePathParams(String path, Map<String, dynamic> params) {
    String result = path;
    params.forEach((key, value) {
      result = result.replaceAll(':$key', value.toString());
    });
    return result;
  }
}
