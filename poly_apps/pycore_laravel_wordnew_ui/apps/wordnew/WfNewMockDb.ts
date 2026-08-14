// Single shared TYPE surface — mock data and the live API use the SAME types.
import {
  Word, WordGroup, BentoGroup,
  SubtitleWord, SubtitleLine, SubtitleCourse,
  BilingualWord, BilingualSentence,
  WeeklyActivity, CategoryScore, StudiedTimelineItem, AnalyticsStats,
  WfNewContentGroup,
} from './api/WfNewApiTypes';

// 1. Core Bento Box Word Groups with detailed descriptive parameters
export const MOCK_BENTO_GROUPS: BentoGroup[] = [
  {
    id: 'bento-cosmic-1',
    name: 'Astral Nebula Vocab (星云高阶词汇)',
    count: 145,
    progress: 72,
    type: 'GRE / TOEFL',
    language: 'en',
    description: 'Advanced cosmic metaphors, astrophysics terminology, and celestial literary definitions.',
    badge: '★ Cosmic Elite',
    gridSpan: 'md:col-span-2 md:row-span-2 h-[340px]',
    bgGradient: 'from-purple-100/70 via-indigo-50/50 to-indigo-100/70',
    bgGradientDark: 'from-violet-950/20 via-slate-900/40 to-indigo-950/20',
    decorColor: 'text-indigo-400 dark:text-purple-400',
    decorativeSvg: 'nebula',
    statsLabel: 'Synaptic Link Active'
  },
  {
    id: 'bento-silicon-2',
    name: 'Silicon Mechanics & AI (硅谷科技前沿)',
    count: 84,
    progress: 58,
    type: 'Cutting Edge',
    language: 'en',
    description: 'Neural networks, autonomous pipelines, cognitive models, and algorithmic engineering terms.',
    badge: '⚡ Tech Core',
    gridSpan: 'md:col-span-1 md:row-span-1 h-[160px]',
    bgGradient: 'from-emerald-50/70 to-teal-100/70',
    bgGradientDark: 'from-emerald-950/15 to-slate-900/40',
    decorColor: 'text-teal-400 dark:text-emerald-400',
    decorativeSvg: 'matrix',
    statsLabel: 'Pipeline Compiled'
  },
  {
    id: 'bento-literary-3',
    name: 'Ephemeral Verses (吟风呓语·美学文学)',
    count: 62,
    progress: 90,
    type: 'Acoustic Prose',
    language: 'en',
    description: 'Delicate sensory verbs, transient poetry tags, and classical editorial rhetoric elements.',
    badge: '❧ Literary Fine',
    gridSpan: 'md:col-span-1 md:row-span-2 h-[345px]',
    bgGradient: 'from-rose-100/70 via-pink-50/50 to-orange-100/70',
    bgGradientDark: 'from-rose-950/15 via-slate-900/40 to-amber-950/15',
    decorColor: 'text-rose-400 dark:text-orange-400',
    decorativeSvg: 'stars',
    statsLabel: 'Aesthetic Sense Mastered'
  },
  {
    id: 'bento-business-4',
    name: 'Wall Street Strategy (华尔街金融战略)',
    count: 110,
    progress: 35,
    type: 'Econ Core',
    language: 'en',
    description: 'Corporate capitalization structures, leveraged terms, derivatives, and macroeconomics matrices.',
    badge: '💎 Finance Pro',
    gridSpan: 'md:col-span-2 md:row-span-1 h-[160px]',
    bgGradient: 'from-blue-50/70 to-indigo-100/70',
    bgGradientDark: 'from-blue-950/15 to-slate-900/40',
    decorColor: 'text-blue-400 dark:text-sky-400',
    decorativeSvg: 'waves',
    statsLabel: 'Index Verified'
  },
  {
    id: 'bento-academic-5',
    name: 'Neuroscience & Brain (脑神经认知科学)',
    count: 55,
    progress: 42,
    type: 'Medical RP',
    language: 'en',
    description: 'Synaptic transmissions, brain-wave indices, memory space mapping, and cognitive psychology.',
    badge: '🧠 Bio-Cognitive',
    gridSpan: 'md:col-span-1 md:row-span-1 h-[160px]',
    bgGradient: 'from-amber-50/70 to-orange-100/70',
    bgGradientDark: 'from-orange-950/15 to-slate-900/40',
    decorColor: 'text-yellow-500 dark:text-amber-400',
    decorativeSvg: 'rings',
    statsLabel: 'Recall Ratio: 92.4%'
  },
  {
    id: 'bento-daily-6',
    name: 'Urban Slang & Idioms (霓虹下·美式街头俚语)',
    count: 96,
    progress: 15,
    type: 'Lifestyle',
    language: 'en',
    description: 'Modern colloquial speech models, cinematic dialogues, idioms, and informal cultural verbs.',
    badge: '🍿 Street Real',
    gridSpan: 'md:col-span-1 md:row-span-1 h-[160px]',
    bgGradient: 'from-violet-50/70 to-fuchsia-100/70',
    bgGradientDark: 'from-fuchsia-950/15 to-slate-900/40',
    decorColor: 'text-fuchsia-400',
    decorativeSvg: 'bars',
    statsLabel: 'Slang Fluent'
  }
];

