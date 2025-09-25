// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'dart:convert';
import 'dart:developer';
import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:qyflutter/common/network/error_response.dart';
import 'package:qyflutter/common/constants/app_constants.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:path/path.dart';
import 'package:qyflutter/common/provider_status/user_provider.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

// Helper function for isolate processing
Future<dynamic> _parseJsonInBackground(String responseBody) {
  return compute(_parseJson, responseBody);
}

dynamic _parseJson(String responseBody) {
  try {
    return json.decode(responseBody);
  } catch (e) {
    return null;
  }
}

class Response {
  final dynamic body;
  final String? bodyString;
  final Map<String, String>? headers;
  final int? statusCode;
  final String? statusText;
  final Uri? url;
  final String? method;

  Response({
    this.body,
    this.bodyString,
    this.headers,
    this.statusCode,
    this.statusText,
    this.url,
    this.method,
  });
}

class ApiClient {
  final BuildContext context;

  static const String noInternetMessage = 'connection_to_api_server_failed';
  int timeoutInSeconds = 30;
  late Map<String, String> _mainHeaders;
  String languageCode = "";

  ApiClient({
    required this.context,
  }) {
    refreshUpdateHeader();
  }

  bool get isAuthenticated => userProvider.isAuthenticated;
  BaseUserProvider get userProvider =>
      Provider.of<BaseUserProvider>(context, listen: false);

  refreshUpdateHeader() {
    Map<String, String> header = {
      'Content-Type': 'application/json; charset=UTF-8',
      'Accept': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'mode': 'unsafe-url',
      'credentials': 'include',
    };

    if (isAuthenticated) {
      header['Authorization'] =
          '${userProvider.tokenType ?? "Bearer"} ${userProvider.token}';
      header['mode'] = 'unsafe-url';
      header['credentials'] = 'include';
    }
    _mainHeaders = header;
  }

  Future<Response> getData(String uri,
      {Map<String, dynamic>? query, int? timeoutInSeconds}) async {
    try {
      refreshUpdateHeader();
      if (kDebugMode) {
        log('====> API Call: $uri\nHeader: $_mainHeaders');
      }
      http.Response response = await http
          .get(
            Uri.parse(uri),
            headers: _mainHeaders,
          )
          .timeout(
              Duration(seconds: timeoutInSeconds ?? this.timeoutInSeconds));
      return await handleResponse(response, uri);
    } catch (e) {
      log('getData error: $e');
      final statusText = noInternetMessage + uri;
      return Response(statusCode: 1, statusText: statusText);
    }
  }

  Future<Response> postData(String uri, dynamic body,
      {Map<String, String>? headers, int? timeoutInSeconds}) async {
    try {
      refreshUpdateHeader();
      if (kDebugMode) {
        log('====> API Call: $uri\nHeader: $_mainHeaders');
        log('====> API Body: $body');
      }

      http.Response response = await http
          .post(
            Uri.parse(uri),
            body: jsonEncode(body),
            headers: _mainHeaders,
          )
          .timeout(
              Duration(seconds: timeoutInSeconds ?? this.timeoutInSeconds));
      return await handleResponse(response, uri);
    } catch (e) {
      log('postData error: $e');
      final statusText = noInternetMessage + uri;
      return Response(statusCode: 1, statusText: statusText);
    }
  }

  Future<Response> postMultipartData(
      String uri,
      Map<String, String> body,
      List<MultipartBody> multipartBody,
      MultipartBody? logo,
      List<MultipartDocument> otherFile,
      {int? timeoutInSeconds}) async {
    try {
      refreshUpdateHeader();
      if (kDebugMode) {
        log('====> API Call: $uri\nHeader: $_mainHeaders');
        log('====> API Body: $body with ${multipartBody.length} picture');
      }
      http.MultipartRequest request =
          http.MultipartRequest('POST', Uri.parse(uri));
      request.headers.addAll(_mainHeaders);

      if (logo != null) {
        if (logo.file != null) {
          Uint8List list = await logo.file!.readAsBytes();
          request.files.add(http.MultipartFile(
            logo.key,
            logo.file!.readAsBytes().asStream(),
            list.length,
            filename: '${DateTime.now().toString()}.png',
          ));
        }
      }

      for (MultipartBody multipart in multipartBody) {
        if (multipart.file != null) {
          Uint8List list = await multipart.file!.readAsBytes();
          request.files.add(http.MultipartFile(
            multipart.key,
            multipart.file!.readAsBytes().asStream(),
            list.length,
            filename: '${DateTime.now().toString()}.png',
          ));
        }
      }

      if (otherFile.isNotEmpty) {
        for (MultipartDocument file in otherFile) {
          File aaa = File(file.file!.path!);
          Uint8List list0 = await aaa.readAsBytes();
          var part = http.MultipartFile(
              'upload_documents[]', aaa.readAsBytes().asStream(), list0.length,
              filename: basename(aaa.path));
          request.files.add(part);
        }
      }

      request.fields.addAll(body);
      http.Response response =
          await http.Response.fromStream(await request.send());
      return handleResponse(response, uri);
    } catch (e) {
      final statusText = noInternetMessage + uri;
      return Response(statusCode: 1, statusText: statusText);
    }
  }

