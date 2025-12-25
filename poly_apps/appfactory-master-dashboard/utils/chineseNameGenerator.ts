/**
 * Chinese Name Generator
 * Generates realistic Chinese names from a comprehensive name pool
 */

// Common Chinese surnames (100 most common)
const SURNAMES = [
  '王', '李', '张', '刘', '陈', '杨', '黄', '赵', '吴', '周',
  '徐', '孙', '马', '朱', '胡', '郭', '何', '高', '林', '罗',
  '郑', '梁', '谢', '宋', '唐', '许', '韩', '冯', '邓', '曹',
  '彭', '曾', '肖', '田', '董', '袁', '潘', '于', '蒋', '蔡',
  '余', '杜', '叶', '程', '苏', '魏', '吕', '丁', '任', '沈',
  '姚', '卢', '姜', '崔', '钟', '谭', '陆', '汪', '范', '金',
  '石', '廖', '贾', '夏', '韦', '付', '方', '白', '邹', '孟',
  '熊', '秦', '邱', '江', '尹', '薛', '闫', '段', '雷', '侯',
  '龙', '史', '陶', '黎', '贺', '顾', '毛', '郝', '龚', '邵',
];

// Common Chinese given names (male)
const MALE_GIVEN_NAMES = [
  '伟', '强', '磊', '军', '洋', '勇', '勇', '艳', '杰', '涛',
  '明', '超', '秀', '英', '华', '文', '辉', '丽', '强', '静',
  '敏', '静', '丽', '强', '磊', '军', '洋', '勇', '艳', '杰',
  '涛', '明', '超', '秀', '英', '华', '文', '辉', '丽', '强',
  '鹏', '飞', '龙', '虎', '峰', '山', '海', '波', '涛', '江',
  '浩', '宇', '天', '星', '晨', '阳', '光', '亮', '辉', '明',
  '志', '远', '宏', '大', '伟', '强', '勇', '刚', '毅', '坚',
  '诚', '信', '仁', '义', '礼', '智', '信', '忠', '孝', '廉',
];

// Common Chinese given names (female)
const FEMALE_GIVEN_NAMES = [
  '芳', '娜', '敏', '静', '丽', '艳', '红', '玲', '雪', '梅',
  '兰', '菊', '竹', '莲', '荷', '桂', '桃', '杏', '梨', '樱',
  '娟', '秀', '英', '华', '慧', '巧', '美', '娜', '敏', '静',
  '丽', '艳', '红', '玲', '雪', '梅', '兰', '菊', '竹', '莲',
  '雨', '露', '霜', '雪', '冰', '清', '洁', '纯', '雅', '文',
  '诗', '书', '画', '琴', '棋', '花', '月', '星', '云', '霞',
  '美', '丽', '秀', '雅', '静', '怡', '悦', '欢', '乐', '欣',
];

// Two-character given names (common combinations)
const TWO_CHAR_GIVEN_NAMES = [
  '志强', '志明', '志华', '志远', '志伟', '志勇', '志刚', '志坚', '志诚', '志信',
  '文强', '文华', '文辉', '文博', '文静', '文雅', '文秀', '文丽', '文美', '文慧',
  '明强', '明华', '明辉', '明博', '明静', '明雅', '明秀', '明丽', '明美', '明慧',
  '秀英', '秀华', '秀梅', '秀兰', '秀芳', '秀娟', '秀敏', '秀静', '秀雅', '秀美',
  '丽华', '丽娟', '丽敏', '丽静', '丽雅', '丽美', '丽慧', '丽芳', '丽红', '丽雪',
  '建华', '建国', '建军', '建强', '建明', '建辉', '建博', '建文', '建武', '建勇',
  '海涛', '海波', '海峰', '海山', '海龙', '海燕', '海霞', '海英', '海华', '海明',
  '春华', '春花', '春梅', '春兰', '春芳', '春燕', '春霞', '春英', '春红', '春雪',
];

let nameIndex = 0;

/**
 * Generate a Chinese name
 * Uses an internal queue to cycle through names
 */
export const generateChineseName = (gender?: 'male' | 'female'): string => {
  const surname = SURNAMES[nameIndex % SURNAMES.length];
  const surnameIndex = Math.floor(nameIndex / SURNAMES.length);
  
  let givenName: string;
  if (gender === 'male') {
    const names = MALE_GIVEN_NAMES;
    givenName = names[surnameIndex % names.length];
  } else if (gender === 'female') {
    const names = FEMALE_GIVEN_NAMES;
    givenName = names[surnameIndex % names.length];
  } else {
    // Random gender
    const isMale = Math.random() > 0.5;
    const names = isMale ? MALE_GIVEN_NAMES : FEMALE_GIVEN_NAMES;
    givenName = names[surnameIndex % names.length];
  }
  
  // Sometimes use two-character given name (30% chance)
  if (Math.random() < 0.3 && TWO_CHAR_GIVEN_NAMES.length > 0) {
    const twoCharIndex = Math.floor(surnameIndex / (MALE_GIVEN_NAMES.length + FEMALE_GIVEN_NAMES.length));
    givenName = TWO_CHAR_GIVEN_NAMES[twoCharIndex % TWO_CHAR_GIVEN_NAMES.length];
  }
  
  nameIndex++;
  return `${surname}${givenName}`;
};

/**
 * Reset name generator index (for testing)
 */
export const resetNameGenerator = () => {
  nameIndex = 0;
};