// 2. Mock vocabulary list for each category, completely populated so the user is never met with empty screens.
export const MOCK_VOCABULARY_MAP: Record<string, Word[]> = {
  'bento-cosmic-1': [
    { id: 'c-1', text: 'Nebula', phonetic: '/ˈneb.jə.lə/', translation: '星云，弥漫于星际空间的星云状天体', definition: 'A vast, glowing interstellar cloud of dust, hydrogen, helium and complex gases.', example: 'The Orion Nebula glows intensely due to new ultraviolet starbursts.', masteryLevel: 85, tags: ['Cosmic', 'GRE'] },
    { id: 'c-2', text: 'Ethereal', phonetic: '/iˈθɪə.ri.əl/', translation: '缥缈的，超俗的，轻盈如空气的', definition: 'Extremely delicate and light in a way that seems too beautiful for this world.', example: 'The ambient glowing aurora displayed an ethereal pastel shimmer.', masteryLevel: 92, tags: ['Cosmic', 'Aesthetics'] },
    { id: 'c-3', text: 'Infinite', phonetic: '/ˈɪn.fɪ.nət/', translation: '无限的，无穷尽的', definition: 'Limitless or endless in space, extent, or size, impossible to measure.', example: 'The dark cosmic universe is an infinite canvas of physical coordinates.', masteryLevel: 70, tags: ['Cosmic'] },
    { id: 'c-4', text: 'Supernova', phonetic: '/ˌsuː.pəˈnəʊ.və/', translation: '超新星爆发，极其剧烈的恒星崩塌', definition: 'A colossal stellar explosion which briefly outshines an entire galaxy.', example: 'A dying high-mass star triggers a violent supernova, spreading iron elements.', masteryLevel: 55, tags: ['Cosmic', 'GRE'] },
    { id: 'c-5', text: 'Symmetrical', phonetic: '/sɪˈmɛtrɪkəl/', translation: '对称的，极其工整对称的美', definition: 'Exactly similar parts facing each other or around an axis.', example: 'A perfectly symmetrical layout induces cognitive calm.', masteryLevel: 95, tags: ['Aesthetics'] }
  ],
  'bento-silicon-2': [
    { id: 's-1', text: 'Cognition', phonetic: '/kɒɡˈnɪʃ.ən/', translation: '认知，大脑对外界信息的捕获和加工', definition: 'The physical brain action or process of acquiring knowledge and understanding through senses.', example: 'Neural interfaces attempt to translate somatic currents into digital cognition.', masteryLevel: 78, tags: ['Tech', 'Psychology'] },
    { id: 's-2', text: 'Algorithmic', phonetic: '/ˌæl.ɡəˈrɪð.mɪk/', translation: '算法的，遵循精确数学逻辑计算的', definition: 'Pertaining to a set of precise mathematical steps designed to process metadata.', example: 'Bento dynamic feeds are filtered by an algorithmic sorting matrix.', masteryLevel: 84, tags: ['Tech'] },
    { id: 's-3', text: 'Autonomous', phonetic: '/ɔːˈtɒn.ə.məs/', translation: '自主的，无需人工干预的自主运行', definition: 'Acting independently or having the absolute freedom to self-control.', example: 'A fleet of autonomous vehicles navigated the dense metropolitan streets.', masteryLevel: 62, tags: ['Tech'] },
    { id: 's-4', text: 'Synthesis', phonetic: '/ˈsɪn.θə.sɪs/', translation: '融合，高度复杂的合成与综合', definition: 'The combination of components or ideas to construct a unified systemic whole.', example: 'Deep generative models achieve an organic synthesis of paint styles.', masteryLevel: 80, tags: ['Tech', 'Science'] }
  ],
  'bento-literary-3': [
    { id: 'l-1', text: 'Ephemeral', phonetic: '/ɪˈfem.ər.əl/', translation: '转瞬即逝的，极短暂的朦胧之美', definition: 'Lasting for an extremely brief time, fleeting, like autumn mist.', example: 'Cherry blossom seasons are highly ephemeral miracles.', masteryLevel: 98, tags: ['Literature', 'Aesthetics'] },
    { id: 'l-2', text: 'Stardust', phonetic: '/ˈstɑː.dʌst/', translation: '星尘，带有浪漫主义和科幻色彩的尘埃', definition: 'A magical or romantic feel; also cosmic particles ejected by dying stars.', example: 'She gazed into the dark sky, dreaming of traveling through stellar stardust.', masteryLevel: 74, tags: ['Literature', 'Cosmic'] },
    { id: 'l-3', text: 'Melancholy', phonetic: '/ˈmel.əŋ.kɒl.i/', translation: '忧郁，带有一丝审美张力的闲适哀愁', definition: 'A feeling of pensive sadness, typically with no obvious explanation.', example: 'The warm autumn rain evoked a beautiful state of aesthetic melancholy.', masteryLevel: 80, tags: ['Literature', 'Aesthetics'] },
    { id: 'l-4', text: 'Resplendent', phonetic: '/rɪˈsplen.dənt/', translation: '华丽灿烂的，光华耀目的极境', definition: 'Shining brilliantly; splendid or magnificent in physical presentation.', example: 'The royal crown lay resplendent under focused amber spot beams.', masteryLevel: 65, tags: ['Literature'] }
  ],
  'bento-business-4': [
    { id: 'b-1', text: 'Synergy', phonetic: '/ˈsɪn.ə.dʒi/', translation: '协同效应，1加1大于2的系统整合力', definition: 'The combined power or outcome generated when multiple entities cooperate.', example: 'The asset merger produced high operational synergy, cutting server overhead.', masteryLevel: 80, tags: ['Business'] },
    { id: 'b-2', text: 'Liquidity', phonetic: '/lɪˈkwɪd.ə.ti/', translation: '流动性，资本迅速变现的能力', definition: 'The ease with which assets can be converted into ready cash capital quickly.', example: 'Sovereign banks intervened to inject liquidity into central currency reserves.', masteryLevel: 65, tags: ['Business', 'Finance'] },
    { id: 'b-3', text: 'Leverage', phonetic: '/ˈliː.vər.ɪdʒ/', translation: '杠杆，利用有限资本撬动大规模资源', definition: 'Use something to maximum advantage; also capital borrowing to multiply returns.', example: 'The company leveraged its cloud patent portfolio to enter global markets.', masteryLevel: 75, tags: ['Business'] }
  ],
  'bento-academic-5': [
    { id: 'a-1', text: 'Synapse', phonetic: '/ˈsaɪ.næps/', translation: '神经突触，信号传递的生命节点', definition: 'A junction between two nerve cells, consisting of a minute gap.', example: 'Each brain synapse fires millions of times to generate a single recollection.', masteryLevel: 88, tags: ['Science', 'Psychology'] },
    { id: 'a-2', text: 'Heuristic', phonetic: '/hjuːˈrɪs.tɪk/', translation: '启发式，实践所得的经验准则', definition: 'Enabling a person to discover or learn something directly or via experience.', example: 'Heuristics allow humans to formulate snap decisions amidst chaos.', masteryLevel: 70, tags: ['Psychology', 'GRE'] }
  ],
  'bento-daily-6': [
    { id: 'd-1', text: 'Slick', phonetic: '/slɪk/', translation: '时髦帅气的，圆滑流畅的', definition: 'Done in a highly professional and impressive way; smooth or glossy.', example: 'The micro-animations of the bento-box dashboard feel incredibly slick.', masteryLevel: 94, tags: ['Daily'] },
    { id: 'd-2', text: 'Chill', phonetic: '/tʃɪl/', translation: '放松惬意的，酷而不张扬的', definition: 'Calm, relaxed, quiet, or highly stylish in an effortless register.', example: 'We enjoyed a chill evening listening to Lo-Fi tapes.', masteryLevel: 99, tags: ['Daily'] }
  ]
};