  Future<Response> postMultipartDataConversation(
      String? uri, Map<String, String> body, List<MultipartBody>? multipartBody,
      {PlatformFile? otherFile, int? timeoutInSeconds}) async {
    refreshUpdateHeader();
    http.MultipartRequest request =
        http.MultipartRequest('POST', Uri.parse(uri!));
    request.headers.addAll(_mainHeaders);

    if (otherFile != null) {
      request.files.add(http.MultipartFile('files[${multipartBody!.length}]',
          otherFile.readStream!, otherFile.size,
          filename: basename(otherFile.name)));
    }
    if (multipartBody != null) {
      for (MultipartBody multipart in multipartBody) {
        Uint8List list = await multipart.file!.readAsBytes();
        request.files.add(http.MultipartFile(
          multipart.key,
          multipart.file!.readAsBytes().asStream(),
          list.length,
          filename: '${DateTime.now().toString()}.png',
        ));
      }
    }
    request.fields.addAll(body);
    http.Response response =
        await http.Response.fromStream(await request.send());
    return handleResponse(response, uri);
  }

  Future<Response> putData(String uri, dynamic body,
      {int? timeoutInSeconds}) async {
    try {
      refreshUpdateHeader();
      if (kDebugMode) {
        log('====> API Call: $uri\nHeader: $_mainHeaders');
        log('====> API Body: $body');
      }
      http.Response response = await http
          .put(
            Uri.parse(uri),
            body: jsonEncode(body),
            headers: _mainHeaders,
          )
          .timeout(
              Duration(seconds: timeoutInSeconds ?? this.timeoutInSeconds));
      return handleResponse(response, uri);
    } catch (e) {
      final statusText = noInternetMessage + uri;
      return Response(statusCode: 1, statusText: statusText);
    }
  }

  Future<Response> deleteData(String uri, {int? timeoutInSeconds}) async {
    try {
      refreshUpdateHeader();
      if (kDebugMode) {
        log('====> API Call: $uri\nHeader: $_mainHeaders');
      }
      http.Response response = await http
          .delete(
            Uri.parse(uri),
            headers: _mainHeaders,
          )
          .timeout(
              Duration(seconds: timeoutInSeconds ?? this.timeoutInSeconds));
      return handleResponse(response, uri);
    } catch (e) {
      final statusText = noInternetMessage + uri;
      return Response(statusCode: 1, statusText: statusText);
    }
  }

  Future<Response> handleResponse(http.Response response, String uri) async {
    dynamic body;
    try {
      body = await _parseJsonInBackground(response.body);
    } catch (e) {
      log('JSON parsing error: $e');
    }

    Response localResponse = Response(
      body: body ?? response.body,
      bodyString: response.body.toString(),
      headers: response.headers,
      statusCode: response.statusCode,
      statusText: response.reasonPhrase,
      url: response.request?.url,
      method: response.request?.method,
    );

    if (localResponse.statusCode != 200 &&
        localResponse.body != null &&
        localResponse.body is! String) {
      if (localResponse.body.toString().startsWith('{errors: [{code:')) {
        ErrorResponse errorResponse =
            ErrorResponse.fromJson(localResponse.body);
        localResponse = Response(
            statusCode: localResponse.statusCode,
            body: localResponse.body,
            statusText: errorResponse.errors![0].message);
      } else if (localResponse.body.toString().startsWith('{message')) {
        localResponse = Response(
            statusCode: localResponse.statusCode,
            body: localResponse.body,
            statusText: localResponse.body['message']);
      }
    } else if (localResponse.statusCode != 200 && localResponse.body == null) {
      final statusText = noInternetMessage + uri;
      localResponse = Response(statusCode: 0, statusText: statusText);
    }

    if (kDebugMode) {
      log('====> API Response: [${localResponse.statusCode}] $uri\n${localResponse.body}');
    }

    return localResponse;
  }
}

class MultipartBody {
  String key;
  XFile? file;
  MultipartBody(this.key, this.file);
}

class MultipartDocument {
  String key;
  PlatformFile? file;
  MultipartDocument(this.key, this.file);
}
