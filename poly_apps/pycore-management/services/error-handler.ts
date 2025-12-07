/**
 * 统一错误处理模块
 * 
 * 职责：
 * - 处理 API 请求错误
 * - 提供用户友好的错误消息
 * - 记录错误日志
 * - 支持错误重试策略
 */

export enum ApiErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  HTTP_ERROR = 'HTTP_ERROR',
  PARSE_ERROR = 'PARSE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface ApiError {
  type: ApiErrorType;
  message: string;
  statusCode?: number;
  originalError?: Error;
  endpoint?: string;
}

/**
 * 创建 API 错误对象
 */
export function createApiError(
  type: ApiErrorType,
  message: string,
  options?: {
    statusCode?: number;
    originalError?: Error;
    endpoint?: string;
  }
): ApiError {
  return {
    type,
    message,
    statusCode: options?.statusCode,
    originalError: options?.originalError,
    endpoint: options?.endpoint,
  };
}

/**
 * 处理 HTTP 响应错误
 */
export function handleHttpError(response: Response, endpoint: string): ApiError {
  const statusCode = response.status;
  let message = `HTTP Error ${statusCode}`;

  // 根据状态码提供更具体的错误消息
  switch (statusCode) {
    case 400:
      message = '请求参数错误';
      break;
    case 401:
      message = '未授权，请重新登录';
      break;
    case 403:
      message = '没有权限访问此资源';
      break;
    case 404:
      message = '请求的资源不存在';
      break;
    case 500:
      message = '服务器内部错误';
      break;
    case 502:
      message = '网关错误';
      break;
    case 503:
      message = '服务暂时不可用';
      break;
    case 504:
      message = '网关超时';
      break;
    default:
      message = `HTTP 错误 ${statusCode}`;
  }

  return createApiError(ApiErrorType.HTTP_ERROR, message, {
    statusCode,
    endpoint,
  });
}

/**
 * 处理网络错误
 */
export function handleNetworkError(error: Error, endpoint: string): ApiError {
  const message = error.message.includes('fetch')
    ? '网络连接失败，请检查网络设置'
    : error.message;

  return createApiError(ApiErrorType.NETWORK_ERROR, message, {
    originalError: error,
    endpoint,
  });
}

/**
 * 处理超时错误
 */
export function handleTimeoutError(endpoint: string): ApiError {
  return createApiError(
    ApiErrorType.TIMEOUT_ERROR,
    '请求超时，请稍后重试',
    { endpoint }
  );
}

/**
 * 处理 JSON 解析错误
 */
export function handleParseError(error: Error, endpoint: string): ApiError {
  return createApiError(
    ApiErrorType.PARSE_ERROR,
    '响应数据格式错误',
    {
      originalError: error,
      endpoint,
    }
  );
}

/**
 * 处理未知错误
 */
export function handleUnknownError(error: unknown, endpoint: string): ApiError {
  const message = error instanceof Error ? error.message : '未知错误';
  
  return createApiError(
    ApiErrorType.UNKNOWN_ERROR,
    message,
    {
      originalError: error instanceof Error ? error : undefined,
      endpoint,
    }
  );
}

/**
 * 获取用户友好的错误消息
 */
export function getUserFriendlyMessage(error: ApiError): string {
  return error.message;
}

/**
 * 判断错误是否可重试
 */
export function isRetryableError(error: ApiError): boolean {
  // 网络错误和超时错误可以重试
  if (error.type === ApiErrorType.NETWORK_ERROR || error.type === ApiErrorType.TIMEOUT_ERROR) {
    return true;
  }

  // 5xx 服务器错误可以重试
  if (error.type === ApiErrorType.HTTP_ERROR && error.statusCode) {
    return error.statusCode >= 500 && error.statusCode < 600;
  }

  return false;
}

/**
 * 记录错误日志
 */
export function logError(error: ApiError): void {
  console.error('[API Error]', {
    type: error.type,
    message: error.message,
    statusCode: error.statusCode,
    endpoint: error.endpoint,
    originalError: error.originalError,
  });
}