// 3. Fallback Walkman cassette vocabulary dataset
export const MOCK_WALKMAN_WORDS: Word[] = [
  { id: 'wm-1', text: 'Serendipity', phonetic: '/ˌser.ənˈdɪp.ə.ti/', translation: '缘分，不期而遇的奇迹', definition: 'The occurrence of finding valuable things by chance in a happy way.', example: 'Meeting my old primary teacher in Tokyo was pure serendipity.', masteryLevel: 88, tags: ['Cosmic'] },
  { id: 'wm-2', text: 'Melancholy', phonetic: '/ˈmel.əŋ.kɒl.i/', translation: '忧郁，带有一丝审美张力的闲适哀愁', definition: 'A feeling of pensive sadness with no obvious explanation.', example: 'The warm autumn rain evoked a beautiful state of melancholy.', masteryLevel: 80, tags: ['Aesthetics'] },
  { id: 'wm-3', text: 'Ineffable', phonetic: '/ɪnˈef.ə.bəl/', translation: '妙不可言的，言语无法表达的极美', definition: 'Too great or extreme to be expressed or described in simple words.', example: 'The sunset over the cloud inversion displayed ineffable majesty.', masteryLevel: 92, tags: ['Literature'] },
  { id: 'wm-4', text: 'Halcyon', phonetic: '/ˈhæl.si.ən/', translation: '岁月静好的，宁静温存的黄金时代', definition: 'Denoting a period of time in the past that was idyllically happy and peaceful.', example: 'We reminisced about the halcyon days of our childhood summers.', masteryLevel: 75, tags: ['Literature'] },
  { id: 'wm-5', text: 'Aurora', phonetic: '/ɔːˈrɔː.rə/', translation: '极光，璀璨散射的霓虹光雨', definition: 'A natural light display in the sky, especially in high-latitude regions.', example: 'The green auroral streaks danced over the snowy Scandinavian peaks.', masteryLevel: 99, tags: ['Cosmic'] }
];

