# WordFlow 能力与数据流概览 / Capabilities & Data Flow

> WordFlow 能力与数据流概览(功能层)— 仅描述应用能做什么与概念数据流,不含架构/类/代码结构;实现由 AI 自由决定。

---

## 这是什么 / What it is

WordFlow 是一款 AI 辅助的语言学习应用。用户围绕个人词库进行学习,辅以翻译、朗读、个人词典等工具。应用记住用户的偏好与进度,并在不同会话间保持一致体验。

WordFlow is an AI-assisted language-learning app. Users learn around personal word collections, supported by translation, text-to-speech, a personal dictionary, and related tools. The app remembers preferences and progress, keeping a consistent experience across sessions.

---

## 应用能做什么 / What it can do

- **学习 / Learning** — 用户围绕词组/词库学习,查看统计(进度、连续天数、完成度),并获得推荐与学习内容。Learn around word collections; see stats (progress, streak, completion) and receive recommendations.
- **翻译 / Translation** — 对文本进行翻译,支持普通翻译与面向学习的翻译模式。Translate text, including a learning-oriented mode.
- **朗读 / Text-to-Speech** — 为词汇与句子生成语音,支持按语言选择嗓音与批量生成。Generate speech for words and sentences, with voice selection per language and batch generation.
- **个人词典 / Personal Dictionary** — 用户建立并查询自己的词条。Build and query a personal collection of entries.
- **账户与个人资料 / Account & Profile** — 注册、登录、登出;查看与更新个人资料(含头像)。Register, sign in/out; view and update profile, including avatar.
- **设置 / Settings** — 调整界面语言、学习语言、母语、主题(浅色/深色/自动)、字号、音频与学习偏好、通知。Adjust interface/learning/native language, theme, font size, audio and learning preferences, notifications.

界面支持多语言(英语、中文、日语、韩语、西班牙语、法语、德语),并在缺失翻译时回退到英文;数字、日期与相对时间按当前语言本地化呈现。

The interface is multilingual (English, Chinese, Japanese, Korean, Spanish, French, German) with English fallback; numbers, dates, and relative times are localized to the current language.

---

## 数据如何流动(从用户视角)/ How data flows (user's perspective)

- **用户操作即时反映,并跨会话保留** — 用户的操作更新应用内的状态,界面立即响应;关键数据(登录态、设置、语言、学习进度等)被持久化,关闭后再次打开仍然保留。User actions update state and the UI responds immediately; key data persists and survives restarts.

- **登录建立会话,门控个人功能** — 用户提交凭证后建立登录会话;会话有效期间,个人资料、词库、进度等私有功能可用;登出或会话失效后,这些功能被收回。Login establishes a session that gates personal features; signing out (or session expiry) revokes access.

- **设置应用到整个应用,并在重启后保留** — 主题、界面语言、字号等设置一经更改,立即作用于整个应用界面,并被保存;下次启动时自动恢复。Settings (theme, language, font size) apply app-wide on change, are saved, and are restored on next launch.

- **内容来自同源后端** — 学习内容、翻译、语音、词典数据等向同源后端获取;请求自动携带用户的会话凭证,响应回来后更新界面并按需缓存,以减少重复请求。Content (learning data, translations, speech, dictionary) is fetched from the same-origin backend; requests carry the user's session automatically, and responses update the UI and are cached where useful.

- **失败有统一反馈** — 当后端请求失败时,用户会得到一致的错误提示,而非界面卡死。When a backend request fails, the user gets consistent error feedback rather than a frozen UI.

---

## 导航与页面 / Navigation & pages

应用的信息架构、导航(悬浮岛/分类)、沉浸式与受保护页面的语义、以及用户流程,均在设计文档中定义,详见 `docs/design/WORDFLOW_DESIGN_SYSTEM_4.0.md`(§7 信息架构与导航、§8 应用外壳)。

The app's information architecture, navigation, immersive/protected page semantics, and user flows are defined in the design doc — see `docs/design/WORDFLOW_DESIGN_SYSTEM_4.0.md` (§7 IA & Navigation, §8 App Shell).
