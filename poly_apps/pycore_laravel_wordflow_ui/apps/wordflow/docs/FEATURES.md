# WordFlow FEATURES 功能描述

> WordFlow 功能描述(功能层)— 仅描述每个功能做什么、用户如何体验;不含接口/数据模型/代码/进度。

本文档按功能域描述 WordFlow 的用户可见行为与功能规则。每一节回答两个问题:**这个功能做什么**,以及**用户使用时会看到、能操作什么**。凡涉及实现的部分(数据如何流转、后台如何排队、字段如何命名)一律不在此列。

适用范围保持中英双语,便于中英文用户共同理解。

---

## 1. 词库与学习 Vocabulary

### 1.1 学习循环:浏览词库 Browsing a library

用户从首页或词库列表进入某个词库的详情页后:

- 页面顶部显示**词库信息**:词库名称、单词总数、所属语言。
- 单词列表**分页加载**,用户可逐页翻看,不会一次性把成千上万的单词全压到屏幕上。
- 用户可调整**每页显示的单词数量**,在一屏看少量单词(便于专注)与看大量单词(便于速览)之间自由选择。
- 词库覆盖范围很广,从入门级精简词表到数万乃至十万级的大词典都能浏览(例如初级简易词表、四六级 / GRE / TOEFL / 考研等考试词表、以及超大型通用英语词库)。

The library detail page shows the library's name, total word count and language, loads words page by page, and lets the user control how many words appear per page — from small focused sets to large fast-scanning lists. Libraries range from small beginner word lists to very large dictionaries (exam word lists such as CET-6 / GRE / TOEFL, and very large general-English collections).

### 1.2 显示选项 Display options

词库详情页提供一个**显示设置面板**,用户可随时切换:

- **显示 / 隐藏序号**:每个单词前是否带编号。
- **显示 / 隐藏翻译**:是否在单词旁显示译文。该开关与下面的视图切换保持同步。
- **字号调节**:在约 12–24px 范围内放大或缩小单词字体,照顾不同阅读偏好。
- **每页单词数**:控制分页粒度(见 1.1)。

此外提供两种**视图模式**:

- **完整视图(Full View)**:每个单词同时显示音标、译文、以及音频播放控件,信息量最大,适合精学。
- **简洁视图(Simple View)**:只显示单词本身,适合快速浏览或自我测验(先看词、再回想含义)。

"显示翻译"开关与视图模式联动:切到简洁视图即隐去译文,切回完整视图即恢复。

A display panel lets the user toggle word numbering, toggle translations, adjust font size, and set words-per-page. A Full View shows phonetics, translation and audio together, while a Simple View shows only the word itself for quick scanning or self-testing. The "show translation" toggle stays in sync with the view mode.

### 1.3 按需翻译行为 Translate-on-demand

WordFlow 的词库可能包含尚未翻译的单词。翻译是**按需、异步**补齐的,用户体验如下:

- 用户打开某页词库时,**当前可见的、还没有译文的单词**会被自动排进翻译任务,系统在后台逐步把译文准备好。用户无需手动点击翻译,也无需选择翻译服务。
- 在译文还没准备好之前,这些单词旁会显示一个 **"翻译中…"指示**:一个带柔和脉动效果的琥珀色提示(配图标,无表情符号文字),让用户清楚知道"这个词正在翻译,稍等会出现"。
- 译文一旦就绪,会**自动填入**对应单词,无需用户刷新页面或重新操作。
- 用户**优先看到的内容优先翻译**:当前正在浏览的单词比稍后才会看到的单词更早被处理。
- 如果用户**离开并稍后重新打开**同一页(或重新加载),此前后台已经补好的译文会**直接带出来显示**,不必再等。
- 切换到**不同词库 / 不同页 / 不同目标语言**时,翻译范围会随之切换到新的可见内容,旧页面不再继续占用翻译资源。
- 翻译的**目标语言**默认是用户的母语(可在设置中调整),源语言则取自当前词库本身的语言。