// 4. Subtitle Interactive Learning Interfaces & Datasets
// (SubtitleWord / SubtitleLine / SubtitleCourse types are defined once in
//  ./api/WfNewApiTypes and re-exported above.)
export const MOCK_SUBTITLE_COURSES: SubtitleCourse[] = [
  {
    id: 'sub-c-1',
    title: 'Spanning the Infinite Horizon: Cosmic Philosophy',
    category: 'Astronomy & Metaphors',
    subtitles: [
      {
        startTime: 0.0,
        endTime: 4.8,
        text: "We live in an infinite stellar nebula surrounded by cosmic stardust",
        translation: "我们生活在无限璀璨的星云中，周围环绕着浪漫的宇宙星尘。",
        words: [
          { text: "infinite", translation: "无限的，无穷尽的", definition: "Limitless or endless in space, extent, or size.", phonetic: "/ˈɪn.fɪ.nət/" },
          { text: "stellar", translation: "星球的，主要的，一流的", definition: "Relating to a star or stars; also outstanding.", phonetic: "/ˈstel.ər/" },
          { text: "nebula", translation: "星云，弥漫于星际空间的星云状天体", definition: "A cloud of gas and dust in outer space, visible in the night sky.", phonetic: "/ˈneb.jə.lə/" },
          { text: "cosmic", translation: "宇宙的，宏大的", definition: "Relating to the universe or cosmos, especially as distinct from earth.", phonetic: "/ˈkɒz.mɪk/" },
          { text: "stardust", translation: "星尘，带有科幻与浪漫主义尘埃", definition: "Interstellar particles of matter; a force of magic or romance.", phonetic: "/ˈstɑː.dʌst/" }
        ]
      },
      {
        startTime: 4.9,
        endTime: 10.0,
        text: "The ethereal aurora glows at night like a silent supernova explosion",
        translation: "空灵的极光在夜幕中摇曳闪烁，宛如一场无声的超新星爆发大爆炸。",
        words: [
          { text: "ethereal", translation: "缥缈的，超凡脱俗的", definition: "Extremely delicate and light in a way that seems too perfect for this world.", phonetic: "/iˈθɪə.ri.əl/" },
          { text: "aurora", translation: "极光，璀璨散射的光弧", definition: "A natural light display in the earth's sky, predominantly seen in high-latitude regions.", phonetic: "/ɔːˈrɔː.rə/" },
          { text: "glows", translation: "发光，产生红热光彩", definition: "Produces a steady light and heat without active large flames.", phonetic: "/ɡləʊz/" },
          { text: "supernova", translation: "超新星爆发，极其剧烈的恒星崩塌", definition: "A star that suddenly increases greatly in brightness because of a catastrophic explosion.", phonetic: "/ˌsuː.pəˈnəʊ.və/" }
        ]
      }
    ]
  },
  {
    id: 'sub-c-2',
    title: 'Deep Cognition & Bio-Interface Mechanics',
    category: 'Science & Neurology',
    subtitles: [
      {
        startTime: 0.0,
        endTime: 4.8,
        text: "A single brain synapse can process complex algorithmic cognitive patterns",
        translation: "每一个大脑突触都可以瞬间处理并加工极其复杂的算法认知矩阵。",
        words: [
          { text: "synapse", translation: "神经突触，信号传递的契合点", definition: "A junction between two nerve cells, consisting of a minute gap across which impulses pass.", phonetic: "/ˈsaɪ.næps/" },
          { text: "algorithmic", translation: "算法的，精确遵循计算步骤的", definition: "Relating to an algorithm; a process or set of rules to be followed in calculations.", phonetic: "/ˌæl.ɡəˈrɪð.mɪk/" },
          { text: "cognitive", translation: "认知的，感知加工的", definition: "Relating to the mental action or process of acquiring knowledge and understanding.", phonetic: "/ˈkɒɡ.nɪ.tɪv/" }
        ]
      },
      {
        startTime: 4.9,
        endTime: 10.0,
        text: "Through heuristics we achieve an autonomous synthesis of intelligence",
        translation: "凭借实践所得的经验启发，我们实现了绝对自发主导的大脑智能融合。",
        words: [
          { text: "heuristics", translation: "启发式，经验准则", definition: "Hands-on methods or techniques of finding quick solutions experimentally.", phonetic: "/hjuːˈrɪs.tɪks/" },
          { text: "autonomous", translation: "自主的，独立的", definition: "Having the freedom to govern itself or control its own actions completely.", phonetic: "/ɔːˈtɒn.ə.məs/" },
          { text: "synthesis", translation: "融合，高度复杂的合成", definition: "The combination of ideas, materials, or elements to form a theory or system.", phonetic: "/ˈsɪn.θə.sɪs/" }
        ]
      }
    ]
  }
];

