# QY单词学习 - React Native App

基于React Native开发的单词学习应用，支持多种学习模式、智能复习系统和完整的统计分析。

## 功能特性

### 核心功能
- 📚 单词组管理：支持文档导入、标准词库、自定义单词组
- 📖 阅读模式：核心学习功能，支持自动播放、瞬时复习
- 🔄 复习系统：基于艾宾浩斯遗忘曲线的智能复习
- 📊 统计分析：完整的学习数据统计和可视化
- 💾 记忆库：统一的单词记忆数据管理
- 🔗 词库同步：与后端词库实时同步

### 系统特性
- 🌍 多语言支持：支持9种界面语言
- 🎨 主题系统：支持浅色/深色主题
- 🔌 API集成：支持API和Mock数据自动切换
- 💾 数据持久化：使用AsyncStorage本地存储
- 📱 响应式设计：适配不同屏幕尺寸

## 项目结构

```
poly_apps/react_native_qy/
├── src/
│   ├── common/              # 共享代码
│   │   ├── i18n/            # 多语言系统
│   │   ├── theme/           # 主题系统
│   │   ├── mock/            # Mock数据中心
│   │   ├── services/        # API服务
│   │   └── components/      # 共享组件
│   └── qy/                  # QY应用代码
│       ├── qy_pages/        # 页面组件（20+页面）
│       ├── qy_navigation/  # 导航配置
│       ├── qy_store/        # 状态管理
│       ├── qy_services/      # API服务
│       └── qy_types/         # 类型定义
├── package.json
├── tsconfig.json
└── README.md
```

## 页面列表

1. HomePage - 首页
2. LearnPage - 学习页面
3. ReviewPage - 复习页面
4. StatisticsPage - 统计页面
5. SettingsPage - 设置页面
6. WordGroupListPage - 单词组列表
7. WordGroupDetailPage - 单词组详情
8. WordDetailPage - 单词详情
9. ReadingModePage - 阅读模式（核心功能）
10. MemoryLibraryPage - 记忆库
11. DocumentUploadPage - 文档上传
12. LoginPage - 登录
13. RegisterPage - 注册
14. ProfilePage - 个人中心
15. LearningSettingsPage - 学习设置
16. PronunciationSettingsPage - 发音设置
17. ThemeSettingsPage - 主题设置
18. NotificationSettingsPage - 通知设置
19. DataSyncSettingsPage - 数据同步设置
20. AboutPage - 关于
21. HelpPage - 帮助
22. AchievementPage - 成就

## 技术栈

- React Native 0.82.1
- TypeScript
- React Navigation 7.x
- i18next (多语言)
- AsyncStorage (数据持久化)
- react-native-tts (文本转语音)

## 安装和运行

### 安装依赖
```bash
npm install
# 或
yarn install
```

### 运行Android
```bash
npm run android
```

### 运行iOS
```bash
npm run ios
```

## API配置

默认API地址：`http://192.168.50.2:9000`

当API不可用时，系统会自动使用Mock数据。

## 开发规范

- 使用TypeScript进行类型检查
- 所有文本使用多语言key，不硬编码
- 使用主题系统，支持light/dark模式
- API请求支持Mock数据回退
- 使用AsyncStorage进行数据持久化

## 文档

详细功能文档请参考：`_prompt/QY手机APP构建.md`