行为边界:翻译是"尽力而为"。在离线、未登录或后台暂时不可用时,单词会**回退显示原文**,浏览不会被阻塞;待条件恢复,缺失的译文会在后续自动补上。

Translations are filled in on demand and asynchronously. When the user opens a page, the visible untranslated words are queued automatically (no manual translate button, no service picker). While a word is being translated it shows a gentle pulsing "translating…" indicator (amber, with an icon, no emoji text); once ready, the translation appears automatically without a refresh. Words the user is currently looking at are prioritized over words further down. Reopening a page (or reloading) immediately shows translations that finished in the background. Changing library, page or target language re-scopes translation to the new visible content. The target language defaults to the user's native language (adjustable in settings); the source language comes from the library. Translation is best-effort: offline / signed-out / temporarily unavailable falls back to showing the original word and never blocks browsing, with missing translations filled in later automatically.

---

## 2. 音频与语音合成 Audio & TTS

WordFlow 为单词提供发音音频。音频和翻译一样,是**按需生成、就绪后自动出现**的,用户不必手动触发生成。

### 2.1 音频播放行为 Playback

- 每个**已有音频**的单词旁显示一个**播放按钮**;点击即可立即听到发音。
- **同一时间只播放一个音频**:开始播放新单词时,正在播放的上一个会自动停止,不会出现多个发音叠在一起。
- 播放时按钮给出**视觉反馈**(在"播放 / 暂停"状态间切换并高亮);音频播完后自动复位为可再次播放的状态。
- 若某次播放失败(例如音频暂时取不到),状态会安全复位,不会让按钮一直卡在"播放中"。

Each word that has audio shows a play button; clicking plays the pronunciation immediately. Only one audio plays at a time — starting a new one stops the previous. The button gives visual feedback (play/pause highlight) and resets automatically when playback ends or fails.

### 2.2 用户看到的音频状态 Audio states

每个单词的音频控件会处于以下几种状态之一,用户一眼可辨:

- **可播放**:单词已有音频 → 显示蓝色播放按钮,可点击。
- **正在播放**:当前单词正在发声 → 按钮高亮为暂停态。
- **生成中**:单词还没有音频 → 显示一个**琥珀色、带脉动动画的"音频生成中"提示**(中英双语提示文字 "音频生成中… / Audio generating…")。这表示系统正在后台为该词制作发音。

A word's audio control is always in one of: playable (blue play button), playing (highlighted pause state), or generating (an amber pulsing "audio generating…" indicator with a bilingual tooltip).

### 2.3 按需生成行为 On-demand generation

- 用户打开词库某页后,系统会**自动检测当前页缺少音频的单词**,并安排后台为它们生成发音 —— 用户无需做任何操作。
- 对于**之前已经生成过**的单词,音频会**立即可用**(直接显示播放按钮),不会重复等待。
- 对于仍需生成的单词,"音频生成中"提示会**持续显示**,直到该词的发音准备好;就绪的一刻,提示**自动变为播放按钮**,用户即可收听 —— 整个过程平滑、无需刷新页面。
- 系统**只为用户当前正在看的页面**准备音频;翻页或切换词库时,生成与等待会随之切换到新的一页,旧页面不再占用资源。
- 全部音频就绪后,等待提示全部消失,该页所有单词都变为可播放。
- 若在等待过程中登录状态失效,系统会停止等待并给出提示。

When the user opens a page, words missing audio are detected automatically and generated in the background — no user action needed. Words generated earlier are instantly playable. Words still pending keep showing the "generating…" indicator until their pronunciation is ready, at which point the indicator turns into a play button automatically (no refresh). Generation/waiting is scoped to the page the user is currently viewing and follows them as they navigate; once everything is ready, all words on the page become playable.

---

## 3. 基于语言的背诵分组 Language-based Study Groups