// 5. Aesthetic Statistical Telemetry Models for learning analytics
// (WeeklyActivity / CategoryScore / StudiedTimelineItem / AnalyticsStats types
//  live once in ./api/WfNewApiTypes and are re-exported above.)
export const MOCK_ANALYTICS_STATS: AnalyticsStats = {
  totalStudyMins: 482,
  retentionRate: 88,
  cumulativeLearned: 245,
  vocabularyTarget: 600,
  streakDays: 8,
  weeklyActivity: [
    { day: 'Mon', mins: 45, count: 12 },
    { day: 'Tue', mins: 60, count: 18 },
    { day: 'Wed', mins: 75, count: 22 },
    { day: 'Thu', mins: 30, count: 8 },
    { day: 'Fri', mins: 90, count: 27 },
    { day: 'Sat', mins: 120, count: 35 },
    { day: 'Sun', mins: 62, count: 19 }
  ],
  categoryScores: [
    { name: 'Cosmic & Astronomy', count: 145, score: 72 },
    { name: 'Silicon Mechanics & AI', count: 84, score: 58 },
    { name: 'Ephemeral Verses', count: 62, score: 90 },
    { name: 'Wall Street Strategy', count: 110, score: 35 },
    { name: 'Neuroscience & Brain', count: 55, score: 42 }
  ],
  recentlyStudiedTimeline: [
    { word: 'Nebula', status: 'Mastered', time: '2m ago' },
    { word: 'Ephemeral', status: 'Mastered', time: '14m ago' },
    { word: 'Cognition', status: 'Familiar', time: '38m ago' },
    { word: 'Supernova', status: 'Learning', time: '1h ago' },
    { word: 'Leverage', status: 'Learning', time: '3h ago' },
    { word: 'Synapse', status: 'Familiar', time: '5h ago' }
  ]
};

