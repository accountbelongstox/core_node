/**
 * 请求/响应拦截器
 * 
 * 职责：
 * - 请求前处理（添加认证头、时间戳等）
 * - 响应后处理（统一数据格式、错误处理等）
 * - 请求日志记录
 */

export interface RequestInterceptor {
  (config: RequestInit, url: string): RequestInit | Promise<RequestInit>;
}

export interface ResponseInterceptor {
  (response: Response): Response | Promise<Response>;
}

// 请求拦截器列表
const requestInterceptors: RequestInterceptor[] = [];

// 响应拦截器列表
const responseInterceptors: ResponseInterceptor[] = [];

/**
 * 添加请求拦截器
 */
export function addRequestInterceptor(interceptor: RequestInterceptor): void {
  requestInterceptors.push(interceptor);
}

/**
 * 添加响应拦截器
 */
export function addResponseInterceptor(interceptor: ResponseInterceptor): void {
  responseInterceptors.push(interceptor);
}

/**
 * 执行所有请求拦截器
 */
export async function executeRequestInterceptors(
  config: RequestInit,
  url: string
): Promise<RequestInit> {
  let finalConfig = { ...config };

  for (const interceptor of requestInterceptors) {
    finalConfig = await interceptor(finalConfig, url) || finalConfig;
  }

  return finalConfig;
}

/**
 * 执行所有响应拦截器
 */
export async function executeResponseInterceptors(
  response: Response
): Promise<Response> {
  let finalResponse = response;

  for (const interceptor of responseInterceptors) {
    finalResponse = await interceptor(finalResponse) || finalResponse;
  }

  return finalResponse;
}

/**
 * 默认请求拦截器：添加通用请求头
 */
addRequestInterceptor((config, url) => {
  return {
    ...config,
    headers: {
      'Content-Type': 'application/json',
      ...config.headers,
    },
  };
});

/**
 * 默认请求拦截器：添加时间戳（用于调试）
 */
addRequestInterceptor((config, url) => {
  if (import.meta.env.DEV) {
    console.log(`[API Request] ${new Date().toISOString()} ${url}`, config);
  }
  return config;
});

/**
 * 默认响应拦截器：记录响应日志
 */
addResponseInterceptor((response) => {
  if (import.meta.env.DEV) {
    console.log(`[API Response] ${new Date().toISOString()} ${response.status} ${response.url}`);
  }
  return response;
});

