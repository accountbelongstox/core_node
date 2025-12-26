// Unified API client using Nuxt $fetch and key-based endpoints
import { API_ENDPOINTS } from '../config/api-endpoints'

export type ApiEndpointKey = keyof typeof API_ENDPOINTS
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

export interface ApiRequestOptions {
  method?: HttpMethod
  body?: any
  params?: Record<string, any>
  headers?: Record<string, string>
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export const useApi = () => {
  // Build URL from endpoint key and replace path parameters
  const buildUrl = (key: ApiEndpointKey, pathParams?: Record<string, string | number>): string => {
    let url = API_ENDPOINTS[key]

    if (pathParams) {
      Object.entries(pathParams).forEach(([param, value]) => {
        url = url.replace(`:${param}`, String(value))
      })
    }

    return url
  }

  // Generic API call method
  const call = async <T = any>(
    endpointKey: ApiEndpointKey,
    options: ApiRequestOptions = {},
    pathParams?: Record<string, string | number>
  ): Promise<ApiResponse<T>> => {
    try {
      const url = buildUrl(endpointKey, pathParams)
      const method = options.method || 'GET'

      const response = await $fetch<T>(url, {
        method,
        body: options.body,
        params: options.params,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers
        }
      })

      return {
        success: true,
        data: response
      }
    } catch (error: any) {
      console.error(`API Error [${endpointKey}]:`, error)

      return {
        success: false,
        error: error.message || 'Unknown error',
        message: error.data?.message || error.message
      }
    }
  }

  // Convenience methods
  const get = <T = any>(
    endpointKey: ApiEndpointKey,
    params?: Record<string, any>,
    pathParams?: Record<string, string | number>
  ) => {
    return call<T>(endpointKey, { method: 'GET', params }, pathParams)
  }

  const post = <T = any>(
    endpointKey: ApiEndpointKey,
    body?: any,
    pathParams?: Record<string, string | number>
  ) => {
    return call<T>(endpointKey, { method: 'POST', body }, pathParams)
  }

  const put = <T = any>(
    endpointKey: ApiEndpointKey,
    body?: any,
    pathParams?: Record<string, string | number>
  ) => {
    return call<T>(endpointKey, { method: 'PUT', body }, pathParams)
  }

  const del = <T = any>(
    endpointKey: ApiEndpointKey,
    pathParams?: Record<string, string | number>
  ) => {
    return call<T>(endpointKey, { method: 'DELETE' }, pathParams)
  }

  return {
    call,
    get,
    post,
    put,
    del,
    buildUrl
  }
}