// 6. Immersive Multi-lingual Bilingual Sentence comparison database
// (BilingualWord / BilingualSentence types live once in ./api/WfNewApiTypes and
//  are re-exported above.)
export const MOCK_BILINGUAL_SENTENCES: BilingualSentence[] = [
  // Pair 1: Native "zh" (Simplified Chinese) -> Target "en" (English)
  {
    id: 'bi-zh-en-1',
    nativeLang: 'zh',
    targetLang: 'en',
    targetText: 'The modern artificial intelligence model performs highly sophisticated cognitive reasoning tasks.',
    nativeText: '现代人工智能模型能够执行高度复杂的认知推理任务。',
    words: [
      { text: 'artificial', phonetic: '/ˌɑː.tɪˈfɪʃ.əl/', translation: '人工的，人造的', definition: 'Made or produced by human beings rather than occurring naturally.' },
      { text: 'sophisticated', phonetic: '/səˈfɪs.tɪ.keɪ.tɪd/', translation: '极其复杂的，高级的', definition: 'Having a high degree of complexity and refinement.' },
      { text: 'cognitive', phonetic: '/ˈkɒɡ.nɪ.tɪv/', translation: '认知的，思维上的', definition: 'Relating to the mental action or process of acquiring knowledge.' }
    ]
  },
  {
    id: 'bi-zh-en-2',
    nativeLang: 'zh',
    targetLang: 'en',
    targetText: 'Our transient physical existence is but a tiny drop in the infinite cosmic ocean.',
    nativeText: '我们转瞬即逝的肉体存在，不过是无尽宇宙海洋中的沧海一粟。',
    words: [
      { text: 'transient', phonetic: '/ˈtræn.zi.ənt/', translation: '瞬息即逝的，短暂的', definition: 'Lasting only for a short time; impermanent.' },
      { text: 'cosmic', phonetic: '/ˈkɒz.mɪk/', translation: '宇宙的，宏大深远的', definition: 'Relating to the universe or cosmos, especially as distinct from the earth.' },
      { text: 'infinite', phonetic: '/ˈɪn.fɪ.nət/', translation: '无限的，无穷尽的', definition: 'Limitless or endless in space, extent, or size.' }
    ]
  },
  {
    id: 'bi-zh-en-3',
    nativeLang: 'zh',
    targetLang: 'en',
    targetText: 'Beautiful visual cards in bento-box layouts induce cognitive ease during study cycles.',
    nativeText: '便当盒布局中精美卡片的视觉反馈能在学习周期里帮大脑建立认知轻松感。',
    words: [
      { text: 'layout', phonetic: '/ˈleɪ.aʊt/', translation: '布局，排放规格', definition: 'The way in which the parts of something are arranged or laid out.' },
      { text: 'induce', phonetic: '/ɪnˈdjuːs/', translation: '诱发，引导产生', definition: 'Succeed in persuading or influencing someone to do something; bring about.' },
      { text: 'ease', phonetic: '/iːz/', translation: '轻松，从容舒适', definition: 'Absence of difficulty or effort.' }
    ]
  },

  // Pair 2: Native "ja" (Japanese) -> Target "en" (English)
  {
    id: 'bi-ja-en-1',
    nativeLang: 'ja',
    targetLang: 'en',
    targetText: 'Continuous learning helps to build durable synaptic links in the neural cortex.',
    nativeText: '継続的な学習は、大脳皮質の神経に強固なシナプス接続を構築するのに役立ちます。',
    words: [
      { text: 'continuous', phonetic: '/kənˈtɪn.ju.əs/', translation: '継続的な，不断の', definition: 'Forming an unbroken whole, without interruption.' },
      { text: 'durable', phonetic: '/ˈdʒʊə.rə.bəl/', translation: '耐久性のある，強固な', definition: 'Able to withstand wear, pressure, or damage; hard-wearing.' },
      { text: 'synaptic', phonetic: '/saɪˈnæp.tɪk/', translation: 'シナプスの', definition: 'Relating to a synapse or synapses between nerve cells.' }
    ]
  },

  // Pair 3: Native "ko" (Korean) -> Target "en" (English)
  {
    id: 'bi-ko-en-1',
    nativeLang: 'ko',
    targetLang: 'en',
    targetText: 'Aesthetic experiences stimulate creative problem solving capabilities in the human brain.',
    nativeText: '미학적 경험은 인간 두뇌의 창의적인 문제 해결 능력을 자극합니다.',
    words: [
      { text: 'aesthetic', phonetic: '/iːsˈθet.ɪk/', translation: '미학적인, 미적인', definition: 'Concerned with beauty or the appreciation of beauty.' },
      { text: 'stimulate', phonetic: '/ˈstɪm.jə.leɪt/', translation: '자극하다, 활성화하다', definition: 'Raise levels of physiological or nervous activity.' }
    ]
  },

  // Pair 4: Native "es" (Spanish) -> Target "en" (English)
  {
    id: 'bi-es-en-1',
    nativeLang: 'es',
    targetLang: 'en',
    targetText: 'Serendipitous encounters often lead to critical life breakthroughs and beautiful discoveries.',
    nativeText: 'Los encuentros fortuitos a menudo conducen a avances cruciales en la vida y a hermosos descubrimientos.',
    words: [
      { text: 'serendipitous', phonetic: '/ˌser.ənˈdɪp.ɪ.təs/', translation: 'fortuito, casualidad afortunada', definition: 'Occurring or discovered by chance in a happy or beneficial way.' },
      { text: 'breakthroughs', phonetic: '/ˈbreɪk.θruːz/', translation: 'avances importantes, logros', definition: 'Significant developments or agreements, especially in science or progress.' }
    ]
  },

  // Pair 5: Native "zh" -> Target "fr" (French)
  {
    id: 'bi-zh-fr-1',
    nativeLang: 'zh',
    targetLang: 'fr',
    targetText: 'La vie éphémère est pleine de moments merveilleux et de poésie inattendue.',
    nativeText: '稍纵即逝的生命中充满了美妙的瞬间和意想不到的诗眼。',
    words: [
      { text: 'éphémère', phonetic: '/e.fe.mɛʁ/', translation: '短暂的，转瞬即逝的', definition: 'Qui ne dure qu\'un jour, qui a une durée très courte.' },
      { text: 'merveilleux', phonetic: '/mɛʁ.vɛ.jø/', definition: '极好的，美妙无比的', translation: 'Qui étonne par son caractère extraordinaire, admirable.' }
    ]
  },

  // Pair 6: Native "zh" -> Target "de" (German)
  {
    id: 'bi-zh-de-1',
    nativeLang: 'zh',
    targetLang: 'de',
    targetText: 'Die ästhetische Gestaltung dieses Programms sorgt für geistigen Frieden beim Lernen.',
    nativeText: '本程序的审美化界面设计为学习过程带来了极度的脑部宁静。',
    words: [
      { text: 'ästhetische', phonetic: '/ɛsˈteːtɪʃə/', translation: '审美的，美学的', definition: 'Auf die Ästhetik, auf die Schönheit der Gestaltung bezogen.' },
      { text: 'gestaltung', phonetic: '/ɡəˈʃtaltʊŋ/', translation: '设计，构造呈现', definition: 'Die Art und Weise, wie etwas künstlerisch oder praktisch geformt ist.' }
    ]
  }
];

