/**
 * API Endpoint Paths
 * Maps endpoint keys to actual API paths
 */

export const QY_ENDPOINT_PATHS = {
  // User
  'user.profile': '/api/user/profile',
  'user.update': '/api/user/update',
  
  // Word Groups
  'wordGroups.list': '/api/word-groups',
  'wordGroups.create': '/api/word-groups',
  'wordGroups.update': '/api/word-groups/:id',
  'wordGroups.delete': '/api/word-groups/:id',
  'wordGroups.detail': '/api/word-groups/:id',
  
  // Words
  'words.list': '/api/words',
  'words.detail': '/api/words/:id',
  
  // Memory
  'memory.records': '/api/memory/records',
  'memory.update': '/api/memory/records/:wordId',
  'memory.statistics': '/api/memory/statistics',
  
  // Dictionary
  'dictionary.lookup': '/api/dictionary/lookup',
  
  // Statistics
  'statistics.get': '/api/statistics',
} as const;

