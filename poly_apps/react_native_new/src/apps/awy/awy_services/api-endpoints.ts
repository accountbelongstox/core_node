/**
 * AWY App API Endpoint Key Registry
 * 
 * All API endpoints for AWY app are registered here as keys.
 * No hardcoded URLs should exist elsewhere in the codebase.
 */

/**
 * Endpoint key definitions based on BACKEND_API_SPECIFICATION.md
 */
export const AWY_API_ENDPOINTS = {
  // Health Check
  HEALTH: 'health',

  // Authentication
  AUTH_SEND_CODE: 'auth.sendCode',
  AUTH_LOGIN: 'auth.login',
  AUTH_REGISTER: 'auth.register',
  AUTH_SOCIAL_LOGIN: 'auth.socialLogin',
  AUTH_REFRESH: 'auth.refresh',
  AUTH_LOGOUT: 'auth.logout',

  // User
  USER_ME: 'user.me',
  USER_UPDATE: 'user.update',
  USER_AVATAR: 'user.avatar',

  // Friends
  FRIENDS_LIST: 'friends.list',
  FRIENDS_DETAIL: 'friends.detail',
  FRIENDS_SEARCH: 'users.search',
  FRIENDS_SEND_REQUEST: 'friends.sendRequest',
  FRIENDS_GET_REQUESTS: 'friends.getRequests',
  FRIENDS_UPDATE_REQUEST: 'friends.updateRequest',
  FRIENDS_TOGGLE_MONITOR: 'friends.toggleMonitor',
  FRIENDS_REMOVE: 'friends.remove',

  // Location
  LOCATION_GET: 'location.get',
  LOCATION_HISTORY: 'location.history',
  LOCATION_UPLOAD: 'location.upload',

  // Health Data
  HEALTH_GET: 'health.get',
  HEALTH_HISTORY: 'health.history',

  // Device
  DEVICE_GET: 'device.get',

  // Chat
  CHAT_MESSAGES: 'chat.messages',
  CHAT_SEND: 'chat.send',
  CHAT_MARK_READ: 'chat.markRead',
  CHAT_UNREAD_COUNT: 'chat.unreadCount',

  // Products
  PRODUCTS_LIST: 'products.list',
  PRODUCTS_DETAIL: 'products.detail',

  // AI Assistant
  AI_CHAT: 'ai.chat',
  AI_CHAT_HISTORY: 'ai.chatHistory',

  // Places
  PLACES_GET: 'places.get',
} as const;

/**
 * Endpoint path mappings for AWY app
 * These paths correspond to the keys above
 */
export const AWY_ENDPOINT_PATHS: Record<string, string> = {
  // Health Check
  [AWY_API_ENDPOINTS.HEALTH]: '/api/health',

  // Authentication
  [AWY_API_ENDPOINTS.AUTH_SEND_CODE]: '/api/auth/send-code',
  [AWY_API_ENDPOINTS.AUTH_LOGIN]: '/api/auth/login',
  [AWY_API_ENDPOINTS.AUTH_REGISTER]: '/api/auth/register',
  [AWY_API_ENDPOINTS.AUTH_SOCIAL_LOGIN]: '/api/auth/social-login',
  [AWY_API_ENDPOINTS.AUTH_REFRESH]: '/api/auth/refresh',
  [AWY_API_ENDPOINTS.AUTH_LOGOUT]: '/api/auth/logout',

  // User
  [AWY_API_ENDPOINTS.USER_ME]: '/api/user/me',
  [AWY_API_ENDPOINTS.USER_UPDATE]: '/api/user/me',
  [AWY_API_ENDPOINTS.USER_AVATAR]: '/api/user/avatar',

  // Friends
  [AWY_API_ENDPOINTS.FRIENDS_LIST]: '/api/friends',
  [AWY_API_ENDPOINTS.FRIENDS_DETAIL]: '/api/friends/:friendId',
  [AWY_API_ENDPOINTS.FRIENDS_SEARCH]: '/api/users/search',
  [AWY_API_ENDPOINTS.FRIENDS_SEND_REQUEST]: '/api/friends/requests',
  [AWY_API_ENDPOINTS.FRIENDS_GET_REQUESTS]: '/api/friends/requests',
  [AWY_API_ENDPOINTS.FRIENDS_UPDATE_REQUEST]: '/api/friends/requests/:requestId',
  [AWY_API_ENDPOINTS.FRIENDS_TOGGLE_MONITOR]: '/api/friends/:friendId/monitor',
  [AWY_API_ENDPOINTS.FRIENDS_REMOVE]: '/api/friends/:friendId',

  // Location
  [AWY_API_ENDPOINTS.LOCATION_GET]: '/api/friends/:friendId/location',
  [AWY_API_ENDPOINTS.LOCATION_HISTORY]: '/api/friends/:friendId/history',
  [AWY_API_ENDPOINTS.LOCATION_UPLOAD]: '/api/location',

  // Health Data
  [AWY_API_ENDPOINTS.HEALTH_GET]: '/api/friends/:friendId/health',
  [AWY_API_ENDPOINTS.HEALTH_HISTORY]: '/api/friends/:friendId/health/history',

  // Device
  [AWY_API_ENDPOINTS.DEVICE_GET]: '/api/friends/:friendId/device',

  // Chat
  [AWY_API_ENDPOINTS.CHAT_MESSAGES]: '/api/chat/:friendId/messages',
  [AWY_API_ENDPOINTS.CHAT_SEND]: '/api/chat/:friendId/messages',
  [AWY_API_ENDPOINTS.CHAT_MARK_READ]: '/api/chat/:friendId/messages/read',
  [AWY_API_ENDPOINTS.CHAT_UNREAD_COUNT]: '/api/chat/unread-count',

  // Products
  [AWY_API_ENDPOINTS.PRODUCTS_LIST]: '/api/products',
  [AWY_API_ENDPOINTS.PRODUCTS_DETAIL]: '/api/products/:productId',

  // AI Assistant
  [AWY_API_ENDPOINTS.AI_CHAT]: '/api/ai/chat',
  [AWY_API_ENDPOINTS.AI_CHAT_HISTORY]: '/api/ai/chat/history',

  // Places
  [AWY_API_ENDPOINTS.PLACES_GET]: '/api/friends/:friendId/places',
};