// 7. Home content groups — curated mock for the multi-category home sections
// (books / subtitles / documents). Word groups are derived from MOCK_BENTO_GROUPS
// in the mock API, so only the other three categories are seeded here. No
// imageUrl is set so the card draws its kind-coloured gradient fallback offline.
export const MOCK_BOOK_GROUPS: WfNewContentGroup[] = [
  { id: 'book-1', kind: 'book', title: 'The Little Prince (小王子)', count: 412, countUnit: 'sentences', language: 'en', category: 'Fiction', description: 'A poetic tale rich in metaphor and gentle vocabulary.' },
  { id: 'book-2', kind: 'book', title: 'Sapiens — A Brief History', count: 1280, countUnit: 'sentences', language: 'en', category: 'Non-fiction', description: 'Big-history narrative with dense academic vocabulary.' },
  { id: 'book-3', kind: 'book', title: 'Le Petit Prince (FR)', count: 388, countUnit: 'sentences', language: 'fr', category: 'Fiction', description: 'Original French edition for intermediate readers.' },
];

export const MOCK_SUBTITLE_GROUPS: WfNewContentGroup[] = [
  { id: 'sub-1', kind: 'subtitle', title: 'Interstellar (星际穿越)', count: 1640, countUnit: 'subtitles', language: 'en', category: 'Sci-Fi', description: 'Hard sci-fi dialogue — physics & emotional register.' },
  { id: 'sub-2', kind: 'subtitle', title: 'Friends — S01E01', count: 540, countUnit: 'subtitles', language: 'en', category: 'Sitcom', description: 'Everyday conversational English and idioms.' },
  { id: 'sub-3', kind: 'subtitle', title: 'Spirited Away (千と千尋)', count: 720, countUnit: 'subtitles', language: 'ja', category: 'Anime', description: 'Natural spoken Japanese with cultural context.' },
];

