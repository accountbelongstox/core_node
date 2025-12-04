// API Types based on real Laravel backend responses
// Real data validated: 2025-12-04 with http://192.168.50.3:9000/api_info

export interface SystemInfoResponse {
  core_information: {
    php_version: string
    laravel_version: string
    environment: string
    debug_mode: string
    timezone: string
  }
  php_configuration: {
    memory_limit: string
    max_execution_time: string
    upload_max_filesize: string
    post_max_size: string
    display_errors: string
    command_execution_enabled: boolean
  }
  database_information: {
    status: string
    connection_driver: string
    database_name: string
    database_version: string
  }
  system_resources: {
    cpu_usage: string
    memory_usage: string
    disk_usage: string
    load_average: string
  }
  system_information: {
    os: string
    architecture: string
    server_software: string
    server_ip: string
  }
}

export interface ApiEndpointInfo {
  path: string
  method?: string
  feature?: string
  description?: string
  auth_required?: boolean
  parameters?: string[]
}

export interface ApplicationInfo {
  app_name: string
  api_version: string
  app_description?: string
  base_url: string
  api_prefix: string
  endpoints: ApiEndpointInfo[]
  supported_headers: Record<string, string>
  authentication?: {
    type: string
    methods?: string[]
    token_expiry?: number
  }
}

export interface ApiInfoResponse {
  public_info: {
    CommonApiInfo: {
      section_name: string
      description: string
      base_url: string
      endpoints: ApiEndpointInfo[]
      supported_headers: Record<string, string>
      authentication: {
        type: string
        description: string
      }
    }
    SystemInfoService: SystemInfoResponse
    api_reference: Record<string, ApplicationInfo | string>
  }
}
