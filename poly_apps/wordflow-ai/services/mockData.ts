
import { Word, WordGroup, User, SupportedLanguage, LeaderboardUser, Achievement, QuizQuestion, RetentionStat, Friend, ActivityLog, Announcement } from '../types';

export const MOCK_USER: User = {
  id: 'u1',
  name: 'Demo User',
  avatar: 'https://ui-avatars.com/api/?name=Demo+User&background=3B82F6&color=fff',
  email: 'user@wordflow.ai',
  dailyGoal: 20,
  dailyProgress: 12,
  streak: 5,
  totalLearned: 450,
  isPro: true,
  selectedLanguage: 'en',
  learningLanguages: ['en', 'jp'], // Default learning English and Japanese
};

export const MOCK_ANNOUNCEMENTS: Announcement[] = [
  { id: 'a1', title: 'New Feature', message: 'Try the new Passive Listening mode!', type: 'info', date: '2025-11-01' },
  { id: 'a2', title: 'Challenge', message: 'Complete 7-day streak for a Pro badge.', type: 'promo', date: '2025-10-28' },
  { id: 'a3', title: 'System', message: 'Offline sync completed successfully.', type: 'alert', date: '2025-11-02' },
];

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', name: 'English', native_name: 'English', voice_id: 'en-US-JennyNeural', has_tts: true, flag: '🇺🇸' },
  { code: 'zh', name: 'Chinese', native_name: '中文', voice_id: 'zh-CN-XiaoxiaoNeural', has_tts: true, flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', native_name: '日本語', voice_id: 'ja-JP-NanamiNeural', has_tts: true, flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', native_name: '한국어', voice_id: 'ko-KR-SunHiNeural', has_tts: true, flag: '🇰🇷' },
  { code: 'es', name: 'Spanish', native_name: 'Español', voice_id: 'es-ES-ElviraNeural', has_tts: true, flag: '🇪🇸' },
  { code: 'fr', name: 'French', native_name: 'Français', voice_id: 'fr-FR-DeniseNeural', has_tts: true, flag: '🇫🇷' },
  { code: 'de', name: 'German', native_name: 'Deutsch', voice_id: 'de-DE-KatjaNeural', has_tts: true, flag: '🇩🇪' },
  { code: 'ru', name: 'Russian', native_name: 'Русский', voice_id: 'ru-RU-SvetlanaNeural', has_tts: true, flag: '🇷🇺' },
  { code: 'ar', name: 'Arabic', native_name: 'العربية', voice_id: 'ar-EG-SalmaNeural', has_tts: true, flag: '🇸🇦' },
  { code: 'pt', name: 'Portuguese', native_name: 'Português', voice_id: 'pt-BR-FranciscaNeural', has_tts: true, flag: '🇧🇷' },
];

export const MOCK_WORD_GROUPS: WordGroup[] = [
  { id: 'g1', name: 'IELTS Core 3000', count: 3000, type: 'system', progress: 15, language: 'en', coverImage: '📚', description: 'Essential vocabulary for high IELTS scores.' },
  { id: 'g2', name: 'Business English', count: 500, type: 'system', progress: 80, language: 'en', coverImage: '💼', description: 'Professional terms for the workplace.' },
  { id: 'g3', name: 'JLPT N5 Vocabulary', count: 800, type: 'system', progress: 5, language: 'jp', coverImage: '⛩️', description: 'Beginner Japanese for JLPT N5.' },
  { id: 'g4', name: 'My Uploaded PDF', count: 120, type: 'document', progress: 0, language: 'en', coverImage: '📄', description: 'Extracted from "The_Great_Gatsby.pdf"' },
  { id: 'g5', name: 'Travel French', count: 200, type: 'system', progress: 0, language: 'fr', coverImage: '🗼', description: 'Useful phrases for your Paris trip.' },
  { id: 'g6', name: 'TOEFL Mastery', count: 1200, type: 'system', progress: 0, language: 'en', coverImage: '🎓', description: 'Advanced academic vocabulary.' },
  { id: 'g7', name: 'Korean Basics', count: 100, type: 'system', progress: 0, language: 'kr', coverImage: '👋', description: 'Hangul and basic greetings.' },
];

