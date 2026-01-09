/**
 * Generate nickname starting with "小" (xiao)
 * Examples: 小雨 (Little Rain), 小云 (Little Cloud), 小月 (Little Moon), etc.
 * Note: This generator creates Chinese-style nicknames, data is intentionally in Chinese
 */
const NICKNAME_SUFFIXES = [
  '雨', '云', '月', '星', '阳', '风', '晴', '露', '霜', '雪',
  '花', '草', '叶', '树', '山', '海', '河', '湖', '溪', '泉',
  '光', '影', '音', '声', '色', '香', '味', '韵', '律', '调',
  '心', '情', '意', '念', '思', '想', '梦', '愿', '望', '盼',
  '晨', '午', '晚', '夜', '春', '夏', '秋', '冬', '梅', '兰',
];

/**
 * Generate random nickname starting with "小"
 */
export const generateNickname = (): string => {
  const suffix = NICKNAME_SUFFIXES[Math.floor(Math.random() * NICKNAME_SUFFIXES.length)];
  return `小${suffix}`;
};