背诵分组(Study Groups)是用户用来组织和管理学习计划的容器:把不同的词组(word groups,例如某个考试词表)归拢到一个分组里集中背诵,并跟踪进度。WordFlow 的分组是**按语言组织**的。

### 3.1 这是什么 What they are

- 每个背诵分组都**绑定一种语言**。一个分组只承载该语言的词组,从而让不同语言的学习内容自然隔离、互不混淆。
- 同一种语言下,用户可以创建**多个**分组(例如英语下分"考试准备""商务英语""日常口语"),按自己的学习目标细分。
- 每个分组会显示其**名称、图标、所属语言,以及统计信息**:包含多少个词组、共多少单词、已学多少、整体进度,以及每日目标。

A study group is a container for organizing study plans; each group is bound to one language and only holds word groups of that language, keeping different languages cleanly separated. A user can create multiple groups per language, and each group shows its name, icon, language and stats (number of word groups, total words, learned words, progress, daily goal).

### 3.2 自动建组 Auto-grouping by language

- 用户在设置中**选择一门要学习的语言**时,系统会**自动为该语言创建一个默认分组**,用户无需手动新建即可马上开始往里添加内容。该默认分组以语言的本地名称命名(例如选日语时命名为 "日本語"),并带有该语言对应的图标。
- 用户因此无需理解"分组"概念也能上手:选了语言,就已经有了一个归属之处。