export const MOCK_WORDS_EN: Word[] = [
  {
    id: 'w1', text: 'Serendipity', phonetic: '/ˌsɛrənˈdɪpɪti/',
    translation: '意外发现珍宝的运气', definition: 'The occurrence and development of events by chance in a happy or beneficial way.',
    example: 'It was only through pure serendipity that we met.', masteryLevel: 20, tags: ['noun', 'advanced']
  },
  {
    id: 'w2', text: 'Ephemeral', phonetic: '/əˈfɛm(ə)r(ə)l/',
    translation: '短暂的', definition: 'Lasting for a very short time.',
    example: 'Fashions are ephemeral, changing with every season.', masteryLevel: 60, tags: ['adjective']
  },
  {
    id: 'w3', text: 'Eloquent', phonetic: '/ˈɛləkwənt/',
    translation: '雄辩的', definition: 'Fluent or persuasive in speaking or writing.',
    example: 'She made an eloquent appeal for action.', masteryLevel: 80, tags: ['adjective']
  },
  {
    id: 'w4', text: 'Resilience', phonetic: '/rɪˈzɪlɪəns/',
    translation: '韧性', definition: 'The capacity to recover quickly from difficulties.',
    example: 'He showed great resilience after the accident.', masteryLevel: 10, tags: ['noun']
  },
   {
    id: 'w5', text: 'Ubiquitous', phonetic: '/juːˈbɪkwɪtəs/',
    translation: '无所不在的', definition: 'Present, appearing, or found everywhere.',
    example: 'Smartphones have become ubiquitous in modern society.', masteryLevel: 5, tags: ['adjective']
  },
  {
    id: 'w6', text: 'Mellifluous', phonetic: '/məˈlɪflʊəs/',
    translation: '声音甜美的', definition: '(of a voice or words) sweet or musical; pleasant to hear.',
    example: 'She had a rich, mellifluous voice.', masteryLevel: 0, tags: ['adjective']
  },
  {
    id: 'w7', text: 'Ineffable', phonetic: '/ɪnˈɛfəb(ə)l/',
    translation: '难以言表的', definition: 'Too great or extreme to be expressed or described in words.',
    example: 'The ineffable beauty of the sunrise.', masteryLevel: 0, tags: ['adjective']
  },
  {
    id: 'w8', text: 'Petrichor', phonetic: '/ˈpɛtrɪkɔː/',
    translation: '潮土油香', definition: 'A pleasant smell that frequently accompanies the first rain after a long period of warm, dry weather.',
    example: 'I love the smell of petrichor in the spring.', masteryLevel: 0, tags: ['noun']
  }
];

export const MOCK_WORDS_JP: Word[] = [
  {
    id: 'j1', text: '猫 (Neko)', phonetic: 'neko', translation: '猫',
    definition: 'A small domesticated carnivorous mammal.', example: '猫がベッドで寝ています。', masteryLevel: 90, tags: ['noun']
  },
  {
    id: 'j2', text: '図書館 (Toshokan)', phonetic: 'toshokan', translation: '图书馆',
    definition: 'A building or room containing collections of books.', example: '図書館で勉強します。', masteryLevel: 30, tags: ['place']
  }
];

export const MOCK_QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'q1', wordId: 'w1', type: 'meaning',
    question: 'Select the correct meaning for: Serendipity',
    options: [
      { id: 'o1', text: 'Unexpected good luck', isCorrect: true },
      { id: 'o2', text: 'Deep sadness', isCorrect: false },
      { id: 'o3', text: 'Fear of heights', isCorrect: false },
      { id: 'o4', text: 'Speed of light', isCorrect: false },
    ]
  },
  {
    id: 'q2', wordId: 'w2', type: 'meaning',
    question: 'Which word means "Lasting for a very short time"?',
    options: [
      { id: 'o1', text: 'Eternal', isCorrect: false },
      { id: 'o2', text: 'Ephemeral', isCorrect: true },
      { id: 'o3', text: 'Enduring', isCorrect: false },
      { id: 'o4', text: 'Eloquent', isCorrect: false },
    ]
  },
  {
    id: 'q3', wordId: 'w3', type: 'spelling',
    question: 'Select the correct spelling:',
    options: [
      { id: 'o1', text: 'Eloquant', isCorrect: false },
      { id: 'o2', text: 'Eloquent', isCorrect: true },
      { id: 'o3', text: 'Eliquent', isCorrect: false },
      { id: 'o4', text: 'Elequent', isCorrect: false },
    ]
  }
];

export const MOCK_RETENTION_STATS: RetentionStat[] = [
  { level: 'Critical', count: 12, color: 'bg-red-500', percentage: 10 },
  { level: 'Review', count: 45, color: 'bg-yellow-500', percentage: 35 },
  { level: 'Learning', count: 120, color: 'bg-blue-500', percentage: 40 },
  { level: 'Mastered', count: 273, color: 'bg-green-500', percentage: 60 },
];