// Public word LIBRARIES (词库) — e.g. frequency / exam vocabulary collections.
export const MOCK_LIBRARY_GROUPS: WfNewContentGroup[] = [
  { id: 'lib-1', kind: 'library', title: 'IELTS Core 3000', count: 3000, countUnit: 'words', language: 'en', category: 'Exam', description: 'The essential academic-English word library.' },
  { id: 'lib-2', kind: 'library', title: 'Business English Pack', count: 850, countUnit: 'words', language: 'en', category: 'Professional', description: 'Meetings, negotiation and email vocabulary.' },
  { id: 'lib-3', kind: 'library', title: 'JLPT N2 词库', count: 1500, countUnit: 'words', language: 'ja', category: 'Exam', description: 'Intermediate Japanese vocabulary collection.' },
];

// The user's own uploaded DOCUMENTS (文档) — files turned into a word collection.
export const MOCK_DOCUMENT_GROUPS: WfNewContentGroup[] = [
  { id: 'doc-1', kind: 'document', title: 'Research Notes — Cognition.pdf', count: 214, countUnit: 'words', language: 'en', description: 'Uploaded study notes extracted into a vocabulary set.' },
  { id: 'doc-2', kind: 'document', title: 'Lecture 03 Transcript.txt', count: 96, countUnit: 'words', language: 'en', description: 'Auto-extracted words from an uploaded transcript.' },
];