When the user picks a language to learn, a default group for that language is created automatically (named in the language's native name, e.g. "日本語", with its flag icon), so the user can start adding content without manually creating anything.

### 3.3 用户能做什么 What the user can do

- **把词组加入分组**:在词组列表中选择"加入背诵分组"时,系统**只展示与该词组语言匹配的分组**作为候选,并提供"创建一个同语言的新分组"的入口。用户因此不会误把内容放进不相干语言的分组。
- **创建 / 重命名 / 删除分组**,在同一语言下自由细分学习计划。
- **查看进度**:分组的词组数、单词数、已学数与进度会在用户增删词组、推进学习时**自动更新**,无需手动维护这些数字。

When adding a word group to a study group, only groups matching that word group's language are offered as choices (plus an option to create a new same-language group), so content can't be misfiled under the wrong language. Users can create, rename and delete groups within a language, and the group's counts and progress update automatically as content is added/removed and as the user studies.

### 3.4 语言不匹配规则 Language-mismatch rule

- 一个分组只接受**与自己语言相同**的词组。若试图把某语言的词组加入到另一种语言的分组(例如把日语词组塞进英语分组),系统会**拒绝该操作并向用户给出明确提示**,说明语言不匹配。
- 这条规则保证每个分组内部始终是单一语言的纯净集合。

A group only accepts word groups of its own language. Attempting to add a word group of a different language (e.g. a Japanese word group into an English group) is rejected with a clear "language mismatch" message to the user, keeping every group single-language.

### 3.5 即时刷新 Live updates

- 任何对分组的改动(新建、改名、加词组、进度变化)都会**即时反映到界面**,用户在不同地方看到的分组数据保持一致,无需手动刷新。打开页面时通常先即时显示已有数据,随后在后台静默更新到最新。

Any change to groups is reflected in the UI immediately and consistently across the app, with cached data shown first and refreshed quietly in the background.

---

## 4. 图标与多语言首页 Icons & Multi-language Home

### 4.1 解耦的图标行为 Decoupled icons

WordFlow 用一套**通用图标名**来表达语言与界面元素的图标,而不是把具体的图标素材写死。对用户而言,效果是:

- 每种语言都能显示对应的**国旗 / 标识图标**(例如英语显示美国旗、中文显示中国旗、日语显示日本旗等),覆盖 **80 多个国家 / 地区的旗帜**。
- 当某种语言没有明确指定的图标时,系统会根据语言**自动选用合适的旗帜**;若仍无法确定,则回退到一个**通用的地球图标 🌐**作为兜底,确保任何语言都有图标可显示,绝不出现空白。
- 这套图标方案可灵活扩展,新增语言或自定义图标都能纳入,而用户侧的显示行为保持一致。

Each language displays an appropriate flag/identifier icon, covering 80+ country/region flags. When a language has no explicit icon, a suitable flag is chosen automatically from the language; if still undetermined, it falls back to a generic globe 🌐, so every language always has an icon and nothing renders blank. The icon set is extensible without changing how it behaves for the user.

### 4.2 多语言首页 Multi-language home

WordFlow 支持用户**同时学习多种语言**,首页对此有专门的呈现:

- 首页有一条**目标语言栏**,显示用户**当前所有学习语言的旗帜**(多个图标横向并排),而不是只显示第一种语言。
- 每个旗帜可**悬停交互**:悬停时图标轻微放大(约 110%),并弹出**该语言名称的提示(tooltip)**。
- 旗帜旁以**逗号分隔列出语言名称**(例如 "English, Japanese, Korean");名称过长时自动截断为省略号,避免撑破布局。
- 语言栏右侧始终保留一个**设置入口按钮**,点击直达语言设置页。
- 仅选择一种语言时正常显示单个旗帜与名称;若用户把学习语言全部移除,系统**兜底回到英语**,确保首页始终有一个有效的目标语言。

The home page has a target-language bar showing the flags of all the user's learning languages side by side (not just the first). Each flag is hoverable (scales up ~110% with a tooltip showing the language name), and the names are listed comma-separated (e.g. "English, Japanese, Korean"), truncating with an ellipsis when long. A settings button beside the bar links to language settings. A single selected language shows one flag/name; removing all languages falls back to English so there is always a valid target.

### 4.3 按语言过滤词库 Language-based library filtering

首页的词库列表会根据用户选择的学习语言**实时过滤**:

- 用户**未选择任何学习语言**时,首页显示**全部词库**。
- 用户**选择了一种或多种语言**时,首页**只显示这些语言对应的词库**,把无关语言的词库隐去,让用户专注于自己正在学的语言。
- 用户在设置中**修改学习语言后,首页自动刷新**过滤结果,无需手动操作。
- 当过滤后**没有任何匹配词库**时,首页显示一个**空状态提示**,并引导用户前往语言设置进行调整。

The home library list filters in real time by the user's learning languages: with none selected it shows all libraries; with one or more selected it shows only libraries of those languages and hides the rest. Changing languages in settings refreshes the home page automatically. When nothing matches, an empty state appears that guides the user to language settings.

### 4.4 语言设置页 Language settings

- 语言设置页以**网格(grid)布局**展示所有支持的语言,每张卡片带语言图标与名称。
- 用户可**多选**要学习的语言(复选框形式);选择会被**持久化保存**,并在首页、背诵分组等处即时生效(对应自动建组见 §3.2、首页多旗帜见 §4.2、词库过滤见 §4.3)。

The language settings page shows all supported languages in a grid with icons, lets the user multi-select languages to learn, and persists the choice so it takes effect immediately across the home page and study groups.

### 4.5 支持的语言集合 Supported language set

WordFlow 的支持语言覆盖 **80 多种**,既包含主流大语种,也包含许多区域性语言。每种语言都带有名称、本地名称(native name)与对应图标,并可用于语音合成(发音音频)。代表性语言包括(非穷举):

WordFlow supports 80+ languages, each with a name, a native name and an icon, and each usable for speech synthesis. Representative languages include (non-exhaustive):

- 英语 English、中文 Chinese(及粤语 Cantonese、吴语 Wu)、日语 Japanese、韩语 Korean
- 西班牙语 Spanish、法语 French、德语 German、意大利语 Italian、葡萄牙语 Portuguese、俄语 Russian、荷兰语 Dutch
- 阿拉伯语 Arabic、希伯来语 Hebrew、波斯语 Persian、土耳其语 Turkish、印地语 Hindi、孟加拉语 Bengali、泰米尔语 Tamil、泰卢固语 Telugu、乌尔都语 Urdu
- 泰语 Thai、越南语 Vietnamese、印尼语 Indonesian、马来语 Malay、菲律宾语 Filipino、缅甸语 Myanmar、高棉语 Khmer、老挝语 Lao
- 波兰语 Polish、捷克语 Czech、乌克兰语 Ukrainian、希腊语 Greek、瑞典语 Swedish、丹麦语 Danish、芬兰语 Finnish、挪威语 Norwegian,以及更多中欧 / 北欧 / 非洲 / 高加索语言。

每种语言在界面上都会显示对应国旗图标;无明确图标的语言按 §4.1 的规则自动选取或回退。

---

## 5. 匿名浏览与登录门控 Anonymous Browsing & Login Gating

> 2026-06-12 交互改版:公共内容"先看后登录",登录只在用户要"占有"内容时出现。

### 5.1 不登录也能逛 Browse without an account

- **公共内容对所有访客开放**:词库(含推荐页)、书籍、字幕等公共学习内容,未登录也能从首页进入并完整浏览——看词表、看句子、听已生成的读音,均不弹登录。
- 首页的公共内容区与**推荐页不再被登录墙挡住**;匿名访客看到的推荐与登录用户一致,只是所有"已选择"标记都显示为未选择。
- 浏览体验与登录后相同:分页、显示选项、音频播放等只读能力全部可用。

Public learning content — vocabulary libraries (including the recommendations page), books and subtitles — is fully browsable without signing in: visitors can open them from the home page, read word lists and sentences, and play available audio, with no login wall. Anonymous visitors see the same recommendations as signed-in users, just with every "selected" mark shown as unselected. Read-only features (paging, display options, audio playback) behave identically.

### 5.2 受保护操作引导登录 Protected actions

- 当访客触发**占有性操作**(把词库/书籍/字幕加入自己的分组、选择词库集合、记录学习进度等)时,界面弹出一个**受保护操作引导面板(sheet)**,说明该操作需要账号,并提供登录/注册入口。
- 登录成功后**回到原意图位置**,用户无需重新找到刚才想操作的内容。

When a visitor triggers a possessive action (adding a library/book/subtitle to their group, selecting a collection, recording progress), a protected-action sheet explains that an account is needed and offers sign-in/sign-up; after logging in the user returns to their original intent.

### 5.3 统一的"加入词库"面板 Unified add-to-library sheet

- 把任何公共内容(词库、书籍、字幕)加入自己的学习计划时,使用**同一个"加入"面板**:面板中**默认分组置顶(pinned)**,一键即可加入。
- 面板内可**直接新建分组**;新建成功后**自动把当前内容挂载进去**,无需用户再点一次"加入"。

Adding any public content (library, book or subtitle) to one's study plan uses a single unified sheet: the default group is pinned at the top for one-tap adding, and a group created from inside the sheet automatically receives the content being added.

### 5.4 分组的"来源"统一视图 Unified Sources view

- 分组详情页提供一个**Sources(来源)视图**,把该分组挂载的**词库、书籍、字幕**放在一起统一展示,每项带名称/标题、语言、词数(或本次并入的新增词数)与加入时间。
- 从分组**移除某个来源只解除挂载**:已经并入分组的单词全部保留,学习进度不受影响(词库与媒体来源语义一致)。
- 重复添加同一来源是安全的:系统识别已挂载的来源,不会重复并入单词。

The group detail page offers a unified Sources view listing the group's attached libraries, books and subtitles together, each with its title, language, word count (or words added) and added time. Removing a source only detaches it — words already merged into the group remain and progress is unaffected (libraries and media sources behave the same), and re-adding an already-attached source is safely recognized without duplicating words.
