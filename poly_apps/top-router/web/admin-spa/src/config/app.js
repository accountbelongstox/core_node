// 应用配置
export const APP_CONFIG = {
  // 应用基础路径
  basePath: import.meta.env.VITE_APP_BASE_URL || (import.meta.env.DEV ? '/admin/' : '/admin-next/'),

  // 应用标题
  title: import.meta.env.VITE_APP_TITLE || 'Claude Relay Service - 管理后台',

  // 是否为开发环境
  isDev: import.meta.env.DEV,

  // API 前缀
  apiPrefix: import.meta.env.DEV ? '/webapi' : ''
}

const normalizeBasePath = () =>
  APP_CONFIG.basePath.endsWith('/') ? APP_CONFIG.basePath.slice(0, -1) : APP_CONFIG.basePath

// 获取完整的应用URL
export function getAppUrl(path = '') {
  const basePath = normalizeBasePath()
  if (!path) {
    return `${basePath}/`
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${basePath}${normalizedPath}`
}

// 获取登录页面URL
export function getLoginUrl(audience = 'admin') {
  return getAppUrl(audience === 'user' ? '/auth/user-login' : '/login')
}
