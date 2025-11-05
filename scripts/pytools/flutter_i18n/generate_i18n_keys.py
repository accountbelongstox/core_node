import json
import re
from pathlib import Path
from typing import Dict, List, Set
from collections import OrderedDict

class I18nKeyGenerator:
    def __init__(self, json_report_path: str, prefix: str = "qy"):
        self.report_path = Path(json_report_path)
        self.prefix = prefix
        self.key_map = OrderedDict()
        self.existing_keys = set()

    def load_report(self) -> Dict:
        with open(self.report_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def load_existing_keys(self, keys_file: str) -> None:
        if not Path(keys_file).exists():
            print(f"Warning: Existing keys file not found: {keys_file}")
            return

        with open(keys_file, 'r', encoding='utf-8') as f:
            content = f.read()
            pattern = re.compile(r"static const String (\w+) = '(\w+)';")
            matches = pattern.findall(content)
            for _, key_value in matches:
                self.existing_keys.add(key_value)

        print(f"Loaded {len(self.existing_keys)} existing keys")

    def normalize_text_to_key(self, text: str) -> str:
        text = text.strip()
        text = re.sub(r'[\s\-\.]+', '_', text)
        text = re.sub(r'[^\w\u4e00-\u9fff]', '', text)

        pinyin_map = {
            '证书': 'certificate', '中心': 'center', '设置': 'settings',
            '用户': 'user', '登录': 'login', '注册': 'register',
            '密码': 'password', '邮箱': 'email', '电话': 'phone',
            '确认': 'confirm', '取消': 'cancel', '保存': 'save',
            '删除': 'delete', '编辑': 'edit', '搜索': 'search',
            '成功': 'success', '失败': 'failed', '错误': 'error',
            '警告': 'warning', '提示': 'info', '加载': 'loading',
            '完成': 'completed', '进行中': 'in_progress', '待处理': 'pending',
            '个人': 'personal', '资料': 'profile', '信息': 'info',
            '首页': 'home', '消息': 'message', '通知': 'notification',
            '帮助': 'help', '关于': 'about', '隐私': 'privacy',
            '安全': 'security', '语言': 'language', '主题': 'theme',
            '学习': 'learning', '单词': 'word', '词汇': 'vocabulary',
            '听力': 'listening', '阅读': 'reading', '写作': 'writing',
            '口语': 'speaking', '练习': 'practice', '测试': 'test',
            '课程': 'course', '计划': 'plan', '进度': 'progress',
            '统计': 'statistics', '成就': 'achievement', '排行': 'ranking',
            '分享': 'share', '下载': 'download', '上传': 'upload',
            '收藏': 'favorite', '标签': 'tag', '类别': 'category',
            '时间': 'time', '日期': 'date', '年': 'year', '月': 'month',
            '日': 'day', '小时': 'hour', '分钟': 'minute', '秒': 'second',
            '开始': 'start', '结束': 'end', '继续': 'continue',
            '返回': 'back', '下一步': 'next', '上一步': 'previous',
            '全部': 'all', '更多': 'more', '查看': 'view',
            '已获得': 'earned', '未解锁': 'locked', '解锁': 'unlock',
            '总积分': 'total_points', '积分': 'points', '等级': 'level',
            '初级': 'beginner', '中级': 'intermediate', '高级': 'advanced',
            '专家': 'expert', '新手': 'newbie', '勤奋': 'diligent',
            '坚持': 'persistent', '全勤': 'perfect_attendance', '卓越': 'excellent',
            '颁发': 'issue', '日期': 'date', '编号': 'number',
            '描述': 'description', '详情': 'detail', '标题': 'title',
            '内容': 'content', '评论': 'comment', '点赞': 'like',
            '关注': 'follow', '粉丝': 'follower', '好友': 'friend',
        }

        words = []
        current_word = ""

        for char in text:
            if '\u4e00' <= char <= '\u9fff':
                current_word += char
            else:
                if current_word:
                    translated = pinyin_map.get(current_word, current_word)
                    words.append(translated)
                    current_word = ""
                if char.isalnum() or char == '_':
                    words.append(char)

        if current_word:
            translated = pinyin_map.get(current_word, current_word)
            words.append(translated)

        key = ''.join(words)
        key = re.sub(r'_+', '_', key)
        key = key.strip('_').lower()

        if not key or len(key) < 2:
            key = f"text_{abs(hash(text)) % 10000}"

        return key

    def generate_unique_key(self, text: str, base_key: str = None) -> str:
        if base_key is None:
            base_key = self.normalize_text_to_key(text)

        full_key = f"{self.prefix}_{base_key}"

        if full_key not in self.existing_keys and full_key not in self.key_map.values():
            return full_key

        counter = 2
        while True:
            candidate_key = f"{full_key}_{counter}"
            if candidate_key not in self.existing_keys and candidate_key not in self.key_map.values():
                return candidate_key
            counter += 1

    def categorize_strings(self, strings: List[str]) -> Dict[str, List[str]]:
        categories = {
            'ui_common': [],
            'auth': [],
            'profile': [],
            'learning': [],
            'certificate': [],
            'settings': [],
            'course': [],
            'word': [],
            'message': [],
            'misc': []
        }

        auth_keywords = ['登录', '注册', '密码', '验证', '账号', '手机', '邮箱']
        profile_keywords = ['个人', '资料', '头像', '昵称', '性别', '生日']
        learning_keywords = ['学习', '练习', '测试', '复习', '掌握']
        certificate_keywords = ['证书', '成就', '徽章', '奖励', '认证']
        settings_keywords = ['设置', '偏好', '主题', '语言', '通知']
        course_keywords = ['课程', '计划', '雅思', '托福', '教学']
        word_keywords = ['单词', '词汇', '听力', '口语', '阅读', '写作']
        message_keywords = ['消息', '通知', '提醒', '聊天', '私信']
        common_keywords = ['确认', '取消', '保存', '删除', '编辑', '搜索', '返回']

        for string in strings:
            categorized = False

            if any(kw in string for kw in common_keywords):
                categories['ui_common'].append(string)
                categorized = True
            elif any(kw in string for kw in auth_keywords):
                categories['auth'].append(string)
                categorized = True
            elif any(kw in string for kw in profile_keywords):
                categories['profile'].append(string)
                categorized = True
            elif any(kw in string for kw in certificate_keywords):
                categories['certificate'].append(string)
                categorized = True
            elif any(kw in string for kw in settings_keywords):
                categories['settings'].append(string)
                categorized = True
            elif any(kw in string for kw in course_keywords):
                categories['course'].append(string)
                categorized = True
            elif any(kw in string for kw in word_keywords):
                categories['word'].append(string)
                categorized = True
            elif any(kw in string for kw in learning_keywords):
                categories['learning'].append(string)
                categorized = True
            elif any(kw in string for kw in message_keywords):
                categories['message'].append(string)
                categorized = True

            if not categorized:
                categories['misc'].append(string)

        return {k: v for k, v in categories.items() if v}

    def generate_keys(self, output_dir: str = None) -> None:
        report = self.load_report()
        unique_strings = report.get('unique_strings', [])

        print(f"\nGenerating keys for {len(unique_strings)} unique strings...")

        categories = self.categorize_strings(unique_strings)

        for string in unique_strings:
            key = self.generate_unique_key(string)
            self.key_map[string] = key

        if output_dir:
            output_path = Path(output_dir)
            output_path.mkdir(parents=True, exist_ok=True)

            self._write_dart_keys(output_path / "generated_keys.dart", categories)
            self._write_zh_translations(output_path / "generated_zh.dart")
            self._write_en_translations(output_path / "generated_en.dart")
            self._write_mapping_json(output_path / "key_mapping.json")

        print(f"\nGenerated {len(self.key_map)} keys")
        self._print_category_stats(categories)

    def _print_category_stats(self, categories: Dict[str, List[str]]) -> None:
        print("\n--- Strings by Category ---")
        for category, strings in categories.items():
            print(f"{category:20s}: {len(strings):4d} strings")

    def _write_dart_keys(self, output_file: Path, categories: Dict[str, List[str]]) -> None:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("// Generated I18n Keys - DO NOT EDIT MANUALLY\n\n")
            f.write("class GeneratedLocalizationKeys {\n")

            for category, strings in categories.items():
                if strings:
                    f.write(f"\n  // {category.upper()}\n")
                    for string in strings:
                        key = self.key_map[string]
                        const_name = key.replace(f"{self.prefix}_", "").upper()
                        f.write(f"  static const String {const_name} = '{key}';\n")

            f.write("}\n")

        print(f"Dart keys written to: {output_file}")

    def _write_zh_translations(self, output_file: Path) -> None:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("// Generated Chinese Translations\n\n")
            f.write("final Map<String, String> generatedZhTranslations = {\n")

            for chinese_text, key in self.key_map.items():
                escaped_text = chinese_text.replace("'", "\\'").replace("\n", "\\n")
                f.write(f"  '{key}': '{escaped_text}',\n")

            f.write("};\n")

        print(f"Chinese translations written to: {output_file}")

    def _write_en_translations(self, output_file: Path) -> None:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("// Generated English Translations - REQUIRES MANUAL TRANSLATION\n\n")
            f.write("final Map<String, String> generatedEnTranslations = {\n")

            for chinese_text, key in self.key_map.items():
                f.write(f"  '{key}': 'TODO: Translate: {chinese_text}',\n")

            f.write("};\n")

        print(f"English translations template written to: {output_file}")

    def _write_mapping_json(self, output_file: Path) -> None:
        mapping = {
            'metadata': {
                'total_keys': len(self.key_map),
                'prefix': self.prefix
            },
            'mappings': [
                {
                    'key': key,
                    'chinese': text,
                    'english': f"TODO: Translate: {text}"
                }
                for text, key in self.key_map.items()
            ]
        }

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(mapping, f, ensure_ascii=False, indent=2)

        print(f"Key mapping JSON written to: {output_file}")

def main():
    import sys

    if len(sys.argv) < 2:
        print("Usage: python generate_i18n_keys.py <json_report> [output_dir] [prefix] [existing_keys_file]")
        print("Example: python generate_i18n_keys.py report.json output/ qy keys.dart")
        sys.exit(1)

    json_report = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "generated_i18n"
    prefix = sys.argv[3] if len(sys.argv) > 3 else "qy"
    existing_keys_file = sys.argv[4] if len(sys.argv) > 4 else None

    print("="*80)
    print("I18N KEY GENERATOR")
    print("="*80)
    print(f"Input Report: {json_report}")
    print(f"Output Directory: {output_dir}")
    print(f"Key Prefix: {prefix}")
    print("="*80)

    generator = I18nKeyGenerator(json_report, prefix)

    if existing_keys_file:
        generator.load_existing_keys(existing_keys_file)

    generator.generate_keys(output_dir)

    print("\n" + "="*80)
    print("KEY GENERATION COMPLETE")
    print("="*80)

if __name__ == "__main__":
    main()