export const MOCK_LEADERBOARD: LeaderboardUser[] = [
  { rank: 1, name: 'Sarah Chen', avatar: 'https://ui-avatars.com/api/?name=Sarah&background=random', xp: 15400, isCurrentUser: false },
  { rank: 2, name: 'Mike Ross', avatar: 'https://ui-avatars.com/api/?name=Mike&background=random', xp: 14200, isCurrentUser: false },
  { rank: 3, name: 'Demo User', avatar: 'https://ui-avatars.com/api/?name=Demo+User&background=3B82F6&color=fff', xp: 12500, isCurrentUser: true },
  { rank: 4, name: 'Yuki Tanaka', avatar: 'https://ui-avatars.com/api/?name=Yuki&background=random', xp: 11000, isCurrentUser: false },
  { rank: 5, name: 'Jean Pierre', avatar: 'https://ui-avatars.com/api/?name=Jean&background=random', xp: 9800, isCurrentUser: false },
];

export const MOCK_ACHIEVEMENTS: Achievement[] = [
  { id: 'a1', name: 'Early Bird', description: 'Complete a study session before 8 AM', icon: '🌅', unlocked: true, progress: 1, maxProgress: 1 },
  { id: 'a2', name: 'Bookworm', description: 'Learn 1000 words', icon: '🐛', unlocked: false, progress: 450, maxProgress: 1000 },
  { id: 'a3', name: 'Unstoppable', description: 'Reach a 30-day streak', icon: '🔥', unlocked: false, progress: 5, maxProgress: 30 },
  { id: 'a4', name: 'Polyglot', description: 'Learn words in 3 different languages', icon: '🌍', unlocked: false, progress: 1, maxProgress: 3 },
];

export const MOCK_FRIENDS: Friend[] = [
  { id: 'f1', name: 'Alice Wu', avatar: 'https://ui-avatars.com/api/?name=Alice&background=random', status: 'studying', lastActive: 'Now', streak: 12 },
  { id: 'f2', name: 'Bob Smith', avatar: 'https://ui-avatars.com/api/?name=Bob&background=random', status: 'online', lastActive: '5m ago', streak: 3 },
  { id: 'f3', name: 'Charlie Kim', avatar: 'https://ui-avatars.com/api/?name=Charlie&background=random', status: 'offline', lastActive: '2h ago', streak: 45 },
];

export const MOCK_ACTIVITIES: ActivityLog[] = [
  { id: 'al1', userId: 'f1', userName: 'Alice Wu', userAvatar: 'https://ui-avatars.com/api/?name=Alice', action: 'completed 50 words', time: '10m ago', likes: 3 },
  { id: 'al2', userId: 'f2', userName: 'Bob Smith', userAvatar: 'https://ui-avatars.com/api/?name=Bob', action: 'reached level 5', time: '1h ago', likes: 12 },
  { id: 'al3', userId: 'f3', userName: 'Charlie Kim', userAvatar: 'https://ui-avatars.com/api/?name=Charlie', action: 'joined "IELTS Core"', time: '3h ago', likes: 1 },
];

// Translation dictionary for i18n
export const I18N_DICT: Record<string, Record<string, string>> = {
  'en': {
    'home': 'Home', 'settings': 'Settings', 'profile': 'Profile', 'login': 'Login',
    'daily_goal': 'Daily Goal', 'learned': 'Learned', 'review': 'Review',
    'start_learning': 'Start Learning', 'reading_mode': 'Reading Mode',
    'language': 'Language', 'theme': 'Theme', 'notifications': 'Notifications',
    'general': 'General', 'audio': 'Audio', 'account': 'Account', 'about': 'About',
    'library': 'Library', 'upload': 'Upload', 'dictionary': 'Dictionary', 'social': 'Social',
    'playlist': 'Playlist', 'history': 'History', 'friends': 'Friends'
  },
  'zh': {
    'home': '首页', 'settings': '设置', 'profile': '我的', 'login': '登录',
    'daily_goal': '今日目标', 'learned': '已学单词', 'review': '待复习',
    'start_learning': '开始学习', 'reading_mode': '阅读模式',
    'language': '语言设置', 'theme': '主题外观', 'notifications': '通知提醒',
    'general': '通用', 'audio': '发音设置', 'account': '账户管理', 'about': '关于应用',
    'library': '词库', 'upload': '上传文档', 'dictionary': '词典', 'social': '排行榜',
    'playlist': '播放列表', 'history': '学习历史', 'friends': '好友动态'
  }
};
