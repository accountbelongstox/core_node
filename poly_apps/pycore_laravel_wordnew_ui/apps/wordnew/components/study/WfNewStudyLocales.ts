/**
 * WfNewStudyLocales — self-contained i18n resource block for the shelf study
 * experience (ported from the legacy dictionary client). Kept local to this
 * feature module (rather than in the central en/zh locale files) so the study
 * feature is collision-free and fully within its own owned directory. Same
 * fallback contract as WfNewLocales.translate: active language → English → key.
 *
 * NOTE: this file is the ONLY place Chinese strings live for this feature — an
 * i18n resource block, per the project's English-only-code rule.
 */

type StudyDict = Record<string, string>;

const en: StudyDict = {
  'study.mode.list': 'Browse',
  'study.mode.cards': 'Cards',
  'study.mode.recite': 'Recite',
  'study.mode.review': 'Review',
  'study.stats.mastered': 'Mastered',
  'study.stats.learning': 'Learning',
  'study.stats.due': 'Due',
  'study.stats.session': 'Session',
  'study.stats.dailyGoal': 'Daily goal',
  'study.stats.words': '{n} words',
  'study.reveal': 'Tap to reveal',
  'study.markKnown': 'Known',
  'study.markForgot': 'Forgot',
  'study.mastered': 'Mastered',
  'study.recite.play': 'Play',
  'study.recite.pause': 'Pause',
  'study.recite.prev': 'Previous',
  'study.recite.next': 'Next',
  'study.recite.replay': 'Replay',
  'study.recite.of': '{i} / {n}',
  'study.recite.empty': 'No words to recite in this group yet.',
  'study.review.empty': 'Nothing due for review. Great job!',
  'study.review.count': '{n} due for review',
  'study.list.empty': 'This group has no words yet.',
  'study.guest.title': 'Sign in to track your progress',
  'study.guest.sub': 'Your marks are saved on this device; log in to sync mastery and reviews.',
  'study.settings.title': 'Study settings',
  'study.settings.playCount': 'Plays per word',
  'study.settings.replayCount': 'Replay passes',
  'study.settings.interval': 'Interval (s)',
  'study.settings.speed': 'Speed',
  'study.settings.gap': 'Replay gap (words)',
  'study.settings.reviewOrder': 'Review order',
  'study.settings.order.due_first': 'Due first',
  'study.settings.order.random': 'Random',
  'study.settings.order.hardest_first': 'Hardest first',
  'study.settings.brief': 'Compact (brief) mode',
  'study.settings.autoScroll': 'Auto-scroll active word',
  'study.settings.close': 'Done',
  'study.toast.known': 'Marked as known',
  'study.toast.forgot': 'Queued for review',
  'study.toast.reset': 'Session progress reset',
  'study.reset': 'Reset session',
  'study.definition': 'Definition',
  'study.example': 'Example',
  'study.startQuiz': 'Start Reciting',
  // Arena stats popup (floating progress panel over the playback console).
  'study.arena.stats': 'Progress',
  'study.arena.todayRead': 'Read today',
  'study.arena.todayProgress': "Today's progress",
  'study.arena.totalProgress': 'Library progress',
  'study.arena.read': 'Words read',
  'study.arena.remaining': 'Words left',
  'study.arena.hasReview': 'Review words pending?',
  'study.arena.dueReview': 'Due for review',
  'study.arena.reviewed': 'Reviewed words',
  'study.arena.passes': 'Full passes',
  'study.arena.jumpTo': 'Jump to page',
  'study.arena.yes': 'Yes',
  'study.arena.no': 'No',
  'study.arena.times': '{n}×',
  'study.settings.save': 'Save to account',
  'study.settings.syncing': 'Syncing…',
  'study.settings.synced': 'Synced {t}',
  'study.settings.unsaved': 'Not synced to account',
  'study.settings.syncFailed': 'Sync failed (login required?)',
};

const zh: StudyDict = {
  'study.mode.list': '浏览',
  'study.mode.cards': '卡片',
  'study.mode.recite': '背诵',
  'study.mode.review': '复习',
  'study.stats.mastered': '已掌握',
  'study.stats.learning': '学习中',
  'study.stats.due': '待复习',
  'study.stats.session': '本次',
  'study.stats.dailyGoal': '每日目标',
  'study.stats.words': '{n} 词',
  'study.reveal': '点击显示释义',
  'study.markKnown': '认识',
  'study.markForgot': '忘记',
  'study.mastered': '已掌握',
  'study.recite.play': '播放',
  'study.recite.pause': '暂停',
  'study.recite.prev': '上一个',
  'study.recite.next': '下一个',
  'study.recite.replay': '重播',
  'study.recite.of': '{i} / {n}',
  'study.recite.empty': '该分组暂无可背诵的单词。',
  'study.review.empty': '暂无待复习内容，做得很棒！',
  'study.review.count': '{n} 个待复习',
  'study.list.empty': '该分组暂无单词。',
  'study.guest.title': '登录以记录学习进度',
  'study.guest.sub': '标记会保存在本设备；登录后可同步掌握度与复习计划。',
  'study.settings.title': '背词设置',
  'study.settings.playCount': '每词播放次数',
  'study.settings.replayCount': '复习遍数',
  'study.settings.interval': '间隔（秒）',
  'study.settings.speed': '语速',
  'study.settings.gap': '重播间隔（词）',
  'study.settings.reviewOrder': '复习顺序',
  'study.settings.order.due_first': '到期优先',
  'study.settings.order.random': '随机',
  'study.settings.order.hardest_first': '最难优先',
  'study.settings.brief': '简洁模式',
  'study.settings.autoScroll': '自动滚动到当前词',
  'study.settings.close': '完成',
  'study.toast.known': '已标记为认识',
  'study.toast.forgot': '已加入复习队列',
  'study.toast.reset': '已重置本次进度',
  'study.reset': '重置本次',
  'study.definition': '释义',
  'study.example': '例句',
  'study.startQuiz': '开始背词',
  // Arena stats popup (floating progress panel over the playback console).
  'study.arena.stats': '学习进度',
  'study.arena.todayRead': '今日已读',
  'study.arena.todayProgress': '当日进度',
  'study.arena.totalProgress': '总词库进度',
  'study.arena.read': '已读单词',
  'study.arena.remaining': '待读单词',
  'study.arena.hasReview': '当前是否有复习词',
  'study.arena.dueReview': '待复习',
  'study.arena.reviewed': '已复习单词',
  'study.arena.passes': '整遍读完',
  'study.arena.jumpTo': '跳转到页',
  'study.arena.yes': '是',
  'study.arena.no': '否',
  'study.arena.times': '{n} 遍',
  'study.settings.save': '保存到账号',
  'study.settings.syncing': '同步中…',
  'study.settings.synced': '已同步 {t}',
  'study.settings.unsaved': '未同步到账号',
  'study.settings.syncFailed': '同步失败（需要登录？）',
};

const DICTS: Record<string, StudyDict> = { en, zh };

/** Active-language value → English fallback → raw key, with {name} interpolation. */
export function studyT(
  lang: string,
  key: string,
  replacements?: Record<string, string | number>,
): string {
  const dict = DICTS[lang] ?? en;
  let value = dict[key] ?? en[key] ?? key;
  if (replacements) {
    for (const [k, v] of Object.entries(replacements)) {
      value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return value;
}
