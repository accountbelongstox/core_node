/**
 * 生成加密字符串工具函数
 * 使用简单的Base64编码 + 时间戳生成唯一字符串
 */
export function generateEncryptedString(appId: string, timestamp?: number): string {
  const time = timestamp || Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const combined = `${appId}-${time}-${random}`;
  
  // 使用Base64编码
  const encoded = btoa(combined)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return encoded.substring(0, 32); // 限制长度为32字符
}

/**
 * 从加密字符串解析APP ID（如果需要）
 */
export function parseEncryptedString(encrypted: string): string | null {
  try {
    // 尝试解码
    const decoded = atob(encrypted.replace(/-/g, '+').replace(/_/g, '/'));
    const parts = decoded.split('-');
    return parts[0] || null;
  } catch {
    return null;
  }
}

